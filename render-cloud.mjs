#!/usr/bin/env node
/**
 * DDUNIT — Rendu vidéo dans le CLOUD (GitHub Actions), PC éteint.
 * Équivalent cloud de watch-articles.mjs, mais SANS état local : les runners CI
 * sont éphémères, donc `processed.json` n'est pas fiable. La source de vérité du
 * « déjà fait » est le bucket : un article a sa vidéo si `social/videos/<slug>.mp4`
 * existe.
 *
 *   PUBLISH=1 (cron)  : rend → upload → programme FB (+15 min) et Reel IG (+45 min)
 *   PUBLISH=0 (test)  : rend SEULEMENT (valide le pipeline), sans upload ni post,
 *                       pour ne pas polluer l'état (bucket) lors d'un dispatch de test.
 *
 * Variables : WATCH_DAYS (défaut 7) · VIDEO_CAP (défaut 4) · PUBLISH (0/1)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import "dotenv/config";

const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const URL_ = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DAYS = Number(process.env.WATCH_DAYS) || 7;
const CAP = Number(process.env.VIDEO_CAP) || 4;
const PUBLISH = process.env.PUBLISH === "1";
const say = (m) => console.log(`[${new Date().toISOString().slice(0, 16)}] ${m}`);

if (!URL_ || !SVC) { console.error("❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis."); process.exit(1); }

// Le fichier local produit par create-video.mjs (slug tronqué à 60, non-alnum → '-').
const localMp4 = (slug) => path.join(ROOT, "out", `${slug.slice(0, 60).replace(/[^a-z0-9-]/g, "-")}.mp4`);

async function recentArticles() {
  const since = new Date(Date.now() - DAYS * 864e5).toISOString();
  const r = await fetch(
    `${URL_}/rest/v1/articles?status=eq.published&created_at=gte.${since}&select=slug,title&order=created_at.desc`,
    { headers: { apikey: ANON || SVC, Authorization: `Bearer ${ANON || SVC}` } }
  );
  if (!r.ok) throw new Error(`articles HTTP ${r.status} — ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

/** Slugs déjà en vidéo = objets `<slug>.mp4` du bucket social, préfixe videos/. */
async function existingVideoSlugs() {
  const r = await fetch(`${URL_}/storage/v1/object/list/social`, {
    method: "POST",
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: "videos", limit: 1000, sortBy: { column: "name", order: "asc" } }),
  });
  if (!r.ok) throw new Error(`list HTTP ${r.status} — ${(await r.text()).slice(0, 200)}`);
  const items = await r.json();
  return new Set((items || []).filter((o) => o.name?.endsWith(".mp4")).map((o) => o.name.replace(/\.mp4$/, "")));
}

async function uploadVideo(slug, file) {
  const r = await fetch(`${URL_}/storage/v1/object/social/videos/${slug}.mp4`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SVC}`, "Content-Type": "video/mp4", "x-upsert": "true" },
    body: fs.readFileSync(file),
  });
  if (!r.ok) throw new Error(`upload HTTP ${r.status} — ${(await r.text()).slice(0, 200)}`);
  return `https://ddunit.com/social-img/videos/${slug}.mp4`;
}

/** Programme FB vidéo (+15 min) + Reel IG (+45 min) ; déduplication par source. */
async function schedulePosts(article, videoUrl) {
  const check = await fetch(
    `${URL_}/rest/v1/social_posts?source=eq.${encodeURIComponent("video:" + article.slug)}&select=id&limit=1`,
    { headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } }
  );
  if ((await check.json())?.length) { say(`↪️ posts déjà programmés pour ${article.slug} — on ne double pas.`); return; }
  const link = `https://ddunit.com/blog/${article.slug}?utm_source=video&utm_campaign=shorts`;
  const caption =
    `🎬 ${article.title}\n\nL'essentiel en moins d'une minute — l'article complet est sur le blog 👉 ddunit.com\n\n#DDUNIT #LifeOS #Famille #ConseilsDeVie`;
  const rows = [
    { network: "facebook_video", scheduled_at: new Date(Date.now() + 15 * 60e3).toISOString(), text: caption, media_url: videoUrl, link, source: `video:${article.slug}`, status: "pending" },
    { network: "instagram_reel", scheduled_at: new Date(Date.now() + 45 * 60e3).toISOString(), text: caption, media_url: videoUrl, link: null, source: `video:${article.slug}`, status: "pending" },
  ];
  const r = await fetch(`${URL_}/rest/v1/social_posts`, {
    method: "POST",
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`social_posts HTTP ${r.status} — ${(await r.text()).slice(0, 200)}`);
}

// ─────────────────────────────── run ───────────────────────────────
const [recent, done] = await Promise.all([recentArticles(), existingVideoSlugs()]);
const todo = recent.filter((a) => !done.has(a.slug)).slice(0, CAP);
say(`${recent.length} articles récents · ${done.size} déjà en vidéo → ${todo.length} à produire (cap ${CAP}, publish=${PUBLISH ? 1 : 0})`);
if (!todo.length) { say("Rien de nouveau."); process.exit(0); }

let ok = 0, fail = 0;
for (const a of todo) {
  const mp4 = localMp4(a.slug);
  say(`🎬 ${a.slug}`);
  const r = spawnSync("node", ["create-video.mjs", "--article", a.slug], { stdio: "inherit", cwd: ROOT, shell: process.platform === "win32" });
  if (r.status !== 0 || !fs.existsSync(mp4)) { say(`❌ échec rendu ${a.slug} — repris au prochain run`); fail++; continue; }
  if (!PUBLISH) { say(`🧪 test : rendu OK (ni upload ni post) — ${a.slug}`); ok++; continue; }
  try {
    const url = await uploadVideo(a.slug, mp4);
    say(`☁️ uploadé : ${url}`);
    await schedulePosts(a, url);
    say(`📅 FB (+15 min) + Reel IG (+45 min) programmés`);
    ok++;
  } catch (e) {
    say(`⚠️ vidéo rendue mais publication échouée (${e.message}) — repris au prochain run`);
    fail++;
  }
}
say(`Terminé : ${ok} OK, ${fail} échec(s).`);
process.exit(0);
