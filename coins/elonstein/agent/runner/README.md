# ELONSTEIN AGENT

A Solana memecoin trading agent. It trades on its own inside the budget you give it, never asks,
and only messages you when the money is gone: **“Boss. Need more SOL. Don't ask.”**

You configure it in the **Agent Lab** on the $ELONSTEIN site and download your
`elonstein-agent.config.json`. The site never sees your keys or your money: the agent runs on your
own computer or server.

## Run it (5 minutes)

1. Install [Node.js 18 or newer](https://nodejs.org).
2. Put `elonstein-agent.mjs`, `package.json` and your `elonstein-agent.config.json` in one folder.
3. In that folder run:
   ```bash
   npm install
   npm start
   ```
   It starts in **paper mode**: real market data, fake money. Watch it for a while.

## Go live

1. In the config set `"mode": "live"` and your `"budgetSol"`.
2. Start once: the agent creates **its own wallet** (`agent-wallet.json`) and prints the address.
   Send only the SOL you are fine losing to that address. Never use your main wallet.
3. Start it with the confirmation sentence:
   ```bash
   LIVE_CONFIRM="I accept that this agent can lose the entire budget." npm start
   ```
   (Windows PowerShell: `$env:LIVE_CONFIRM="I accept that this agent can lose the entire budget."; npm start`)

Optional: a private RPC is faster than the public one: `RPC_URL=https://... npm start`.

## Telegram (optional)

Create a bot with [@BotFather](https://t.me/BotFather), send it a message, then start with
`TELEGRAM_BOT_TOKEN=...` and `TELEGRAM_CHAT_ID=...`. The agent stays silent except when it is broke
or something breaks. Write `STATUS`, `STOP` or `START` to it.

## What it does

- Every `intervalSec` it checks its positions with Jupiter quotes and sells at take-profit or stop-loss
  (adjusted by personality).
- If there is budget left it picks a token: `trending` (DexScreener top boosts), `new` (latest
  profiles) or `elonstein-only`, filtered by liquidity and age, ranked by personality.
- It swaps through Jupiter. Budget = how much SOL it may lose in total; when that is gone, it stops
  and calls you.
- Files: `agent-state.json` (positions), `agent-log.jsonl` (every trade with its reason),
  `agent-wallet.json` (its key, live mode only — keep it private, back it up).

Memecoins can go to zero. This is a toy with real consequences in live mode. Not financial advice.
