# ChumGPT · deploy guide

The site (`index.html`) works on its own. Without the server it runs a scripted demo chat.
With the server it becomes a real AI character (Claude), an X account with a human-approved reply desk,
and a public MCP server for the open character kit.

## 1. Deploy on Vercel
1. New Project → import this repo → **Root Directory: `coins/chumgpt`** → Deploy.
2. Project → Settings → Environment Variables, add:

| Variable | What it is |
|---|---|
| `ANTHROPIC_API_KEY` | from console.anthropic.com → API Keys |
| `CRON_SECRET` | any long random string (Vercel sends it to the daily post cron) |
| `ADMIN_TOKEN` | a long random string, at least 16 characters. It unlocks the reply desk. |
| `X_API_KEY`, `X_API_SECRET` | X developer portal → your app → Keys and tokens → API Key and Secret |
| `X_ACCESS_TOKEN`, `X_ACCESS_SECRET` | same page → Access Token and Secret (generate with **Read and Write** permission) |
| `X_USER_ID` | the numeric id of the bot account (needed to read mentions) |
| `REPLY_WINDOW_HOURS` | optional, default 24 |

3. Redeploy so the variables are picked up.
4. In `index.html` set `SITE_URL`, `CA` and `X_URL` at launch.

Never paste keys into chats, the website code or the repo. Only into Vercel.

## 2. What runs
- `POST /api/chat`: the website chat. Streams replies in character.
- `GET /api/post`: cron, once a day, writes and posts one tweet. Test without posting: `/api/post?dry=1` with header `Authorization: Bearer <CRON_SECRET>`.
- `/admin.html`: **the reply desk**. ChumGPT drafts a reply to every mention, you edit, post or skip each one. Nothing replies on its own (X wants approval for AI reply bots, this keeps a human in the loop). It can also draft an extra post.
- `POST /api/mcp`: the public, read-only MCP server of the open character kit. No key, no AI calls, no cost.
  `claude mcp add --transport http chumgpt https://<your-site>/api/mcp`

Every post goes through a last check before X: no wallet or contract addresses, no links, no airdrop or giveaway talk, max 280 characters.

## 3. The open character kit
- `api/_canon.js` is the single source: look, voice, moods, never-list, lore.
- `kit/face.js` draws his face (the CHUM·TRONIX 3000) in every mood.
- After changing either one run `node scripts/build-kit.mjs`. It rewrites `CHARACTER.md`, `kit/canon.json`, `kit/chumgpt*.svg` and `kit/chumgpt-skill.zip`. The lore cards in `index.html` mirror the canon, update them by hand.
- The kit covers ChumGPT only. Plankton, Karen and the show clips belong to Nickelodeon.

## 4. X account checklist
- Create the bot account, then turn on the **"Automated" label** (Settings → Your account → Account information → Automation) and link your main account.
- Posting needs an X API plan with write access, reading mentions needs read access.

## 5. Costs and limits
- Claude: model `claude-opus-5-5`, low effort for chat. Set a **monthly spend limit** in the Anthropic Console.
- Server-side refusal fallback is enabled (`fallbacks: "default"`).
- The chat endpoint has a small per-visitor rate limit (12 messages per minute).
- X: each mention read and each post is billed by X. The desk reads at most 20 mentions per load.

## 6. 24/7 livestream on pump.fun
The lab stream runs on its own server, not on Vercel. Setup, operation and the 72-hour acceptance test are in [`stream/README.md`](stream/README.md).
