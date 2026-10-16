// The whole language of a product video. A product file in products/ is a Brand plus a list of Scenes.

export type Brand = {
  /** Shown on the closing card and as the small mark on screen scenes. Second part is drawn in the accent colour. */
  wordmark: [string, string?];
  colors: {
    bg: string;       // page background
    surface: string;  // cards, the browser window
    ink: string;      // main text
    muted: string;    // secondary text
    accent: string;   // highlights, numbers
    line: string;     // hairlines, borders
  };
  fonts: { display: string; body: string; mono: string };
  /** Stylesheet in public/ with the @font-face rules (made by capture/fonts.mjs). Loaded before the first frame. */
  fontCss?: string;
  /** Extra CSS for the display font, e.g. "font-stretch:125%;font-weight:850". */
  displayStyle?: React.CSSProperties;
};

/** A moment of the camera on a screen recording. x/y: the point to centre on (0-1 of the clip), zoom: 1 = whole clip fits. */
export type CameraKey = { t: number; x: number; y: number; zoom: number };

export type Scene =
  | { type: "title"; seconds: number; kicker?: string; title: string; subtitle?: string }
  | { type: "statement"; seconds: number; lines: string[] } // *words* are drawn in the accent colour
  | {
      type: "screen"; seconds: number;
      clip: string;            // file in public/, e.g. "payroll/round.mp4"
      from?: number;           // second in the clip to start at
      clipSize?: [number, number];
      url?: string;            // shown in the window's address bar
      kicker?: string; title: string; body?: string;
      camera?: CameraKey[];
      /** The 9:16 window shows less of the clip, so it can get its own camera path. */
      cameraPortrait?: CameraKey[];
    }
  | { type: "steps"; seconds: number; kicker?: string; title: string; steps: { title: string; body: string }[] }
  | { type: "features"; seconds: number; kicker?: string; title: string; items: { title: string; body: string }[] }
  | { type: "cta"; seconds: number; title: string; subtitle?: string; url?: string; footnote?: string };

export type Product = {
  id: string;           // letters, numbers and dashes: used in composition names and file names
  brand: Brand;
  scenes: Scene[];
  /** Optional music bed in public/, faded in and out. */
  music?: { file: string; volume?: number };
  /** Frames of crossfade between scenes (at 30 fps). */
  transition?: number;
};

export type Format = "landscape" | "portrait" | "square";
export const FORMATS: Record<Format, [number, number]> = {
  landscape: [1920, 1080], // YouTube, website, X
  portrait: [1080, 1920],  // TikTok, Reels, Shorts
  square: [1080, 1080],    // feeds
};
