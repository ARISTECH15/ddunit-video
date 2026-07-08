import "dotenv/config";

const checks = [];
// ElevenLabs : infos du compte (et quota de caractères restant)
checks.push(fetch("https://api.elevenlabs.io/v1/user/subscription", {
  headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
}).then(async (r) => {
  if (!r.ok) throw new Error("ElevenLabs HTTP " + r.status);
  const j = await r.json();
  console.log(`ElevenLabs OK — plan ${j.tier}, ${j.character_limit - j.character_count} caractères restants ce mois`);
}));
// Groq : micro-complétion
checks.push(fetch("https://api.groq.com/openai/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: "llama-3.3-70b-versatile", max_tokens: 4, messages: [{ role: "user", content: "ping" }] }),
}).then((r) => { if (!r.ok) throw new Error("Groq HTTP " + r.status); console.log("Groq OK"); }));
// Pexels
checks.push(fetch("https://api.pexels.com/v1/search?query=family&per_page=1", {
  headers: { Authorization: process.env.PEXELS_API_KEY },
}).then((r) => { if (!r.ok) throw new Error("Pexels HTTP " + r.status); console.log("Pexels OK"); }));

Promise.all(checks).then(() => console.log("TOUTES LES CLES SONT VALIDES")).catch((e) => { console.error("ECHEC:", e.message); process.exit(1); });
