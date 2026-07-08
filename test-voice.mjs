// Génère des variantes phonétiques courtes de « DDUNIT » à écouter,
// pour choisir la bonne prononciation kabyle sans gaspiller le quota.
//   node test-voice.mjs
import fs from "node:fs";
import path from "node:path";
import "dotenv/config";

const VARIANTS = ["DDUNIT", "Ddounit", "Ddounith", "Dounith", "Dou-nith"];
const OUT = path.resolve("out/voice-tests");
fs.mkdirSync(OUT, { recursive: true });

const key = process.env.ELEVENLABS_API_KEY;
const voice = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

for (let i = 0; i < VARIANTS.length; i++) {
  const v = VARIANTS[i];
  const text = `Voici ${v}. ${v} : chaque phase, chaque étape. Rendez-vous sur ${v} point com.`;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.25 },
    }),
  });
  if (!res.ok) { console.error(`ECHEC ${v}: HTTP ${res.status}`); continue; }
  const file = path.join(OUT, `${i + 1}-${v.replace(/[^a-zA-Z-]/g, "")}.mp3`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  console.log(`✓ ${path.basename(file)}  (« ${text.slice(0, 40)}… »)`);
}
console.log("\nÉcoute les fichiers dans out/voice-tests/ et dis-moi le numéro du bon.");
