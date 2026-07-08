import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FPS, Word } from "./Video";

const GOLD = "#C9A84C";
const DARK = "#0d0d14";
const CARD = "#12121e";
const CREAM = "#F5EFE0";

export type Scene =
  | { type: "photo"; image: string; from: number; to: number; label?: string }
  | { type: "screenshot"; image: string; imgWidth: number; imgHeight: number; from: number; to: number; label?: string }
  | { type: "phases"; from: number; to: number }
  | { type: "maslow"; from: number; to: number }
  | { type: "montage"; images: { image: string; label: string }[]; from: number; to: number }
  | { type: "outro"; from: number; to: number };

export type ExplainerProps = {
  durationSec: number;
  audioFile: string;
  scenes: Scene[];
  words: Word[];
};

const PHASES = [
  "👶 Petite enfance", "🎒 Scolarité", "🎧 Adolescence", "🎓 Études & emploi",
  "💍 Mariage", "🌱 Préconception", "🤰 Grossesse", "🏡 Parentalité",
  "🧭 Maturité", "🌅 Retraite", "🕊️ Fin de vie", "⭐ Postérité",
];

/* ── Photo plein cadre (réelle, Pexels) avec Ken Burns doux ── */
const PhotoScene: React.FC<{ image: string; durationFrames: number; label?: string }> = ({
  image, durationFrames, label,
}) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, durationFrames], [1.06, 1.18], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: DARK, overflow: "hidden" }}>
      <Img src={staticFile(image)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})` }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(13,13,20,0.5), rgba(13,13,20,0.15) 45%, rgba(13,13,20,0.7))" }} />
      {label ? <SceneLabel text={label} /> : null}
    </AbsoluteFill>
  );
};

/* ── Capture du site dans un cadre téléphone, panoramique vertical ── */
const ScreenshotScene: React.FC<{
  image: string; imgWidth: number; imgHeight: number; durationFrames: number; label?: string;
}> = ({ image, imgWidth, imgHeight, durationFrames, label }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const wide = width > height;
  const FRAME_W = wide ? 600 : 900, FRAME_H = wide ? 880 : 1380, RADIUS = 44;
  const displayedH = (FRAME_W / imgWidth) * imgHeight;
  const maxPan = Math.max(0, displayedH - FRAME_H);
  const pan = interpolate(frame, [FPS * 0.6, durationFrames - FPS * 0.4], [0, -maxPan], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ backgroundColor: DARK, alignItems: "center" }}>
      {/* halo doré derrière le téléphone */}
      <div style={{
        position: "absolute", top: wide ? 30 : 60, width: FRAME_W + 100, height: FRAME_H + 100, borderRadius: 80,
        background: `radial-gradient(ellipse at 50% 30%, ${GOLD}30, transparent 70%)`,
      }} />
      <div style={{
        marginTop: wide ? 70 : 110, width: FRAME_W, height: FRAME_H, borderRadius: RADIUS,
        border: `10px solid #2a2a38`, overflow: "hidden", backgroundColor: "#fff",
        boxShadow: "0 40px 120px rgba(0,0,0,0.8)",
      }}>
        <Img
          src={staticFile(image)}
          style={{ width: FRAME_W - 20, transform: `translateY(${pan}px)` }}
          from={-383} />
      </div>
      {label ? <SceneLabel text={label} /> : null}
    </AbsoluteFill>
  );
};

