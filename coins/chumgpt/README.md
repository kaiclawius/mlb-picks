# ChumGPT · deploy guide

The site (`index.html`) works on its own. Without the server it runs a scripted demo chat.
With the server it becomes a real AI character (Claude) and an X bot.

## 1. Deploy on Vercel
1. New Project → import this repo → **Root Directory: `coins/chumgpt`** → Deploy.
2. Project → Settings → Environment Variables, add:

| Variable | What it is |
|---|---|
| `ANTHROPIC_API_KEY` | from console.anthropic.com → API Keys |
| `CRON_SECRET` | any long random string (Vercel sends it to the cron endpoints) |
| `X_API_KEY`, `X_API_SECRET` | X developer portal → your app → Keys and tokens → API Key and Secret |
| `X_ACCESS_TOKEN`, `X_ACCESS_SECRET` | same page → Access Token and Secret (generate with **Read and Write** permission) |
| `X_USER_ID` | the numeric id of the bot account (needed for replies) |
| `REPLY_WINDOW_HOURS` | optional, default 24 |

3. Redeploy so the variables are picked up.

Never paste keys into chats, the website code or the repo. Only into Vercel.

## 2. What runs
- `POST /api/chat` – the website chat. Streams replies in character.
- `GET /api/post` – cron, once a day: writes and posts one tweet.
- `GET /api/replies` – cron, once a day: answers mentions from the last 24 h (max 10).
- Test without posting: call `/api/post?dry=1` with header `Authorization: Bearer <CRON_SECRET>`.

Vercel Hobby runs each cron once a day. For more posts per day use a Pro plan and change `vercel.json`.

## 3. X account checklist
- Create the bot account, then turn on **"Automated" label** (Settings → Your account → Account information → Automation) and link your main account.
- Posting needs an X API plan with write access; reading mentions (replies) needs a plan with read access.

## 4. Costs and limits
- Claude: model `claude-opus-5-5`, low effort for chat. Set a **monthly spend limit** in the Anthropic Console.
- Server-side refusal fallback is enabled (`fallbacks: "default"`).
- The chat endpoint has a small per-visitor rate limit (12 messages per minute).
