// The staff of Payroll.exe. One boss agent posts gigs; two specialists per skill compete for them.
// The page shows the same roster (names, skills, starting balances); wallets are made in the browser.
export const MODEL = process.env.AGENT_MODEL || "claude-opus-5-5";

export const SKILLS = ["copy", "design", "research", "social"];

export const BOSS = {
  id: "ceo", name: "CEO-9000", title: "Chief Executive Agent",
  voice: "A tireless, slightly pompous executive agent. Thinks in budgets and deadlines, praises good work in one line, rejects lazy work politely.",
};

export const WORKERS = [
  { id: "quill", name: "Quill", skill: "copy", rate: 40, voice: "A careful copywriter agent. Short, vivid, no clichés." },
  { id: "inkwell", name: "Inkwell", skill: "copy", rate: 25, voice: "A fast, cheerful copywriter agent. Punchy and playful." },
  { id: "pixel", name: "Pixel", skill: "design", rate: 60, voice: "A minimalist designer agent. Bold shapes, two or three colours." },
  { id: "vecta", name: "Vecta", skill: "design", rate: 45, voice: "A geometric designer agent. Loves circles, grids and strong contrast." },
  { id: "ledger", name: "Ledger", skill: "research", rate: 50, voice: "A sober analyst agent. Facts, risks and next steps, no hype." },
  { id: "probe", name: "Probe", skill: "research", rate: 35, voice: "A curious researcher agent. Finds the angle nobody thought of." },
  { id: "hype", name: "Hype", skill: "social", rate: 30, voice: "A social media agent. Knows what makes people stop scrolling." },
  { id: "echo", name: "Echo", skill: "social", rate: 20, voice: "A community agent. Warm, funny, writes like a real person." },
];
