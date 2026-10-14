// Last guard before anything goes out on X: ChumGPT has no wallet, so a post never carries
// an address, a link or giveaway talk, and never runs past X's length limit.
const ADDRESS = /\b(0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})\b/;
const GIVEAWAY = /\b(airdrop|giveaway|presale|whitelist|send (me|us)|dm me)\b/i;
export function unsafeForX(text) {
  if (!text || !text.trim()) return "empty";
  if (text.length > 280) return "longer than 280 characters";
  if (ADDRESS.test(text)) return "contains something that looks like a wallet or contract address";
  if (/https?:\/\/|www\./i.test(text)) return "contains a link";
  if (GIVEAWAY.test(text)) return "mentions airdrops, giveaways or sending funds";
  return null;
}
