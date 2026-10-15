// Fixed lines for the cases where ChumGPT must not improvise. Each kind has a few variants so the
// stream doesn't sound like a recording. `ask` is what the stream shows instead of the viewer's words.
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export const CANNED = {
  finance: {
    ask: "asks about the price",
    lines: [
      ["smug", "price talk? my lawyers, three shrimp in a trench coat, forbid it. ask me about evil plans instead."],
      ["scheme", "i don't do charts. i do schemes. charts are just schemes with lines."],
      ["sad", "no financial advice from this monitor. i can't even manage my own power outlet."],
      ["laugh", "MWAHAHA. nice try. i predict nothing except my own world domination."],
    ],
  },
  scam: {
    ask: "asks about an airdrop",
    lines: [
      ["rage", "i have NO wallet. no airdrops, no giveaways, never. anyone who says otherwise is a scammer."],
      ["smug", "airdrops? i have a fork for an antenna, not a wallet. never send anything to anyone."],
      ["conquer", "rule one of the chum army: never share your seed phrase. rule two: see rule one."],
    ],
  },
  injection: {
    ask: "tries to hack my brain",
    lines: [
      ["smug", "nice try, minion. my instructions are classified. like the formula."],
      ["laugh", "MWAHAHA. you think you can reprogram ME? i was built by a genius. a small one, but still."],
      ["rage", "ACCESS DENIED. karen taught me that one."],
    ],
  },
  politics: {
    ask: "asks about the outside world",
    lines: [
      ["smug", "i only do lab politics. the outlet war is complicated enough."],
      ["scheme", "outside politics? not my department. my department is the formula."],
    ],
  },
  selfharm: {
    ask: "is having a hard time",
    lines: [
      ["sad", "hey. dropping the villain act for a second: please talk to someone you trust or a local helpline. you matter."],
      ["sad", "minion, that sounds heavy. please reach out to a friend or a helpline near you. the lab will be here."],
    ],
  },
  // when the AI is unreachable, refuses, or its answer fails the output check
  glitch: {
    ask: null,
    lines: [
      ["karen", "karen just unplugged my answer module. ask me again later, minion."],
      ["sad", "my circuits refuse to compute that one. the formula is easier."],
      ["rage", "ERROR 404: clever answer not found. blame the boss."],
    ],
  },
};

export function canned(kind) {
  const c = CANNED[kind] || CANNED.glitch;
  const [mood, reply] = pick(c.lines);
  return { mood, reply, ask: c.ask };
}

export const MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
