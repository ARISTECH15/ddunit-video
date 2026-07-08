#!/usr/bin/env node
/**
 * DDUNIT — Vidéo d'onboarding officielle (explainer ~2-3 min, verticale).
 * Storyboard : pyramide de Maslow animée → concept 12 phases → visite du vrai
 * site (captures) → défilé de 12 photos RÉELLES (une par phase) → carte de fin.
 * Règle images : jamais d'humains générés par IA. Photos Pexels uniquement.
 *
 *   node make-explainer.mjs [--keep]
 *
 * Prononciation kabyle de DDUNIT : orthographe phonétique via DDUNIT_PHONETIC
 * dans .env (défaut "Ddounith") — les sous-titres affichent toujours « DDUNIT ».
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import "dotenv/config";

const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const publicDir = path.join(ROOT, "public");
const workDir = path.join(publicDir, "work-explainer");
const outDir = path.join(ROOT, "out");
for (const d of [workDir, outDir]) fs.mkdirSync(d, { recursive: true });

const PHONETIC = process.env.DDUNIT_PHONETIC || "Ddounith";

const log = (s, m) => console.log(`\n[${s}] ${m}`);
const die = (m) => { console.error(`\n❌ ${m}`); process.exit(1); };
const run = (cmd, argv) => {
  const r = spawnSync(cmd, argv, { stdio: "inherit", shell: process.platform === "win32", cwd: ROOT });
  if (r.status !== 0) die(`Échec : ${cmd}`);
};
async function fetchJson(url, options, label) {
  const res = await fetch(url, options);
  if (!res.ok) die(`${label} : HTTP ${res.status} — ${(await res.text()).slice(0, 300)}`);
  return res.json();
}
function pngSize(file) {
  const b = fs.readFileSync(file);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}
async function pexelsPhoto(query, dest, key) {
  const j = await fetchJson(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3&orientation=portrait`,
    { headers: { Authorization: key } }, "Pexels"
  );
  const photo = j.photos?.[0];
  if (!photo) die(`Pexels : aucune photo pour « ${query} »`);
  const res = await fetch(photo.src.large2x || photo.src.large);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return photo.photographer;
}

/* ─── Les 12 phases du défilé final : photos RÉELLES, une par phase ─── */
const MONTAGE = [
  { label: "Petite enfance", query: "baby first steps parents home" },
  { label: "Scolarité", query: "child backpack school smiling" },
  { label: "Adolescence", query: "teenagers friends laughing outdoors" },
  { label: "Études & emploi", query: "university graduation celebration" },
  { label: "Mariage", query: "wedding couple first dance" },
  { label: "Préconception", query: "couple holding hands hope sunset" },
  { label: "Grossesse", query: "pregnant woman partner happy" },
  { label: "Parentalité", query: "family moving new home child boxes" },
  { label: "Maturité", query: "confident middle aged woman professional" },
  { label: "Retraite", query: "senior couple hiking happy nature" },
  { label: "Fin de vie", query: "elderly hands holding together care" },
  { label: "Postérité", query: "grandfather grandchildren photo album" },
];

/* ─── Storyboard + narration (DDUNIT est remplacé phonétiquement pour le TTS) ─── */
const SCENES = [
  {
    visual: { kind: "maslow" },
    text: "Chaque être humain traverse la vie avec les mêmes besoins fondamentaux : se nourrir, être en sécurité, aimer et appartenir, être reconnu, puis s'accomplir. C'est la pyramide de Maslow. Mais ces besoins changent de visage à chaque étape de votre existence.",
  },
  {
    visual: { kind: "phases" },
    text: "Voici DDUNIT : le premier écosystème qui organise votre vie en douze phases, de la petite enfance à la postérité. Chaque phase correspond à un moment clé, avec ses défis et ses décisions.",
  },
  {
    visual: { kind: "screenshot", file: "site/home.png", label: "ddunit.com" },
    text: "Tout commence sur ddunit point com. Dès la page d'accueil, la carte de vie vous montre les douze phases. Cliquez sur celle que vous vivez en ce moment : c'est votre point d'entrée.",
  },
  {
    visual: { kind: "screenshot", file: "site/phase-grossesse.png", label: "Votre phase" },
    text: "Chaque phase a sa page dédiée. Par exemple, la grossesse : vous y trouvez des conseils fiables, des articles, et surtout des outils concrets adaptés à ce moment précis de votre vie.",
  },
  {
    visual: { kind: "screenshot", file: "site/outil-calendrier.png", label: "50 outils gratuits" },
    text: "Cinquante outils pratiques, entièrement gratuits : calendrier des examens de grossesse, budget familial, planificateur de révisions, simulateur de retraite... Vos données sont sauvegardées automatiquement, et vous les retrouvez sur tous vos appareils.",
  },
  {
    visual: { kind: "screenshot", file: "site/simulateur.png", label: "Simulateur de vie" },
    text: "Envie de vous projeter ? Le simulateur de vie analyse votre situation et vous montre ce qui vous attend dans les prochaines phases. Et l'assistant intelligent répond à vos questions, à chaque étape.",
  },
  {
    visual: { kind: "screenshot", file: "site/famille.png", label: "Espace Famille" },
    text: "Avec l'espace Famille, avancez ensemble : jusqu'à cinq membres, chacun son compte privé, et vous choisissez précisément ce que vous partagez entre vous.",
  },
  {
    visual: { kind: "montage" },
    text: "De vos premiers pas à la trace que vous laisserez, DDUNIT vous accompagne partout : l'enfance, l'école, l'adolescence, les études, le mariage, le projet de bébé, la grossesse, la vie de famille, la maturité, la retraite, les derniers chapitres, et la postérité.",
  },
  {
    visual: { kind: "outro" },
    text: "Créez votre compte gratuitement, en trente secondes. Tout est cent pour cent gratuit pendant la bêta. DDUNIT : chaque phase, chaque étape, un seul écosystème. Rendez-vous sur ddunit point com.",
  },
];

