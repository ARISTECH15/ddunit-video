#!/usr/bin/env node
/**
 * DDUNIT — Usine à vidéos. Point d'entrée unique :
 *
 *   node create-video.mjs "Sujet de la vidéo"
 *   node create-video.mjs "Sujet" --mock        (test sans aucune clé API)
 *   node create-video.mjs "Sujet" --keep        (garde les fichiers intermédiaires)
 *
 * Chaîne : script (Groq) → voix off + timings (ElevenLabs) → visuels (Pexels,
 * repli Pollinations) → rendu Remotion 1080×1920 → normalisation FFmpeg.
 * Sortie : out/<slug>.mp4
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import "dotenv/config";

const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const args = process.argv.slice(2);
const MOCK = args.includes("--mock");
const KEEP = args.includes("--keep");
const articleIdx = args.indexOf("--article");
const ARTICLE_SLUG = articleIdx !== -1 ? args[articleIdx + 1] : null;
let subject = args.filter((a, i) => !a.startsWith("--") && i !== articleIdx + 1).join(" ").trim();

if (!subject && !ARTICLE_SLUG) {
  console.error('Usage : node create-video.mjs "Sujet" [--mock] [--keep]');
  console.error('        node create-video.mjs --article <slug-article>   (short depuis un article du blog)');
  process.exit(1);
}

/* Mode article : récupère l'article publié sur le blog DDUNIT (lecture publique) */
let ARTICLE = null;
if (ARTICLE_SLUG) {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/articles?slug=eq.${encodeURIComponent(ARTICLE_SLUG)}&status=eq.published&select=slug,title,content,phase`,
    { headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}` } }
  );
  const rows = await res.json();
  if (!rows?.[0]) { console.error(`❌ Article introuvable ou non publié : ${ARTICLE_SLUG}`); process.exit(1); }
  ARTICLE = rows[0];
  subject = ARTICLE.title;
  console.log(`📰 Mode article : « ${ARTICLE.title} » (${ARTICLE_SLUG})`);
}

const slug = subject
  .toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  .slice(0, 60);

const publicDir = path.join(ROOT, "public");
const workDir = path.join(publicDir, `work-${slug}`);
const outDir = path.join(ROOT, "out");
for (const d of [publicDir, workDir, outDir]) fs.mkdirSync(d, { recursive: true });

const log = (step, msg) => console.log(`\n[${step}] ${msg}`);
const die = (msg) => { console.error(`\n❌ ${msg}`); process.exit(1); };

function run(cmd, argv, opts = {}) {
  const r = spawnSync(cmd, argv, { stdio: "inherit", shell: process.platform === "win32", ...opts });
  if (r.status !== 0) die(`Échec de la commande : ${cmd} ${argv.slice(0, 4).join(" ")}…`);
}

