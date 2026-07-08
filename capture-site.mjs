// Capture les pages publiques de ddunit.com en format mobile (pour les
// panoramiques verticaux de la vidéo d'onboarding). Zéro image IA : le vrai site.
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const CHROME = path.resolve(
  "node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe"
);
const OUT = path.resolve("public/site");
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  { name: "home", url: "https://ddunit.com/", maxHeight: 4200 },
  { name: "phase-grossesse", url: "https://ddunit.com/phases/grossesse", maxHeight: 4200 },
  { name: "outil-calendrier", url: "https://ddunit.com/phases/grossesse/outils/calendrier-examens", maxHeight: 4200 },
  { name: "simulateur", url: "https://ddunit.com/simulateur", maxHeight: 3600 },
  { name: "famille", url: "https://ddunit.com/famille", maxHeight: 3000 },
  { name: "blog", url: "https://ddunit.com/blog", maxHeight: 3600 },
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--hide-scrollbars"],
});

for (const p of PAGES) {
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 2 });
  await page.goto(p.url, { waitUntil: "networkidle2", timeout: 60000 });
  // Fait défiler pour déclencher les animations/lazy-load, puis remonte
  await page.evaluate(async () => {
    await new Promise((res) => {
      let y = 0;
      const t = setInterval(() => {
        y += 500; window.scrollTo(0, y);
        if (y >= document.body.scrollHeight) { clearInterval(t); window.scrollTo(0, 0); res(); }
      }, 120);
    });
  });
  await new Promise((r) => setTimeout(r, 1200));
  const fullHeight = await page.evaluate(() => document.body.scrollHeight);
  const height = Math.min(fullHeight, p.maxHeight);
  await page.screenshot({
    path: path.join(OUT, `${p.name}.png`),
    clip: { x: 0, y: 0, width: 430, height },
  });
  const kb = Math.round(fs.statSync(path.join(OUT, `${p.name}.png`)).size / 1024);
  console.log(`✓ ${p.name}.png — ${430}×${height} (@2x, ${kb} Ko)`);
  await page.close();
}
await browser.close();
console.log("Captures terminées → public/site/");