/* ── Grille animée des 12 phases (aucune image IA : rendu natif) ── */
const PhasesScene: React.FC<{ durationFrames: number }> = ({ durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const wide = width > height;
  return (
    <AbsoluteFill style={{ backgroundColor: DARK, justifyContent: "center", alignItems: "center" }}>
      <div style={{
        fontFamily: "Georgia, serif", fontSize: wide ? 50 : 58, color: GOLD, letterSpacing: 4,
        marginBottom: wide ? 40 : 70, opacity: interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" }),
      }}>
        Les 12 phases de la vie
      </div>
      <div style={{ display: "grid", gridTemplateColumns: wide ? "repeat(4, 400px)" : "repeat(2, 460px)", gap: wide ? 20 : 26 }}>
        {PHASES.map((p, i) => {
          const s = spring({ frame: frame - 8 - i * Math.max(2, Math.floor((durationFrames - 60) / 14)), fps, config: { damping: 14 } });
          return (
            <div key={i} style={{
              transform: `scale(${s})`, opacity: s,
              backgroundColor: CARD, border: `2px solid ${GOLD}55`, borderRadius: 22,
              padding: wide ? "20px 26px" : "26px 34px", fontFamily: "Arial, sans-serif", fontSize: wide ? 34 : 40,
              fontWeight: 700, color: CREAM, textAlign: "left",
            }}>
              {p}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ── Pyramide de Maslow animée (rendu 100 % natif, zéro image IA) ── */
const MASLOW = [
  { name: "Accomplissement", desc: "se réaliser", color: "#7C6CF0" },
  { name: "Estime", desc: "être reconnu", color: "#4ECDC4" },
  { name: "Appartenance", desc: "aimer, être aimé", color: "#C9A84C" },
  { name: "Sécurité", desc: "être protégé", color: "#E8A87C" },
  { name: "Physiologique", desc: "se nourrir, dormir", color: "#D4626E" },
];

const MaslowScene: React.FC<{ durationFrames: number }> = ({ durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const wide = width > height;
  const stepDelay = Math.max(10, Math.floor((durationFrames - 90) / 5));
  const W = wide ? 820 : 940, H = wide ? 138 : 190, GAP = wide ? 10 : 14;
  return (
    <AbsoluteFill style={{ backgroundColor: DARK, justifyContent: "center", alignItems: "center" }}>
      <div style={{
        fontFamily: "Georgia, serif", fontSize: wide ? 44 : 54, color: GOLD, letterSpacing: 3, marginBottom: wide ? 28 : 60,
        opacity: interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" }),
      }}>
        Vos besoins, à chaque étape
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: GAP }}>
        {MASLOW.map((lvl, i) => {
          // La pyramide se construit du BAS vers le HAUT : niveau 4 (physio) d'abord
          const order = MASLOW.length - 1 - i;
          const s = spring({ frame: frame - 12 - order * stepDelay, fps, config: { damping: 13 } });
          const widthPct = 0.42 + (i / (MASLOW.length - 1)) * 0.58; // haut étroit → base large
          return (
            <div key={i} style={{
              width: W * widthPct, height: H,
              transform: `scale(${s}) translateY(${(1 - s) * 40}px)`, opacity: s,
              background: `linear-gradient(180deg, ${lvl.color}, ${lvl.color}BB)`,
              clipPath: "polygon(7% 0, 93% 0, 100% 100%, 0 100%)",
              display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
              color: DARK,
            }}>
              <div style={{ fontFamily: "Arial, sans-serif", fontWeight: 900, fontSize: wide ? 32 : 42 }}>{lvl.name}</div>
              <div style={{ fontFamily: "Arial, sans-serif", fontWeight: 600, fontSize: wide ? 23 : 30, opacity: 0.85 }}>{lvl.desc}</div>
            </div>
          );
        })}
      </div>
      <div style={{
        marginTop: wide ? 26 : 56, fontFamily: "Arial, sans-serif", fontSize: wide ? 28 : 36, color: CREAM, opacity:
          interpolate(frame, [12 + 5 * stepDelay, 12 + 5 * stepDelay + 20], [0, 0.95], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>
        Pyramide de Maslow — la boussole de DDUNIT
      </div>
    </AbsoluteFill>
  );
};

/* ── Défilé des 12 phases en photos RÉELLES (une par phase) ── */
const MontageScene: React.FC<{ images: { image: string; label: string }[]; durationFrames: number }> = ({
  images, durationFrames,
}) => {
  const frame = useCurrentFrame();
  const per = durationFrames / images.length;
  const idx = Math.min(images.length - 1, Math.floor(frame / per));
  const local = frame - idx * per;
  const scale = interpolate(local, [0, per], [1.02, 1.12], { extrapolateRight: "clamp" });
  const fadeIn = interpolate(local, [0, 6], [0, 1], { extrapolateRight: "clamp" });
  const img = images[idx];
  return (
    <AbsoluteFill style={{ backgroundColor: DARK, overflow: "hidden" }}>
      <Img src={staticFile(img.image)} style={{
        width: "100%", height: "100%", objectFit: "cover",
        transform: `scale(${scale})`, opacity: fadeIn,
      }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(13,13,20,0.45), transparent 40%, rgba(13,13,20,0.7))" }} />
      <div style={{ position: "absolute", top: 90, left: 0, right: 0, textAlign: "center" }}>
        <span style={{
          backgroundColor: `${DARK}D0`, border: `3px solid ${GOLD}`, color: CREAM,
          fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 52,
          padding: "20px 54px", borderRadius: 60,
        }}>
          {img.label}
        </span>
      </div>
      {/* compteur de phase */}
      <div style={{
        position: "absolute", top: 200, left: 0, right: 0, textAlign: "center",
        fontFamily: "Arial, sans-serif", fontSize: 32, color: GOLD, fontWeight: 800, letterSpacing: 4,
      }}>
        PHASE {idx + 1} / 12
      </div>
    </AbsoluteFill>
  );
};

/* ── Carte de fin : marque + CTA ── */
const OutroScene: React.FC<{ durationFrames: number }> = ({ durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 12 } });
  const pulse = 1 + 0.03 * Math.sin((frame / fps) * Math.PI * 2);
  return (
    <AbsoluteFill style={{ backgroundColor: DARK, justifyContent: "center", alignItems: "center" }}>
      <div style={{
        position: "absolute", width: 1400, height: 1400, borderRadius: "50%",
        background: `radial-gradient(circle, ${GOLD}22, transparent 65%)`,
      }} />
      <div style={{ transform: `scale(${s})`, fontFamily: "Georgia, serif", fontSize: 150, letterSpacing: 30, color: GOLD, fontWeight: 700 }}>
        DDUNIT
      </div>
      <div style={{ marginTop: 30, fontFamily: "Arial, sans-serif", fontSize: 44, color: CREAM, opacity: 0.9 }}>
        Chaque phase. Chaque étape. Un seul écosystème.
      </div>
      <div style={{
        marginTop: 90, transform: `scale(${pulse})`, backgroundColor: GOLD, color: DARK,
        fontFamily: "Arial, sans-serif", fontWeight: 900, fontSize: 52,
        padding: "30px 70px", borderRadius: 60,
      }}>
        ddunit.com — 100 % gratuit en bêta
      </div>
    </AbsoluteFill>
  );
};

/* ── Étiquette de scène (coin haut) ── */
const SceneLabel: React.FC<{ text: string }> = ({ text }) => (
  <div style={{
    position: "absolute", top: 70, left: 0, right: 0, textAlign: "center",
  }}>
    <span style={{
      backgroundColor: `${DARK}CC`, border: `2px solid ${GOLD}`, color: GOLD,
      fontFamily: "Arial, sans-serif", fontWeight: 800, fontSize: 40,
      padding: "16px 42px", borderRadius: 50, letterSpacing: 2,
    }}>
      {text}
    </span>
  </div>
);

/* ── Sous-titres par groupe (posés, lisibles — pas frénétiques) ── */
const GroupCaptions: React.FC<{ words: Word[] }> = ({ words }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const wide = width > height;
  const t = frame / FPS;
  const groups: Word[][] = [];
  for (let i = 0; i < words.length; i += 6) groups.push(words.slice(i, i + 6));
  const group = groups.find((g) => t >= g[0].start && t <= g[g.length - 1].end + 0.3);
  if (!group) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center" }}>
      <div style={{
        marginBottom: wide ? 50 : 120, maxWidth: wide ? 1400 : 960, textAlign: "center",
        backgroundColor: `${DARK}D9`, borderRadius: 26, padding: wide ? "16px 36px" : "22px 40px",
        fontFamily: "Arial, sans-serif", fontWeight: 800, fontSize: wide ? 40 : 46, lineHeight: 1.35, color: CREAM,
      }}>
        {group.map((w, i) => {
          const active = t >= w.start && t <= w.end + 0.05;
          return (
            <span key={i} style={{ color: active ? GOLD : CREAM, margin: "0 8px" }}>{w.text}</span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const DdunitExplainer: React.FC<ExplainerProps> = ({ audioFile, scenes, words }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: DARK }}>
      {scenes.map((s, i) => {
        const from = Math.floor(s.from * FPS);
        const duration = Math.max(1, Math.ceil((s.to - s.from) * FPS));
        return (
          <Sequence key={i} from={from} durationInFrames={duration}>
            {s.type === "photo" ? (
              <PhotoScene image={s.image} durationFrames={duration} label={s.label} />
            ) : s.type === "screenshot" ? (
              <ScreenshotScene image={s.image} imgWidth={s.imgWidth} imgHeight={s.imgHeight} durationFrames={duration} label={s.label} />
            ) : s.type === "phases" ? (
              <PhasesScene durationFrames={duration} />
            ) : s.type === "maslow" ? (
              <MaslowScene durationFrames={duration} />
            ) : s.type === "montage" ? (
              <MontageScene images={s.images} durationFrames={duration} />
            ) : (
              <OutroScene durationFrames={duration} />
            )}
          </Sequence>
        );
      })}
      <GroupCaptions words={words} />
      {audioFile ? <Audio src={staticFile(audioFile)} /> : null}
    </AbsoluteFill>
  );
};
