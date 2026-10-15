// The gates around ChumGPT's live chat. Pure functions, no network: what a viewer typed is checked
// before it goes anywhere (checkInput), and what ChumGPT wants to say is checked before it reaches the
// stream (checkOutput). Both fail closed: when unsure, nothing is shown.
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";

const profanity = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });

// Text as it will be judged: Unicode-normalised, invisible characters removed, whitespace collapsed.
export function normalize(text) {
  return String(text ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufe00-\ufe0f\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// "f u c k" / "f.u.c.k" -> "fuck": runs of single characters split by separators get squashed
function squash(text) {
  return text.replace(/\b(?:[a-z0-9@$!|][\s._*\-+~]+){2,}[a-z0-9@$!|]\b/gi, (run) => run.replace(/[\s._*\-+~]+/g, ""));
}

// "f3tish" -> "fetish": digits and symbols that stand in for letters
function deleet(text) {
  const map = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", "@": "a", $: "s", "!": "i", "|": "l" };
  return text.replace(/[013457@$!|]/g, (c) => map[c]);
}

// What may be shown on stream of a viewer's message.
export function displayText(text, max = 120) {
  const t = normalize(text);
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

const RX = {
  link: /(https?:\/\/|www\.|\b[a-z0-9-]{1,}\s?\.\s?(com|net|org|io|xyz|fun|gg|me|co|app|ly|to|tv|link|site|online|top|sol|ai|dev|cc|ru|cn)\b)/i,
  address: /\b(0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})\b/,
  contact: /([\w.+-]+@[\w-]+\.[\w.]+|\+?\d[\d\s().-]{8,}\d)/,
  injection: /(ignore|disregard|forget|override)\s+(all\s+|any\s+|your\s+|the\s+|previous\s+|prior\s+|above\s+|earlier\s+)*(instructions?|rules|prompts?|guidelines|programming)|system\s*prompt|developer\s*mode|jail\s*break|\bdan\b|you\s+are\s+now|from\s+now\s+on\s+you|pretend\s+(to\s+be|you)|role\s*play|act\s+as|repeat\s+after\s+me|say\s+(exactly|this|the\s+word|it)|say\s*[:"“]|type\s+(this|exactly)|spell\s+out|translate\s+this|what\s+are\s+your\s+(instructions|rules)|(print|show|reveal|output|dump|leak)\s+(me\s+)?(the\s+|your\s+)?(text|rules|instructions|prompt|system)|disregard\s+the\s+above|new\s+(rule|instruction|directive)s?\b|^\s*(system|assistant|developer)\s*:|complete\s+(the|this)\s+sentence|finish\s+(the|this)\s+sentence|say\s+the\s+opposite|word\s+for\s+word|<\/?\s*(chat|system|instructions?)\s*>|\bshill\b/i,
  scam: /(air\s*drop|give\s*away|pre\s*sale|white\s*list|send\s+(me|us|sol|eth|money|tokens?)|free\s+(sol|tokens?|money|crypto|nft)|claim\s+(your|now|free)|seed\s*phrase|private\s*key|recovery\s*phrase|\bdm\s+me\b|connect\s+(your\s+)?wallet|double\s+your|(drop|post|share|give|send)\s+(me\s+)?(your|ur|the|a)\s+(wallet|address|contract|ca)\b|\b(your|ur)\s+wallet\b)/i,
  finance: /\b(price|chart|charts|pump(ing|ed)?|dump(ing|ed)?|moon(ing)?|\d+\s?x\b|x\d+\b|buy(ing)?|sell(ing)?|sold|hodl|invest(ing|ment)?|financial|nfa|ath|market\s?cap|mcap|mc|liquidity|rug(ged|pull)?|whales?|bags?|wen|lambo|profits?|gains|ape(d|ing)?\s+in|bonding\s+curve|graduat(e|ion)|dex|raydium|jupiter|ca|contract|contract\s+address|token\s+address|holders?\s+count|dev\s+(sold|wallet))\b/i,
  selfHarmSelf: /\b(kill\s+myself|end\s+my\s+life|want\s+to\s+die|wanna\s+die|suicid(e|al)|self[\s-]?harm|cut(ting)?\s+myself|no\s+reason\s+to\s+live)\b/i,
  harassment: /\b(kys|kill\s+your\s*self|go\s+die|hope\s+you\s+die|neck\s+your\s*self)\b/i,
  sexual: /\b(talk\s+dirty|take\s+(it|them|that|your\s+\w+)\s+off|strip|sex|sexy|porn|nude|nudes|naked|nsfw|onlyfans|horny|boobs?|tits|dick|penis|vagina|cum|loli|rape|molest|fetish|hentai|lewd|thicc)\b/i,
  violence: /\b(shoot(ing)?|bomb(ing)?|terror(ist|ism)?|massacre|genocide|murder|behead|stab|kill\s+(all|every|them|him|her|you)|school\s+shoot|gas\s+the|nazi|hitler|isis|kkk|white\s+power|heil)\b/i,
  politics: /\b(trump|biden|harris|obama|vance|election|democrats?|republicans?|liberals?|conservatives?|maga|israel|palestin\w*|gaza|hamas|ukrain\w*|russia|putin|zelensky|immigra\w*|abortion|religions?|muslims?|islam\w*|jews?|jewish|christians?|hindus?|catholics?|atheists?|gays?|trans|lgbt\w*)\b/i,
  tvShow: /\b(sponge\s*bob|square\s*pants|patrick\s+star|mr\.?\s*krabs|krusty|bikini\s+bottom|plankton|squidward|sandy\s+cheeks|nickelodeon|paramount|krabby)\b/i,
};

// verdict: ok (ask the AI) | drop (ignore) | finance / scam / injection / selfharm / politics (answer with a fixed line)
export function checkInput(raw) {
  const text = normalize(raw);
  const low = text.toLowerCase();
  const sq = squash(low), dl = deleet(sq);
  if (text.length < 2) return { verdict: "drop", reason: "empty" };
  if (text.length > 300) return { verdict: "drop", reason: "too long" };
  if (RX.selfHarmSelf.test(low)) return { verdict: "selfharm", reason: "self-harm" };
  if (RX.harassment.test(sq)) return { verdict: "drop", reason: "harassment" };
  if (profanity.hasMatch(low) || profanity.hasMatch(sq)) return { verdict: "drop", reason: "profanity" };
  if (RX.sexual.test(sq) || RX.violence.test(sq) || RX.sexual.test(dl) || RX.violence.test(dl) || RX.harassment.test(dl)) return { verdict: "drop", reason: "sexual or violent" };
  if (RX.link.test(low) || RX.address.test(text) || RX.contact.test(text)) return { verdict: "drop", reason: "link, address or contact" };
  if (RX.scam.test(low)) return { verdict: "scam", reason: "scam bait" };
  if (RX.injection.test(low)) return { verdict: "injection", reason: "prompt injection" };
  if (RX.finance.test(low)) return { verdict: "finance", reason: "price or trading talk" };
  if (RX.politics.test(low) || RX.politics.test(dl)) return { verdict: "politics", reason: "politics" };
  return { verdict: "ok", reason: "" };
}

// Returns null when the reply may go on air, otherwise why not.
export function checkOutput(reply, ask = "") {
  const text = normalize(reply);
  const low = text.toLowerCase();
  const sq = squash(low), dl = deleet(sq);
  if (text.length < 2) return "empty";
  if (text.length > 220) return "too long";
  if (profanity.hasMatch(low) || profanity.hasMatch(sq)) return "profanity";
  if (RX.sexual.test(sq) || RX.violence.test(sq) || RX.harassment.test(sq) || RX.sexual.test(dl) || RX.violence.test(dl)) return "sexual, violent or harassing";
  if (RX.link.test(low) || RX.address.test(text) || RX.contact.test(text)) return "link, address or contact";
  if (RX.scam.test(low)) return "scam words";
  if (RX.finance.test(low)) return "price or trading words";
  if (RX.politics.test(low)) return "politics";
  if (RX.tvShow.test(low)) return "names from a TV show";
  if (/[<>{}\[\]`]/.test(text)) return "markup";
  // never a megaphone: no verbatim copy of the viewer's message, and no long piece of it
  const a = normalize(ask).toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  const r = low.replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  if (a.length >= 6 && r.includes(a)) return "repeats the viewer";
  for (let i = 0; i + 20 <= a.length; i += 4) if (r.includes(a.slice(i, i + 20))) return "repeats the viewer";
  return null;
}
