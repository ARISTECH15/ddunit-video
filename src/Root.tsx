import { Composition } from "remotion";
import { DdunitShort, VideoProps, FPS } from "./Video";

const defaultProps: VideoProps = {
  title: "DDUNIT",
  durationSec: 10,
  audioFile: "",
  sections: [{ image: "", from: 0, to: 10 }],
  words: [],
};

export const RemotionRoot: React.FC = () => {
  return (
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
  );
};
