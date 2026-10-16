import { registerRoot, Composition } from "remotion";
import { Demo, FPS, demoFrames } from "./Demo.jsx";

// One composition; the server passes the recording as input props and the length is computed from them.
function Root() {
  return (
    <Composition id="KlippDemo" component={Demo} fps={FPS} width={1920} height={1080} durationInFrames={300}
      defaultProps={{ title: "Demo", summary: "", segments: [], chapters: [], cues: [], tldr: [], main: "", cam: "", bubble: {}, accent: "#ff5a36", outro: "" }}
      calculateMetadata={({ props }) => ({ durationInFrames: demoFrames(props) })} />
  );
}
registerRoot(Root);
