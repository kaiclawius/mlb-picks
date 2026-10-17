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

/* ---------- kinetic film: one short sentence per shot, cut on the beat ---------- */
/** Text markup in a film: "*word*" = accent colour, "[label]" = a UI chip, "|" = the next beat starts here. */
export type Tone = "light" | "dark" | "accent";
/** One moment of a story shot: from beat `at` (into the shot) show `img`, move the camera to `focus`/`zoom`,
 *  show `text` as the caption; `stamp` pops a rubber stamp on that beat. */
export type StoryKey = { at: number; img: string; focus?: [number, number]; zoom?: number; text?: string; stamp?: string;
  /** the 9:16 window crops the sides much more, so it can look somewhere else */ pfocus?: [number, number] };
export type Shot = { beats: number; tone?: Tone } & (
  | { type: "line"; text: string }                                   // a sentence that builds word by word
  | { type: "slam"; text: string; pattern?: string }                // full-bleed colour, big words per beat, repeated text behind
  | { type: "type"; text: string; prompt?: string; label?: string }  // a command typed out while the camera pulls back
  | { type: "field"; count: number; text: string; cols?: number }   // a grid of dots that morphs into a row ("|" splits two captions)
  | { type: "story"; keys: StoryKey[]; url?: string }               // stills in a browser window, one continuous camera move
  | { type: "score"; rows: { from: number; to: number; label: string }[]; text?: string } // odometer counters
  | { type: "mask"; word: string; img: string; text?: string }      // a giant word filled with a picture
  | { type: "montage"; cuts: { img: string; focus?: [number, number]; zoom?: number }[]; text?: string } // one picture per beat
  | { type: "end"; tagline: string; chip?: string; url?: string; footnote?: string }
);
export type Film = {
  bpm: number;
  /** Music in public/. Its beat 0 must be at second `offset` (default 0). */
  music?: { file: string; volume?: number; offset?: number };
  shots: Shot[];
};

/* ---------- walkthrough: real UI panels floating on a canvas, one continuous camera ---------- */
/** Captured panels (capture/walk-*.mjs → panels.json): per state the CSS size and marks (x, y, w, h, 0-1 of the panel). */
export type Panels = Record<string, { inputFont?: { family: string; size: number; color: string; padLeft: number };
  states: Record<string, { size: [number, number]; marks: Record<string, [number, number, number, number]> }> }>;
/** Canvas units are 1080p pixels, (0, 0) is the middle of the frame. `p` is a separate layout for 9:16. */
type Place = { x: number; y: number; w: number };
/** A window: a panel image placed on the canvas; `states` switches the picture at a second into the shot. */
export type WalkWin = Place & { id: string; panel: string; states: [number, string][]; in?: number; p?: Place };
/** Camera: look at a point, a window or a mark on a window. zoom 1 = the full 1920 × 1080 canvas in 16:9.
 *  9:16 and 1:1 use `pz`, else a zoom derived from `zoom`. */
export type WalkCam = { t: number; zoom: number; pz?: number; x?: number; y?: number; px?: number; py?: number; win?: string; mark?: string };
export type WalkShot = { seconds: number } & (
  | { type: "title"; text: string; then?: string; at?: number }    // a serif line; `then` replaces it at second `at`
  | { type: "ui"; windows: WalkWin[]; camera: WalkCam[];
      cursor?: { t: number; win: string; mark: string; click?: boolean }[];  // arrives at `t`, clicks there
      typing?: { t: number; win: string; mark: string; text: string; cps?: number; then: string }; // `then`: the state once typed
      pills?: { t: number; until: number; text: string }[];       // a floating status ("Hiring…") with shimmering text
      checklist?: Place & { p?: Place; title?: string; items: [number, string][] } } // items tick at their second
  | { type: "end"; tagline: string; url?: string; footnote?: string }
);
export type Walk = {
  dir: string;              // folder in public/ with the panel images: <panel>-<state>.jpg
  panels: Panels;
  /** The serif for titles and the status pill, plus its stylesheet in public/. */
  serif: string; serifCss?: string;
  /** Canvas pattern: repeating bands of this colour over brand.colors.bg. */
  band?: string;
  music?: { file: string; volume?: number };
  shots: WalkShot[];
};

export type Product = {
  id: string;           // letters, numbers and dashes: used in composition names and file names
  brand: Brand;
  scenes: Scene[];
  /** Optional music bed in public/, faded in and out. */
  music?: { file: string; volume?: number };
  /** A kinetic film (compositions <id>-film-landscape|portrait|square). */
  film?: Film;
  /** A UI walkthrough (compositions <id>-walk-landscape|portrait|square). */
  walk?: Walk;
  /** Frames of crossfade between scenes (at 30 fps). */
  transition?: number;
};

export type Format = "landscape" | "portrait" | "square";
export const FORMATS: Record<Format, [number, number]> = {
  landscape: [1920, 1080], // YouTube, website, X
  portrait: [1080, 1920],  // TikTok, Reels, Shorts
  square: [1080, 1080],    // feeds
};
