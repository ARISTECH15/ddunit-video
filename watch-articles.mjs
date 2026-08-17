#!/usr/bin/env node
/**
 * DDUNIT — Veilleur d'articles : le pont entre l'usine à contenu n8n et
 * l'usine à vidéos locale.
 *
 * À chaque passage (tâche planifiée Windows toutes les 30 min) :
 *   1. Cherche les articles publiés récemment sans vidéo (état local processed.json)
 *   2. Génère le short 9:16 depuis l'article (create-video.mjs --article <slug>)
 *   3. Upload le MP4 dans Supabase Storage → social/videos/<slug>.mp4
 *      (URL publique : https://ddunit.com/social-img/videos/<slug>.mp4)
 *   4. Marque l'article traité
 *
 *   node watch-articles.mjs [--once <slug>]   (forcer un article précis)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import "dotenv/config";

const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const STATE = path.join(ROOT, "processed.json");
const state = fs.existsSync(STATE)
  ? JSON.parse(fs.readFileSync(STATE, "utf8").replace(/^﻿/, ""))
  : { done: [] };

// Verrou anti-exécutions concurrentes (tâche planifiée vs lancement manuel)
const LOCK = path.join(ROOT, ".watch.lock");
if (fs.existsSync(LOCK) && Date.now() - fs.statSync(LOCK).mtimeMs < 60 * 60e3) {
  console.log("Un autre passage est en cours (verrou < 60 min) — abandon.");
  process.exit(0);
}
fs.writeFileSync(LOCK, String(process.pid));
process.on("exit", () => { try { fs.rmSync(LOCK, { force: true }); } catch {} });
const say = (m) => console.log(`[${new Date().toISOString().slice(0, 16)}] ${m}`);

const URL_ = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function recentArticles() {
  const DAYS = Number(process.env.WATCH_DAYS) || 7; // WATCH_DAYS=20 pour rattraper un retard
  const since = new Date(Date.now() - DAYS * 864e5).toISOString();
  const res = await fetch(
    `${URL_}/rest/v1/articles?status=eq.published&created_at=gte.${since}&select=slug,title&order=created_at.desc`,
    { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } }
  );
  return res.json();
}

async function articleTitle(slug) {
  const res = await fetch(
    `${URL_}/rest/v1/articles?slug=eq.${encodeURIComponent(slug)}&select=slug,title`,
    { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } }
  );
  return (await res.json())?.[0] || { slug, title: slug };
}

async function uploadVideo(slug, file) {
  const buf = fs.readFileSync(file);
  const res = await fetch(`${URL_}/storage/v1/object/social/videos/${slug}.mp4`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SVC}`, "Content-Type": "video/mp4", "x-upsert": "true" },
    body: buf,
  });
  if (!res.ok) throw new Error(`Upload HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return `https://ddunit.com/social-img/videos/${slug}.mp4`;
}

/** Programme la publication du short : vidéo FB (+15 min) et Reel IG (+45 min).
 *  Les workflows n8n « Social FB Vidéo » et « Social IG Reels » s'en chargent. */
async function schedulePosts(article, videoUrl) {
  // Déduplication : ne jamais reprogrammer un short déjà en file/publié
  const check = await fetch(
    `${URL_}/rest/v1/social_posts?source=eq.${encodeURIComponent("video:" + article.slug)}&select=id&limit=1`,
    { headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } }
  );
  if ((await check.json())?.length) {
    say(`↪️ Posts déjà programmés pour ${article.slug} — on ne double pas.`);
    return;
  }
  const link = `https://ddunit.com/blog/${article.slug}?utm_source=video&utm_campaign=shorts`;
  const caption =
    `🎬 ${article.title}\n\nL'essentiel en moins d'une minute — l'article complet est sur le blog 👉 ddunit.com\n\n#DDUNIT #LifeOS #Famille #ConseilsDeVie`;
  const rows = [
    { network: "facebook_video", scheduled_at: new Date(Date.now() + 15 * 60e3).toISOString(), text: caption, media_url: videoUrl, link, source: `video:${article.slug}`, status: "pending" },
    { network: "instagram_reel", scheduled_at: new Date(Date.now() + 45 * 60e3).toISOString(), text: caption, media_url: videoUrl, link: null, source: `video:${article.slug}`, status: "pending" },
  ];
  const res = await fetch(`${URL_}/rest/v1/social_posts`, {
    method: "POST",
    headers: {
      apikey: SVC, Authorization: `Bearer ${SVC}`,
      "Content-Type": "application/json", Prefer: "return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`Insert social_posts HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

const onceIdx = process.argv.indexOf("--once");
const targets = onceIdx !== -1
  ? [{ slug: process.argv[onceIdx + 1] }]
  : (await recentArticles()).filter((a) => !state.done.includes(a.slug));

if (!targets.length) { say("Rien de nouveau — tous les articles récents ont leur vidéo."); process.exit(0); }

for (const a of targets) {
  const mp4 = path.join(ROOT, "out", `${a.slug.slice(0, 60).replace(/[^a-z0-9-]/g, "-")}.mp4`);
  if (fs.existsSync(mp4)) {
    say(`♻️ Vidéo déjà rendue pour ${a.slug} — passage direct à la publication.`);
  } else {
    say(`🎬 Nouvel article sans vidéo : ${a.slug}`);
    const r = spawnSync("node", ["create-video.mjs", "--article", a.slug], { stdio: "inherit", cwd: ROOT, shell: true });
    if (r.status !== 0) { say(`❌ Échec de génération pour ${a.slug} — on réessaiera au prochain passage.`); continue; }
  }
  if (!fs.existsSync(mp4)) { say(`❌ MP4 introuvable pour ${a.slug}`); continue; }
  try {
    const url = await uploadVideo(a.slug, mp4);
    say(`☁️ Uploadé : ${url}`);
    const art = a.title ? a : await articleTitle(a.slug);
    await schedulePosts(art, url);
    say(`📅 Publication programmée : vidéo FB (+15 min) et Reel IG (+45 min)`);
  } catch (e) {
    say(`⚠️ Vidéo générée mais publication non programmée (${e.message}) — fichier local : ${mp4}`);
  }
  state.done.push(a.slug);
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
  say(`✅ ${a.slug} traité.`);
}
