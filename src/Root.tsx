import { Composition, staticFile } from "remotion";
import { DdunitShort, VideoProps, FPS } from "./Video";
import { DdunitExplainer, ExplainerProps } from "./Explainer";

const defaultExplainerProps: ExplainerProps = {
  durationSec: 10,
  audioFile: "",
  scenes: [{ type: "outro", from: 0, to: 10 }],
  words: [],
};

const defaultProps: VideoProps = {
  title: "DDUNIT",
  durationSec: 10,
  audioFile: "",
  sections: [{ image: "", from: 0, to: 10 }],
  words: [],
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
    <Composition
      id="DdunitShort"
      component={DdunitShort}
      width={1080}
      height={1920}
      fps={FPS}
      defaultProps={defaultProps}
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.max(1, Math.ceil(props.durationSec * FPS)),
      })}
    />
    <Composition
      id="DdunitExplainerWide"
      component={DdunitExplainer}
      width={1920}
      height={1080}
      fps={FPS}
      defaultProps={defaultExplainerProps}
      calculateMetadata={async ({ props }) => {
        if (!props.audioFile) {
          try {
            const res = await fetch(staticFile("work-explainer/props.json"));
            const j = (await res.json()) as ExplainerProps;
            return { durationInFrames: Math.ceil(j.durationSec * FPS), props: j };
          } catch { /* défauts */ }
        }
        return { durationInFrames: Math.max(1, Math.ceil(props.durationSec * FPS)) };
      }}
    />
    <Composition
      id="DdunitExplainer"
      component={DdunitExplainer}
      width={1080}
      height={1920}
      fps={FPS}
      defaultProps={defaultExplainerProps}
      calculateMetadata={async ({ props }) => {
        // En studio (props par défaut), charge la dernière vidéo générée
        // pour prévisualiser la vraie composition complète.
        if (!props.audioFile) {
          try {
            const res = await fetch(staticFile("work-explainer/props.json"));
            const j = (await res.json()) as ExplainerProps;
            return { durationInFrames: Math.ceil(j.durationSec * FPS), props: j };
          } catch {
            /* pas encore de rendu : garde les défauts */
          }
        }
        return { durationInFrames: Math.max(1, Math.ceil(props.durationSec * FPS)) };
      }}
    />
  </>
  );
};
