import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setCodec("h264");
Config.setCrf(18);
Config.setPixelFormat("yuv420p");
Config.setColorSpace("bt709"); // without it the H.264 is full-range yuvj420p with no colour tags: washed or crushed blacks on some players
Config.setEnforceAudioTrack(true); // a silent AAC track when the film has no sound: some platforms reject video without audio
// Use an installed Chrome if given (CI, containers); otherwise Remotion downloads its own once.
if (process.env.REMOTION_BROWSER) Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
