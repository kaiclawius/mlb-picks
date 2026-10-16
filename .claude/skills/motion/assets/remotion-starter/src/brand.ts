// Brand tokens for this video. Replace with the client's colors and fonts; every scene reads from here.
export const BRAND = {
  name: "Taskly",
  url: "taskly.app",
  colors: {
    bg: "#f6f5f1",      // background
    surface: "#ffffff", // cards, windows
    ink: "#15161a",     // main text
    muted: "#6a6c75",   // secondary text
    line: "#e2e0d9",    // hairlines
    accent: "#4f46e5",  // the one color that means "look here"
    accent2: "#ff6b4a", // rare second accent (cursor ring, highlights)
  },
  fonts: {
    // System stacks render everywhere without network. For brand fonts, put .woff2 files in public/fonts
    // and load them with loadFonts() in src/fonts.ts.
    display: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    body: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    mono: "ui-monospace, 'SF Mono', Menlo, monospace",
  },
};
export type Brand = typeof BRAND;