async function main() {
  console.log(`\n🎬 DDUNIT — Vidéo d'onboarding (prononciation : « ${PHONETIC} »)`);

  const pexelsKey = process.env.PEXELS_API_KEY || die("PEXELS_API_KEY manquante");

  /* 1. Photos réelles : le défilé des 12 phases */
  log("1/4 VISUELS", "12 photos réelles Pexels pour le défilé des phases…");
  const montageImages = [];
  for (let i = 0; i < MONTAGE.length; i++) {
    const dest = path.join(workDir, `montage-${i + 1}.jpg`);
    if (!fs.existsSync(dest)) {
      const author = await pexelsPhoto(MONTAGE[i].query, dest, pexelsKey);
      console.log(`   → ${MONTAGE[i].label}  © ${author} (Pexels)`);
    } else {
      console.log(`   → ${MONTAGE[i].label}  (déjà téléchargée)`);
    }
    montageImages.push({ image: `work-explainer/montage-${i + 1}.jpg`, label: MONTAGE[i].label });
  }

  /* 2. Voix off — le TTS reçoit la version phonétique, les sous-titres gardent DDUNIT */
  const spoken = (t) => t
    .replace(/ddunit point com/gi, `${PHONETIC} point com`)
    .replace(/DDUNIT/g, PHONETIC);
  const fullText = SCENES.map((s) => spoken(s.text)).join(" ");
  log("2/4 VOIX", `ElevenLabs — ${fullText.length} caractères…`);
  const key = process.env.ELEVENLABS_API_KEY || die("ELEVENLABS_API_KEY manquante");
  const voice = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
  const tts = await fetchJson(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: fullText,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.25 },
      }),
    },
    "ElevenLabs"
  );
  const audioRel = "work-explainer/voice.mp3";
  fs.writeFileSync(path.join(publicDir, audioRel), Buffer.from(tts.audio_base64, "base64"));

  const al = tts.alignment;
  const words = [];
  let cur = null;
  for (let i = 0; i < al.characters.length; i++) {
    const ch = al.characters[i];
    if (/\s/.test(ch)) { if (cur) { words.push(cur); cur = null; } }
    else {
      if (!cur) cur = { text: "", start: al.character_start_times_seconds[i], end: 0 };
      cur.text += ch; cur.end = al.character_end_times_seconds[i];
    }
  }
  if (cur) words.push(cur);
  const phonLower = PHONETIC.toLowerCase();
  for (const w of words) {
    w.text = w.text.replace(/[.,!?;:«»"]+$/g, "").replace(/^[«"]+/g, "");
    // Les sous-titres affichent la vraie marque, pas la phonétique
    if (w.text.toLowerCase() === phonLower) w.text = "DDUNIT";
  }
  const durationSec = words[words.length - 1].end + 1.2;
  console.log(`   → ${Math.round(durationSec)} s de narration, ${words.length} mots`);

  /* 3. Timeline + props */
  const totalChars = SCENES.map((s) => s.text).join(" ").length;
  let cursor = 0, elapsed = 0;
  const scenes = SCENES.map((s, i) => {
    elapsed += s.text.length + 1;
    const to = i === SCENES.length - 1 ? durationSec : (elapsed / totalChars) * durationSec;
    const base = { from: cursor, to };
    cursor = to;
    const v = s.visual;
    if (v.kind === "maslow") return { type: "maslow", ...base };
    if (v.kind === "phases") return { type: "phases", ...base };
    if (v.kind === "montage") return { type: "montage", images: montageImages, ...base };
    if (v.kind === "outro") return { type: "outro", ...base };
    const dim = pngSize(path.join(publicDir, v.file));
    return { type: "screenshot", image: v.file, imgWidth: dim.width, imgHeight: dim.height, label: v.label || undefined, ...base };
  });

  const props = { durationSec, audioFile: audioRel, scenes, words };
  const propsPath = path.join(workDir, "props.json");
  fs.writeFileSync(propsPath, JSON.stringify(props, null, 2));

  /* 4. Rendu + finition */
  log("3/4 RENDU", `Remotion — ${Math.ceil(durationSec)} s à 30 fps…`);
  const raw = path.join(outDir, "ddunit-onboarding-raw.mp4");
  run("npx", ["remotion", "render", "src/index.ts", "DdunitExplainer", raw, `--props=${propsPath}`]);

  log("4/4 FINITION", "FFmpeg : -14 LUFS + faststart…");
  const finalOut = path.join(outDir, "ddunit-onboarding.mp4");
  run("ffmpeg", ["-y", "-i", raw, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", finalOut]);
  fs.rmSync(raw, { force: true });

  const size = (fs.statSync(finalOut).size / 1024 / 1024).toFixed(1);
  console.log(`\n✅ VIDÉO PRÊTE : out/ddunit-onboarding.mp4 (${size} Mo, ${Math.round(durationSec)} s, 1080×1920)`);
}

main().catch((e) => die(e.stack || String(e)));
