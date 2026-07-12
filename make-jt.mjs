#!/usr/bin/env node
/**
 * Alertiva News — génère « Le JT » du jour : récap vidéo vertical (>1 min,
 * monétisable) des derniers titres, voix off gratuite edge-tts.
 *
 *   node make-jt.mjs
 *
 * Sortie : out/alertiva-jt.mp4
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const SB_URL = "https://yzszorqusxudeejunmsx.supabase.co";
const SB_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6c3pvcnF1c3h1ZGVlanVubXN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NTU5NzUsImV4cCI6MjA5OTIzMTk3NX0.3NyXoEqtX3bM48VlxN7bW2WraUGUdjDyJ3D70qs5O_s";
const VOICE = process.env.ALERTIVA_VOICE || "fr-FR-HenriNeural";
const N = 10;

const CAT_FR = {
  monde: "À l'international", france: "En France", politique: "Politique",
  economie: "Économie", tech: "Technologie", sport: "Sport", sciences: "Sciences",
  sante: "Santé", culture: "Culture", insolite: "Insolite",
};

const workDir = path.join(ROOT, "public", "work-jt");
const outDir = path.join(ROOT, "out");
fs.mkdirSync(workDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

const die = (m) => { console.error("❌ " + m); process.exit(1); };
const run = (cmd, argv) => {
  const r = spawnSync(cmd, argv, { stdio: "inherit", shell: process.platform === "win32", cwd: ROOT });
  if (r.status !== 0) die("Échec : " + cmd);
};
const firstSentence = (s) => {
  const t = String(s || "").trim();
  const m = t.match(/^(.{20,180}?[.!?])\s/);
  return (m ? m[1] : t.slice(0, 160)).trim();
};

async function main() {
  console.log("🎬 Alertiva — Le JT du jour");

  // 1. Les derniers titres avec image
  const res = await fetch(
    `${SB_URL}/rest/v1/news_articles?status=eq.published&cover_image=not.is.null&order=published_at.desc&limit=20&select=title,summary,category_slug,cover_image`,
    { headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` } }
  );
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length < 4) die("Pas assez d'articles avec image.");

  // Variété : au plus 2 par rubrique
  const perCat = {};
  const arts = [];
  for (const a of rows) {
    perCat[a.category_slug] = (perCat[a.category_slug] || 0) + 1;
    if (perCat[a.category_slug] <= 2) arts.push(a);
    if (arts.length >= N) break;
  }
  console.log(`   → ${arts.length} titres retenus`);

  const dateStr = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  // 2. Narration : intro + un passage par article + outro
  const introText = `Bonjour, voici le journal Alertiva News, l'essentiel de l'actualité de ce ${dateStr}.`;
  const artTexts = arts.map((a) => `${CAT_FR[a.category_slug] || ""}. ${a.title}. ${firstSentence(a.summary)}`);
  const outroText = `Voilà pour ce tour de l'actualité. Retrouvez tous nos articles sur alertiva news point com, et abonnez-vous pour ne rien manquer.`;
  const parts = [introText, ...artTexts, outroText];
  const fullText = parts.join("\n\n");

  // 3. Voix off edge-tts (gratuit) + sous-titres
  console.log("   → voix off edge-tts (" + VOICE + ")…");
  const txtFile = path.join(workDir, "script.txt");
  const mp3Rel = "work-jt/voice.mp3";
  const mp3Abs = path.join(ROOT, "public", mp3Rel);
  const vttAbs = path.join(workDir, "voice.vtt");
  fs.writeFileSync(txtFile, fullText, "utf8");
  run("python", ["-m", "edge_tts", "--voice", VOICE, "--file", txtFile, "--write-media", mp3Abs, "--write-subtitles", vttAbs]);

  // 4. Durée réelle de l'audio
  const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", mp3Abs], { encoding: "utf8" });
  const durationSec = parseFloat(String(probe.stdout).trim()) + 0.4 || 90;

  // 5. Sous-titres (cues) depuis le VTT
  const vtt = fs.readFileSync(vttAbs, "utf8");
  const toSec = (t) => { const [h, m, s] = t.replace(",", ".").split(":"); return (+h) * 3600 + (+m) * 60 + parseFloat(s); };
  const cues = [];
  const blocks = vtt.split(/\r?\n\r?\n/);
  for (const b of blocks) {
    const mm = b.match(/(\d\d:\d\d:\d\d[.,]\d+)\s*-->\s*(\d\d:\d\d:\d\d[.,]\d+)\s*([\s\S]*)/);
    if (mm) cues.push({ start: toSec(mm[1]), end: toSec(mm[2]), text: mm[3].replace(/\s+/g, " ").trim() });
  }

  // 6. Timeline : segments proportionnels au texte parlé
  const totalChars = parts.reduce((n, p) => n + p.length + 2, 0);
  let cursor = 0;
  const segments = [];
  for (let i = 0; i < parts.length; i++) {
    const share = (parts[i].length + 2) / totalChars;
    const to = i === parts.length - 1 ? durationSec : cursor + share * durationSec;
    if (i === 0) segments.push({ type: "intro", from: cursor, to });
    else if (i === parts.length - 1) segments.push({ type: "outro", from: cursor, to });
    else {
      const a = arts[i - 1];
      const imgRel = `work-jt/img-${i}.jpg`;
      // téléchargement local pour un rendu fiable
      // (fait plus bas de façon asynchrone)
      segments.push({ type: "article", image: imgRel, title: a.title, category: CAT_FR[a.category_slug] || a.category_slug, from: cursor, to, _src: a.cover_image, _rel: imgRel });
    }
    cursor = to;
  }

  // 7. Télécharge les images
  console.log("   → téléchargement des visuels…");
  for (const seg of segments) {
    if (seg.type !== "article") continue;
    try {
      const r = await fetch(seg._src);
      fs.writeFileSync(path.join(ROOT, "public", seg._rel), Buffer.from(await r.arrayBuffer()));
    } catch { seg.image = undefined; }
    delete seg._src; delete seg._rel;
  }

  const props = { durationSec, audioFile: mp3Rel, date: dateStr, segments, cues };
  fs.writeFileSync(path.join(workDir, "props.json"), JSON.stringify(props, null, 2));

  // 8. Rendu + finition
  console.log(`   → rendu Remotion (${Math.round(durationSec)} s)…`);
  const raw = path.join(outDir, "alertiva-jt-raw.mp4");
  run("npx", ["remotion", "render", "src/index.ts", "AlertivaJT", raw, `--props=${path.join(workDir, "props.json")}`]);

  console.log("   → normalisation audio…");
  const finalOut = path.join(outDir, "alertiva-jt.mp4");
  run("ffmpeg", ["-y", "-i", raw, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", finalOut]);
  fs.rmSync(raw, { force: true });

  const size = (fs.statSync(finalOut).size / 1024 / 1024).toFixed(1);
  console.log(`\n✅ JT PRÊT : out/alertiva-jt.mp4 (${size} Mo, ${Math.round(durationSec)} s, 1080×1920)`);
}

main().catch((e) => die(e.stack || String(e)));
