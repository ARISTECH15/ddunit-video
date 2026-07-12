import {
  AbsoluteFill, Audio, Img, Sequence, interpolate, spring,
  staticFile, useCurrentFrame, useVideoConfig,
} from "remotion";

export const JT_FPS = 30;
const ALERT = "#E03131";
const DARK = "#0d0d14";
const CREAM = "#F5EFE0";

export type JTSegment = {
  type: "intro" | "article" | "outro";
  image?: string;
  title?: string;
  category?: string;
  from: number;
  to: number;
};
export type Cue = { text: string; start: number; end: number };
export type JTProps = {
  durationSec: number;
  audioFile: string;
  date: string;
  segments: JTSegment[];
  cues: Cue[];
};

/** Bandeau chaîne info permanent en haut. */
const TopBar: React.FC<{ date: string }> = ({ date }) => (
  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 96,
    background: DARK, display: "flex", alignItems: "center", padding: "0 30px", gap: 14 }}>
    <span style={{ width: 16, height: 16, borderRadius: "50%", background: ALERT }} />
    <span style={{ fontFamily: "Georgia, serif", fontWeight: 900, fontSize: 42, color: "#fff", letterSpacing: 2 }}>
      ALERTIVA <span style={{ color: ALERT }}>NEWS</span>
    </span>
    <span style={{ marginLeft: "auto", fontFamily: "Arial", fontSize: 26, color: "#aaa" }}>{date}</span>
  </div>
);

const Intro: React.FC<{ date: string; durationFrames: number }> = ({ date }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 12 } });
  return (
    <AbsoluteFill style={{ background: DARK, justifyContent: "center", alignItems: "center" }}>
      <div style={{ position: "absolute", width: 1300, height: 1300, borderRadius: "50%",
        background: `radial-gradient(circle, ${ALERT}22, transparent 65%)` }} />
      <div style={{ transform: `scale(${s})`, textAlign: "center" }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 130, fontWeight: 900, color: "#fff", letterSpacing: 6 }}>
          ALERTIVA<span style={{ color: ALERT }}>NEWS</span>
        </div>
        <div style={{ marginTop: 20, background: ALERT, color: "#fff", display: "inline-block",
          fontFamily: "Arial", fontWeight: 900, fontSize: 54, padding: "12px 40px", borderRadius: 12, letterSpacing: 4 }}>
          LE JT
        </div>
        <div style={{ marginTop: 30, fontFamily: "Arial", fontSize: 40, color: "#bbb" }}>{date}</div>
      </div>
    </AbsoluteFill>
  );
};

const ArticleSeg: React.FC<{ seg: JTSegment; index: number; durationFrames: number }> = ({ seg, index, durationFrames }) => {
  const frame = useCurrentFrame();
  const zoomIn = index % 2 === 0;
  const scale = interpolate(frame, [0, durationFrames], zoomIn ? [1.05, 1.2] : [1.2, 1.05], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: DARK, overflow: "hidden" }}>
      {seg.image && (
        <Img src={seg.image.startsWith("http") ? seg.image : staticFile(seg.image)}
          style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})` }} />
      )}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(13,13,20,0.6) 0%, transparent 30%, transparent 45%, rgba(13,13,20,0.92) 100%)" }} />
      <div style={{ position: "absolute", bottom: 300, left: 0, right: 0, padding: "0 40px" }}>
        <span style={{ background: ALERT, color: "#fff", fontFamily: "Arial", fontWeight: 900, fontSize: 34,
          padding: "8px 22px", borderRadius: 8, textTransform: "uppercase", letterSpacing: 2 }}>
          {seg.category}
        </span>
        <div style={{ marginTop: 18, fontFamily: "Georgia, serif", fontWeight: 900, fontSize: 66,
          lineHeight: 1.15, color: "#fff", textShadow: "0 2px 20px rgba(0,0,0,0.9)" }}>
          {seg.title}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 12 } });
  const pulse = 1 + 0.03 * Math.sin((frame / fps) * Math.PI * 2);
  return (
    <AbsoluteFill style={{ background: DARK, justifyContent: "center", alignItems: "center" }}>
      <div style={{ transform: `scale(${s})`, fontFamily: "Georgia, serif", fontSize: 110, fontWeight: 900, color: "#fff", letterSpacing: 5 }}>
        ALERTIVA<span style={{ color: ALERT }}>NEWS</span>
      </div>
      <div style={{ marginTop: 24, fontFamily: "Arial", fontSize: 44, color: CREAM }}>
        Toute l&apos;actu en continu
      </div>
      <div style={{ marginTop: 70, transform: `scale(${pulse})`, background: ALERT, color: "#fff",
        fontFamily: "Arial", fontWeight: 900, fontSize: 50, padding: "26px 60px", borderRadius: 60 }}>
        alertivanews.com
      </div>
      <div style={{ marginTop: 30, fontFamily: "Arial", fontSize: 38, color: "#bbb" }}>
        Suivez @alertiva 🎬
      </div>
    </AbsoluteFill>
  );
};

/** Sous-titres synchronisés (cue actif). */
const Subtitles: React.FC<{ cues: Cue[] }> = ({ cues }) => {
  const frame = useCurrentFrame();
  const t = frame / JT_FPS;
  const cue = cues.find((c) => t >= c.start && t <= c.end + 0.15);
  if (!cue) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center" }}>
      <div style={{ marginBottom: 150, maxWidth: 960, textAlign: "center", background: "rgba(13,13,20,0.85)",
        borderRadius: 18, padding: "18px 32px", fontFamily: "Arial", fontWeight: 800, fontSize: 44, lineHeight: 1.3, color: "#fff" }}>
        {cue.text}
      </div>
    </AbsoluteFill>
  );
};

export const AlertivaJT: React.FC<JTProps> = ({ audioFile, date, segments, cues }) => {
  return (
    <AbsoluteFill style={{ background: DARK }}>
      {segments.map((s, i) => {
        const from = Math.floor(s.from * JT_FPS);
        const duration = Math.max(1, Math.ceil((s.to - s.from) * JT_FPS));
        return (
          <Sequence key={i} from={from} durationInFrames={duration}>
            {s.type === "intro" ? <Intro date={date} durationFrames={duration} />
              : s.type === "outro" ? <Outro />
              : <ArticleSeg seg={s} index={i} durationFrames={duration} />}
          </Sequence>
        );
      })}
      <TopBar date={date} />
      <Subtitles cues={cues} />
      {audioFile ? <Audio src={staticFile(audioFile)} /> : null}
    </AbsoluteFill>
  );
};
