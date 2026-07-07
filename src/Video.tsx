import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const FPS = 30;

export type Word = { text: string; start: number; end: number };
export type Section = { image: string; from: number; to: number };
export type VideoProps = {
  title: string;
  durationSec: number;
  audioFile: string;
  sections: Section[];
  words: Word[];
};

const GOLD = "#C9A84C";
const DARK = "#0d0d14";
const CREAM = "#F5EFE0";

/** Fond image avec effet Ken Burns (zoom + translation lente, direction alternée) */
const KenBurns: React.FC<{ src: string; index: number; durationFrames: number }> = ({
  src,
  index,
  durationFrames,
}) => {
  const frame = useCurrentFrame();
  const zoomIn = index % 2 === 0;
  const scale = interpolate(
    frame,
    [0, durationFrames],
    zoomIn ? [1.05, 1.2] : [1.2, 1.05],
    { extrapolateRight: "clamp" }
  );
  const drift = interpolate(frame, [0, durationFrames], [0, index % 2 === 0 ? -30 : 30], {
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: DARK }}>
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale}) translateX(${drift}px)`,
        }}
      />
      {/* Voile sombre pour la lisibilité des sous-titres */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(13,13,20,0.55) 0%, rgba(13,13,20,0.15) 40%, rgba(13,13,20,0.65) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

/** Sous-titres mot-à-mot style TikTok : groupe de mots courant, mot actif en or */
const Captions: React.FC<{ words: Word[] }> = ({ words }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;

  // Groupes de 4 mots max — le groupe affiché est celui contenant le mot courant
  const groups: Word[][] = [];
  for (let i = 0; i < words.length; i += 4) groups.push(words.slice(i, i + 4));
  const group = groups.find(
    (g) => t >= g[0].start && t <= g[g.length - 1].end + 0.25
  );
  if (!group) return null;

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center" }}>
      <div
        style={{
          marginBottom: 420,
          maxWidth: 900,
          textAlign: "center",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontWeight: 900,
          fontSize: 72,
          lineHeight: 1.25,
          textTransform: "uppercase",
          textShadow:
            "0 0 18px rgba(0,0,0,0.9), 4px 4px 0 rgba(0,0,0,0.75)",
        }}
      >
        {group.map((w, i) => {
          const active = t >= w.start && t <= w.end + 0.05;
          return (
            <span
              key={i}
              style={{
                color: active ? GOLD : CREAM,
                transform: active ? "scale(1.08)" : "scale(1)",
                display: "inline-block",
                margin: "0 12px",
                transition: "none",
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** Bandeau de marque + barre de progression */
const Branding: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = (frame / durationInFrames) * 100;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center" }}>
      <div
        style={{
          marginBottom: 140,
          fontFamily: "Georgia, serif",
          fontSize: 44,
          letterSpacing: 14,
          color: GOLD,
          textShadow: "0 0 14px rgba(0,0,0,0.9)",
        }}
      >
        DDUNIT
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 100,
          fontFamily: "Arial, sans-serif",
          fontSize: 26,
          color: CREAM,
          opacity: 0.85,
          textShadow: "0 0 10px rgba(0,0,0,0.9)",
        }}
      >
        ddunit.com — votre vie, votre système
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          height: 14,
          width: `${progress}%`,
          background: GOLD,
        }}
      />
    </AbsoluteFill>
  );
};

export const DdunitShort: React.FC<VideoProps> = ({
  audioFile,
  sections,
  words,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: DARK }}>
      {sections.map((s, i) => {
        const from = Math.floor(s.from * FPS);
        const duration = Math.max(1, Math.ceil((s.to - s.from) * FPS));
        return (
          <Sequence key={i} from={from} durationInFrames={duration}>
            <KenBurns
              src={s.image.startsWith("http") ? s.image : staticFile(s.image)}
              index={i}
              durationFrames={duration}
            />
          </Sequence>
        );
      })}
      <Captions words={words} />
      <Branding />
      {audioFile ? <Audio src={staticFile(audioFile)} /> : null}
    </AbsoluteFill>
  );
};
