import { Config } from "@remotion/cli/config";

// Sharp text and UI in every frame.
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setCodec("h264");
Config.setCrf(16);
Config.setPixelFormat("yuv420p");
Config.setColorSpace("bt709"); // tagged, limited-range BT.709 (the default is untagged full-range yuvj420p)
Config.setEnforceAudioTrack(true); // silent AAC track when there is no sound
// Use an installed Chrome if one is given (cloud containers ship one), otherwise Remotion downloads its own.
if (process.env.REMOTION_BROWSER) Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