async function fetchJson(url, options, label) {
  const res = await fetch(url, options);
  if (!res.ok) die(`${label} : HTTP ${res.status} — ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function download(url, dest, label) {
  const res = await fetch(url);
  if (!res.ok) die(`${label} : téléchargement HTTP ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

/* ────────────────────────── 1. SCRIPT (Groq) ────────────────────────── */
async function writeScript() {
  if (MOCK) {
    log("1/5 SCRIPT", "mode mock — script de démonstration");
    return {
      title: subject,
      sections: [
        { text: "Saviez-vous que votre vie suit douze grandes phases ?", image_query: "happy family sunrise" },
        { text: "De la petite enfance à la postérité, chacune a ses défis.", image_query: "child learning parent" },
        { text: "DDUNIT vous donne les outils pour chaque étape.", image_query: "planning notebook coffee" },
        { text: "Rejoignez la bêta gratuite sur ddunit point com.", image_query: "smartphone hands smile" },
      ],
    };
  }
  const key = process.env.GROQ_API_KEY || die("GROQ_API_KEY manquante dans .env");
  log("1/5 SCRIPT", `Groq rédige le script pour « ${subject} »…`);
  const body = {
    model: "llama-3.3-70b-versatile",
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          `Tu écris des scripts de vidéos verticales (TikTok/Reels/Shorts) pour DDUNIT, l'écosystème francophone qui accompagne les 12 phases de la vie. Ton : chaleureux, concret, rythmé. Jamais de diagnostic médical ni de conseil financier réglementé.\n` +
          `Réponds UNIQUEMENT en JSON : {"title":"titre court","sections":[{"text":"1-2 phrases parlées naturelles","image_query":"2-4 mots-clés EN ANGLAIS pour une photo de fond"}]}.\n` +
          `Contraintes : 5 à 7 sections ; la 1ère est un hook puissant ; la dernière invite à visiter ddunit.com (dire « ddunit point com ») ; total 110-150 mots (≈ 45-60 s de voix off) ; pas d'emojis ni de didascalies — uniquement le texte à prononcer.`,
      },
      {
        role: "user",
        content: ARTICLE
          ? `Adapte cet article du blog DDUNIT en script vidéo (la vidéo renvoie vers l'article complet — terminer par « l'article complet est sur le blog, ddunit point com »).\n\nTITRE : ${ARTICLE.title}\n\nARTICLE :\n${String(ARTICLE.content).slice(0, 4000)}`
          : `Sujet de la vidéo : ${subject}`,
      },
    ],
  };
  const json = await fetchJson("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, "Groq");
  const script = JSON.parse(json.choices[0].message.content);
  if (!script.sections?.length) die("Script Groq invalide (sections manquantes)");
  console.log(`   → ${script.sections.length} sections, ${script.sections.map(s => s.text).join(" ").split(/\s+/).length} mots`);
  return script;
}

/* ─────────────── 2. VOIX OFF + timings mot à mot (ElevenLabs) ─────────────── */
async function makeVoiceover(script) {
  const audioRel = `work-${slug}/voice.mp3`;
  const audioAbs = path.join(publicDir, audioRel);
  const PHONETIC = process.env.DDUNIT_PHONETIC || "Ddounith";
  // Le TTS reçoit la phonétique kabyle ; les sous-titres réafficheront « DDUNIT »
  const fullText = script.sections.map((s) => s.text).join(" ")
    .replace(/ddunit point com/gi, `${PHONETIC} point com`)
    .replace(/DDUNIT/gi, PHONETIC);

  if (MOCK) {
    log("2/5 VOIX", "mode mock — piste silencieuse + timings simulés");
    run("ffmpeg", ["-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "24", "-q:a", "9", audioAbs]);
    const words = fullText.split(/\s+/);
    const per = 24 / words.length;
    return {
      audioRel,
      durationSec: 24,
      words: words.map((w, i) => ({ text: w.replace(/[.,!?;:]+$/, ""), start: i * per, end: (i + 1) * per - 0.05 })),
      charCursor: null,
    };
  }

  const key = process.env.ELEVENLABS_API_KEY || die("ELEVENLABS_API_KEY manquante dans .env");
  const voice = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
  log("2/5 VOIX", `ElevenLabs (voix ${voice})…`);
  const json = await fetchJson(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: fullText,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    },
    "ElevenLabs"
  );
  fs.writeFileSync(audioAbs, Buffer.from(json.audio_base64, "base64"));

  // Reconstitue les mots depuis l'alignement caractère par caractère
  const al = json.alignment;
  const words = [];
  let cur = null;
  for (let i = 0; i < al.characters.length; i++) {
    const ch = al.characters[i];
    if (/\s/.test(ch)) {
      if (cur) { words.push(cur); cur = null; }
    } else {
      if (!cur) cur = { text: "", start: al.character_start_times_seconds[i], end: 0 };
      cur.text += ch;
      cur.end = al.character_end_times_seconds[i];
    }
  }
  if (cur) words.push(cur);
  for (const w of words) {
    w.text = w.text.replace(/[.,!?;:«»"]+$/g, "").replace(/^[«"]+/g, "");
    if (w.text.toLowerCase() === PHONETIC.toLowerCase()) w.text = "DDUNIT";
  }
  const durationSec = words.length ? words[words.length - 1].end + 0.8 : 10;
  console.log(`   → ${Math.round(durationSec)} s de voix, ${words.length} mots synchronisés`);
  return { audioRel, durationSec, words, alignment: al, fullText };
}

/* ──────── répartition des sections sur la timeline (par proportion de texte) ──────── */
function timeSections(script, voice) {
  const texts = script.sections.map((s) => s.text);
  const totalChars = texts.join(" ").length;
  const out = [];
  let cursor = 0;
  let elapsedChars = 0;
  for (let i = 0; i < texts.length; i++) {
    elapsedChars += texts[i].length + 1;
    const end = i === texts.length - 1 ? voice.durationSec : (elapsedChars / totalChars) * voice.durationSec;
    out.push({ from: cursor, to: end });
    cursor = end;
  }
  return out;
}

/* ────────────── 3. VISUELS (Pexels portrait, repli Pollinations flux) ────────────── */
async function fetchVisuals(script) {
  log("3/5 VISUELS", "recherche des fonds (Pexels → repli Pollinations)…");
  const pexelsKey = process.env.PEXELS_API_KEY;
  const images = [];
  for (let i = 0; i < script.sections.length; i++) {
    const q = script.sections[i].image_query || subject;
    const dest = path.join(workDir, `bg-${i + 1}.jpg`);
    let src = null;
    if (pexelsKey && !MOCK) {
      try {
        const j = await fetchJson(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=3&orientation=portrait`,
          { headers: { Authorization: pexelsKey } },
          "Pexels"
        );
        src = j.photos?.[i % (j.photos.length || 1)]?.src?.large2x || j.photos?.[0]?.src?.large2x || null;
      } catch { src = null; }
    }
    if (!src) {
      src = `https://image.pollinations.ai/prompt/${encodeURIComponent(
        "authentic realistic lifestyle photography, warm natural light, vertical, no text: " + q
      )}?width=1080&height=1920&nologo=true&model=flux&seed=${42 + i}`;
    }
    await download(src, dest, `Visuel ${i + 1} (${q})`);
    console.log(`   → bg-${i + 1}.jpg  [${q}]`);
    images.push(`work-${slug}/bg-${i + 1}.jpg`);
  }
  return images;
}

/* ────────────────────────── 4 + 5. RENDU + FINITION ────────────────────────── */
async function main() {
  console.log(`\n🎬 DDUNIT vidéo — « ${subject} »  (slug: ${slug})${MOCK ? "  [MODE MOCK]" : ""}`);

  const script = await writeScript();
  const voice = await makeVoiceover(script);
  const timing = timeSections(script, voice);
  const images = await fetchVisuals(script);

  const props = {
    title: script.title || subject,
    durationSec: voice.durationSec,
    audioFile: voice.audioRel,
    words: voice.words,
    sections: script.sections.map((s, i) => ({
      image: images[i],
      from: timing[i].from,
      to: timing[i].to,
    })),
  };
  const propsPath = path.join(workDir, "props.json");
  fs.writeFileSync(propsPath, JSON.stringify(props, null, 2));

  log("4/5 RENDU", `Remotion (${Math.ceil(voice.durationSec)} s à 30 fps)…`);
  const rawOut = path.join(outDir, `${slug}-raw.mp4`);
  run("npx", ["remotion", "render", "src/index.ts", "DdunitShort", rawOut, `--props=${propsPath}`], { cwd: ROOT });

  log("5/5 FINITION", "FFmpeg : normalisation audio (-14 LUFS) + faststart…");
  const finalOut = path.join(outDir, `${slug}.mp4`);
  run("ffmpeg", ["-y", "-i", rawOut, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", finalOut]);
  fs.rmSync(rawOut, { force: true });
  if (!KEEP) fs.rmSync(workDir, { recursive: true, force: true });

  const size = (fs.statSync(finalOut).size / 1024 / 1024).toFixed(1);
  console.log(`\n✅ VIDÉO PRÊTE : out/${slug}.mp4  (${size} Mo, ${Math.round(voice.durationSec)} s, 1080×1920)`);
}

main().catch((e) => die(e.stack || String(e)));
