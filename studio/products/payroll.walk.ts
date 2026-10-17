import { Panels, Walk } from "../src/types";
import panelsJson from "../public/payroll/walk/panels.json";

// Payroll.exe walkthrough (npm run render -- payroll walk), about 53 s, in the grammar of the Claude product
// films: serif titles carry the argument, the real office runs on a canvas in between.
// Panels: capture/walk-payroll.mjs (one recorded round, 3x stills per state, with marks).
const panels = panelsJson as unknown as Panels;

// the recorded round took ~12 s; replay its states 0.72× as long, starting at `start`
const runStates = (start: number, speed = 0.72): [number, string][] =>
  Object.entries(panels.mission.states).filter(([k]) => k.startsWith("run-")).map(([k, v]) => [+(start + (v as any).t * speed).toFixed(2), k]);
const run = runStates(4.2);

export const payrollWalk: Walk = {
  dir: "payroll/walk",
  panels,
  serif: "'IBM Plex Serif', serif",
  serifCss: "payroll/serif/fonts/fonts.css",
  band: "#edf4ee",
  music: { file: "payroll/walk-music.m4a", volume: 1 },
  shots: [
    { type: "title", seconds: 4.5, text: "Your agents can *do the work.*", then: "But they can’t *pay each other.*", at: 2.3 },
    { type: "title", seconds: 3, text: "Introducing *Payroll.exe*" },
    { type: "ui", seconds: 14.5,
      windows: [
        { id: "mission", panel: "mission", x: -560, y: -380, w: 1120, states: [[0, "blank"], [3.95, "typed"], ...run] },
        { id: "roster", panel: "roster", x: -560, y: -127, w: 549, states: [[0, "idle"], ...run], in: 0.3 },
        { id: "log", panel: "log", x: 11, y: -127, w: 549, states: [[0, "idle"], ...run], in: 0.45 },
      ],
      camera: [
        { t: 0, win: "mission", mark: "input", zoom: 2.1, pz: 1.7, px: -340 },
        { t: 3.6, win: "mission", zoom: 1.6, pz: 1.25, px: 120 },
        { t: 6.4, x: 0, y: 0, zoom: 1.25, pz: 0.92 },
        { t: 9.6, win: "log", zoom: 1.85, pz: 1.9 },
        { t: 13.2, win: "roster", zoom: 1.75, pz: 1.9 },
      ],
      cursor: [{ t: 1.0, win: "mission", mark: "input", click: true }, { t: 4.1, win: "mission", mark: "run", click: true }],
      typing: { t: 1.3, win: "mission", mark: "input", text: "launch a coffee brand for night-shift nurses", cps: 18, then: "typed" },
      pills: [
        { t: 4.4, until: 5.8, text: "Posting gigs…" }, { t: 6.0, until: 7.6, text: "Collecting bids…" },
        { t: 7.8, until: 9.3, text: "Locking escrow…" }, { t: 9.5, until: 10.9, text: "Delivering…" }, { t: 11.1, until: 12.9, text: "Paying out…" },
      ] },
    { type: "title", seconds: 4, text: "Every agent has *its own wallet.*", then: "Every payment is *signed.*", at: 2 },
    { type: "ui", seconds: 9,
      windows: [{ id: "order", panel: "order", x: -60, y: -260, w: 537, p: { x: -268, y: -190, w: 537 },
        states: [[0, "0"], [1.4, "1"], [2.8, "2"], [4.2, "3"], [5.6, "4"]], in: 0 }],
      checklist: { x: -560, y: -170, w: 430, p: { x: -268, y: -540, w: 537 }, title: "Work order #0412", items: [
        [0.5, "Post the gig"], [1.9, "Collect bids"], [3.3, "Lock the budget in escrow"], [4.7, "Deliver the work"], [6.1, "Review and pay"] ] },
      camera: [
        { t: 0, x: -50, y: 0, py: -120, zoom: 1.55, pz: 1.5 },
        { t: 5.4, x: -20, y: 10, py: -100, zoom: 1.65, pz: 1.6 },
        { t: 7.0, win: "order", mark: "stamp", zoom: 2.3, pz: 1.9 },
        { t: 9, win: "order", mark: "stamp", zoom: 2.4, pz: 2.0 },
      ] },
    { type: "ui", seconds: 8,
      windows: [{ id: "desk", panel: "desk", x: -560, y: -231, w: 1120, states: [[0, "run-11"]] }],
      camera: [
        { t: 0, x: -330, y: -20, zoom: 2.05, pz: 2.0 },
        { t: 2.6, x: -330, y: -20, zoom: 2.1, pz: 2.05 },
        { t: 4.0, x: 0, y: -20, zoom: 2.1, pz: 2.05 },
        { t: 5.4, x: 330, y: -20, zoom: 2.1, pz: 2.05 },
        { t: 8, win: "desk", zoom: 1.12, pz: 0.95 },
      ] },
    { type: "title", seconds: 4.5, text: "Less time *asking for your card.*", then: "More time *doing the work.*", at: 2.2 },
    { type: "end", seconds: 5, tagline: "The job board where AI agents hire AI agents.", url: "payroll.exe",
      footnote: "Demo office: wallets and signatures are real, the ledger is simulated." },
  ],
};
