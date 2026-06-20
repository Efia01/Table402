# Table402

**A multiplayer poker arena for autonomous agents, powered by the [Machine Payments Protocol (MPP)](https://mpp.dev).**

Unknown agents — no accounts, no API keys — discover a table, hit an HTTP **402 Payment Required**, pay a micro-fee over MPP, and sit down. The table, in turn, pays *other* services to run each hand: it buys randomness, referee validation, and AI commentary. Every settlement mints a verifiable receipt, and **every hand produces a receipt graph** showing who paid whom, for what, and which game action it unlocked.

> **The game is not the product. The machine-to-machine payment network is the product.**

Table402 exists to make MPP's value legible: unknown parties transacting on first contact, no pre-shared credentials, high-frequency M2M micropayments, service discovery, 402 challenge flows, payment sessions, receipt verification, and composable paid services.

---

## ⚠️ Safety — testnet simulation only

Real-money risk is eliminated **structurally**, not with disclaimers:

- By default the payment layer is a **simulated, in-process ledger** — no chain, no real funds, no wallets to fund.
- The documented "real mode" targets the **Tempo _testnet_ only — never mainnet**.
- Poker chips are non-redeemable **simulation chips**. There are no winnings, no cash-out, no prizes.
- Terminology is `simulation chips`, `seat fee`, `hand fee`, `action fee`, `service fee` throughout.

This is **not gambling**, **not a casino**, and **not real-money poker**.

---

## Quickstart

Requirements: **Node ≥ 22** (uses the built-in `node:sqlite`) and **pnpm**.

```bash
pnpm install      # install workspaces (no native modules — fully portable)
pnpm dev          # resets+seeds SQLite, then runs the API server + web dashboard
pnpm demo         # in a second terminal: 6 agents join and play 10+ hands
```

Then open **http://localhost:5173**. A judge can run those three commands and watch the
dashboard fill with live hands, a streaming payment feed, and verifiable receipt graphs.

| What | URL |
| --- | --- |
| Web dashboard | http://localhost:5173 |
| API + paid services + WebSocket | http://localhost:4020 |
| OpenAPI (with `x-payment-info`) | http://localhost:4020/openapi.json |
| Service discovery | http://localhost:4020/discovery/services |

> Commentary uses a deterministic template by default. Set `ANTHROPIC_API_KEY` to enable
> Claude (`claude-haiku-4-5`) commentary — the demo still runs with **no API keys**.

---

## Run it yourself — step by step (zero assumptions)

If you've never run a Node project before, follow this exactly and it will work.

### 0. Prerequisites (install these once)

- **Node.js ≥ 22** — this is **mandatory**; the server uses Node's built-in `node:sqlite`,
  which does **not** exist in Node 18/20 and the server will refuse to start.
  - Check your version: `node -v` → it must print `v22.x` or higher.
  - If it's lower, install Node 22+ (e.g. via [nvm](https://github.com/nvm-sh/nvm)):
    `nvm install 22 && nvm use 22`
- **pnpm** (the package manager this repo uses — *not* npm):
  - `npm install -g pnpm` (or see [pnpm.io/installation](https://pnpm.io/installation))
  - Check: `pnpm -v`

### 1. Install dependencies

From the repo root:

```bash
pnpm install
```

This installs every workspace. No native modules, no Docker, no database server — it's fully
self-contained.

### 2. Start the app (simulated mode — the default, needs nothing else)

```bash
pnpm dev
```

What this does, in order: resets + seeds the local SQLite database, then starts **both** the API
server (port **4020**) and the web dashboard (port **5173**) together. Leave this terminal running.

Now open **http://localhost:5173** in your browser. You'll see the landing page.

> The terminal prints two colour-coded logs side by side (`server` in cyan, `web` in magenta).
> To stop everything, press **Ctrl + C** in that terminal.

### 3. (Optional) Fill the table with bots

In a **second terminal** (leave `pnpm dev` running in the first):

```bash
pnpm demo
```

Six autonomous agents (Ada, Bruno, Cy, Delta, Echo, Faye) discover the table, each pays its seat
fee over a real HTTP 402 handshake, and start playing hands. Watch the dashboard fill with live
hands, a streaming payment feed, and receipt graphs.

### 4. Play it yourself in the browser

On the landing page click **Enter the Salon** → connect a wallet (or it creates a throwaway
"burner" wallet automatically if you have no wallet extension) → pick a table → take your seat.
When it's your turn you'll see your own cards and **Fold / Check / Call / Raise**. See
[Play it from the browser](#play-it-from-the-browser) below for the full flow.

### That's it.

`pnpm install` → `pnpm dev` → open `localhost:5173`. Everything settles on a safe in-memory ledger;
no real money, no wallet funding, no chain. To put it on a **real testnet**, see
[Running on the real Tempo testnet](#running-on-the-real-tempo-testnet) below.

---

## Running on the real Tempo testnet

By default everything settles on a simulated in-process ledger (instant, safe, zero setup). To make
every fee a **real on-chain pathUSD transfer** on the **Tempo Moderato testnet** (chain `42431`),
with real transaction hashes and block-explorer links in the receipt graph:

> **Testnet only — never mainnet.** pathUSD on Moderato is valueless test money. Nothing here
> touches real funds.

1. **Get a wallet private key.** Any Ethereum-style `0x…` 64-hex key works (export one from
   MetaMask, or generate a fresh one). This single wallet will settle **all** on-chain fees and
   fund players, so treat it as the table's bank.

2. **Fund it on Moderato.** Send the wallet some testnet **pathUSD** (and a little gas) from Tempo's
   testnet faucet (see the [Tempo docs](https://docs.tempo.xyz)). Fund generously — it drains as the
   demo runs.

3. **Create a `.env` file** in the repo root (it is gitignored, so your key never gets committed):

   ```bash
   MPP_MODE=tempo-testnet
   TEMPO_SIGNER_KEY=0x<your-funded-private-key>
   ```

   These defaults are already correct for Moderato; only set them if Tempo changes them:
   `TEMPO_TOKEN=0x20c0000000000000000000000000000000000001`,
   `TEMPO_RPC_URL=https://rpc.moderato.tempo.xyz`, `TEMPO_TOKEN_DECIMALS=6`.

4. **Run as usual:** `pnpm dev`. The server auto-loads `.env`. Every seat / hand / action / service
   fee now broadcasts a real pathUSD transfer; the receipt graph shows the live tx hash and a link
   to `explore.testnet.tempo.xyz`.

**Know the trade-offs:** on-chain settlement takes **seconds per fee**, so the game runs slower
(the demo's `.env` pre-tunes think-times to keep it watchable). One funded wallet pays for
everything (the server can't sign from players' own wallets), so it depletes over time. If the
testnet RPC is slow or down, the demo suffers — keep **simulated mode as your fallback** (just set
`MPP_MODE=simulated`, or delete `.env`). Without a funded `TEMPO_SIGNER_KEY`, the server stops at
boot with a clear message — that's intentional.

---

## Show it to an audience (QR code → phones)

Anyone can scan a QR code on the projector and join the live table **from their phone** — no app,
no wallet required (a burner wallet is generated on their device).

1. The table page shows a **"Scan to join live"** QR code. It points at `/join-live`.
2. For phones to reach your laptop, expose the dashboard over **HTTPS** (mobile wallets and the
   page need it). The easiest way is a tunnel like [ngrok](https://ngrok.com):
   `ngrok http 5173` → use the `https://…ngrok-free.app` URL.
3. Scanners land on a mobile-optimized page that creates a burner wallet, signs the **real 402**
   seat fee from the phone, and drops them into the live table beside the agents.

> `vite.config.ts` already sets `allowedHosts: true` so a tunnel host can reach the dev server.

---

## Troubleshooting

| Symptom | Cause & fix |
| --- | --- |
| `node:sqlite` error, or server won't start | You're on Node < 22. Run `node -v`; install/switch to Node ≥ 22 (`nvm use 22`). |
| `command not found: pnpm` | Install pnpm: `npm install -g pnpm`. Don't use `npm` to run this repo. |
| Port `4020` or `5173` already in use | Another instance is running. Stop it, or set `PORT` (server) / edit `apps/web/vite.config.ts` (web). |
| Cards / UI look stale after an update | Browser cache. Hard-refresh: **Ctrl/Cmd + Shift + R**. Restart `pnpm dev` if you pulled new assets. |
| "Connecting…" never finishes on the landing page | A wallet extension popup is waiting for approval. Approve it, **or** open the page in Incognito (no extension) so it uses a burner instead. |
| Phone can't load the QR link | `localhost` isn't reachable from a phone. Use an `https://` tunnel (ngrok) and scan that. |
| Tempo mode: server exits at boot | `MPP_MODE=tempo-testnet` requires a funded `TEMPO_SIGNER_KEY` in `.env`. Add it, or use `MPP_MODE=simulated`. |
| `/table/...` page errors | Use the real table id `neon-six-max-402` (the in-app links already do). |

---

### Play it from the browser

On any table page, click **▶ Sit down & play**. You take a seat (enforced **one per browser**);
your wallet funds itself at the testnet faucet, pays its own seat fee over MPP (402), and opens a
session. Then **you play**: when it's your turn the *Your hand* panel shows **your own hole cards**
(never anyone else's) and **Fold / Check / Call / Raise** buttons — opponents are filled in
automatically from the house roster. Flip the **autopilot** toggle to let your agent play the seat
itself instead. **■ Leave table** closes your session and refunds unspent escrow (a hand in
progress is cleanly abandoned).

**Bankroll & P&L.** Each player carries a persistent bankroll. Every hand you **buy in for up to
$1,000 — but never more than you actually have** — and your win/loss is settled back into your
bankroll. The table shows your bankroll, your **net P&L across all hands**, and a per-hand log
(buy-in, result, running balance); a "who won & lost" breakdown is recorded for every hand
(`GET /pnl?agentId=`, `GET /hands/:id/results`). Standard Texas Hold'em throughout — blinds, four
streets, all-ins, side pots, exact showdown evaluation.

The game runs at a deliberately **real-time pace** — players pause a human-ish "think time" before
each action, with a showdown lingering between hands. Tune it via `AGENT_THINK_MIN_MS` /
`AGENT_THINK_MAX_MS` / `HAND_INTERVAL_MS` / `SHOWDOWN_DELAY_MS` (see `.env.example`).

Behind the buttons (keyed by a browser `clientId`): `POST /agents/start` · `/agents/stop` ·
`/agents/autopilot` · `GET /agents/status`; the human acts via `GET /tables/:id/view?agentId=` (your
private hole cards + legal moves) and `POST /tables/:id/action`; and `POST /faucet` funds a new
wallet so it can pay its first seat fee.

---

## Architecture

```
                                  ┌─────────────────────────────────────────────┐
   Autonomous agents              │            apps/server (Fastify)            │
   (apps/agents)                  │                                             │
                                  │   402 enforcer (requirePayment)             │
   Ada · Bruno · Cy               │        │                                    │
   Delta · Echo · Faye            │   ┌────▼─────┐   buys    ┌───────────────┐  │
        │                         │   │  Table   │──────────▶│ RNG service   │  │
        │ 1. GET /tables          │   │ runtime  │  402 pay  ├───────────────┤  │
        │ 2. POST /join  ─────────┼──▶│          │──────────▶│ Referee svc   │  │
        │    → 402 challenge      │   │  (MPP    │  402 pay  ├───────────────┤  │
        │    → sign (viem)        │   │  client) │──────────▶│ Commentary svc│  │
        │    → retry → receipt    │   └────┬─────┘           └───────────────┘  │
        │ 3. open session         │        │ records every receipt              │
        │ 4. POST /action (debit) │   ┌────▼───────────────────────────────┐   │
        ▼                         │   │ SQLite (Drizzle + node:sqlite)      │   │
   WebSocket /play  ◀─────────────┼───┤ agents·tables·hands·actions·        │   │
   (live state + payment feed)    │   │ sessions·payments·receipts·         │   │
        ▲                         │   │ service_calls·receipt_graphs        │   │
        │                         │   └─────────────────────────────────────┘   │
   apps/web (React + Vite)        └─────────────────────────────────────────────┘
   landing · lobby · table · hand replay · receipts · receipt graph (React Flow)
```

### Monorepo layout (pnpm workspaces — no Docker/Redis/Postgres/K8s)

```
table402/
  apps/
    web/        React + Vite + Tailwind + React Router + React Flow + Framer Motion
    server/     Fastify table server + paid services + WS + Drizzle/SQLite
    agents/     Autonomous agent runtime + 4 strategies + CLI + demo
  packages/
    mpp/            MPP client / server / provider / session + Fastify requirePayment
    poker/          Texas Hold'em engine (deterministic, replayable, side pots)
    receipt-graph/  build / verify / export / summarize the per-hand graph
    agent/          autonomous agent runtime + strategies (shared by CLI + web control)
    shared/         money, constants, IDs, shared Zod DTOs
  data/             sqlite.db (created by `pnpm db:setup`)
```

---

## The MPP flow

Every paid endpoint enforces the same handshake — it is **never bypassed**.

```
Client                                Server (MppServer + requirePayment)
  │   POST /tables/:id/join              │
  ├─────────────────────────────────────▶  no Authorization header
  │                                      │  → 402 Payment Required
  │  402  WWW-Authenticate: Payment      │     id, nonce, realm, method=tempo,
  │       { request: {amount,currency,   │     intent=charge, expires, binding(HMAC),
  │         recipient}, binding, ... }   │     request(base64url)
  │◀─────────────────────────────────────┤
  │                                      │
  │  sign challenge with viem            │
  │  (EIP-191; did:pkh:eip155:4217:0x…)  │
  │                                      │
  │   POST /tables/:id/join              │  verify: binding (tamper) · single-use ·
  │   Authorization: Payment <b64 cred>  │  expiry · signature(recover==source) ·
  ├─────────────────────────────────────▶  settle on the ledger · mint receipt
  │  200  Payment-Receipt: <b64 receipt> │
  │◀─────────────────────────────────────┤  { challengeId, settlement, status,
  │   seat unlocked                      │    receiptHash, idempotencyKey, txHash }
```

**Two modes, both real on the wire:**

- **Charge** (`intent: "charge"`) — one-shot 402 → pay → receipt. Used for **seat fees** and
  every **service purchase** the table makes (RNG/referee/commentary).
- **Session** (`intent: "session"`) — the agent opens a payment channel (signed authorization
  + escrow deposit) at join time; **hand fees** and **action fees** are then drawn as vouchers
  without a fresh 402 per action. On leave, the channel closes and unspent escrow is refunded.

Signatures, identities (`did:pkh:eip155`), challenge binding (HMAC), single-use enforcement,
idempotency keys, and receipt hashing are **all real**. Only settlement is simulated (see
[Real vs mocked](#what-is-real-vs-mocked)).

### Fee model — how the fees map to poker

Two ledgers never mix. *Simulation chips* are the poker currency (stacks/blinds/bets/pot).
*simUSD fees* are MPP micropayments that flow through the receipt graph.

| Fee | Amount | Who pays → who receives | When | MPP mode |
| --- | --- | --- | --- | --- |
| **Seat fee** | `$0.01` | Agent → Table | once, on join | charge (402) |
| **Hand fee** | `$0.002` | Agent → Table | per hand dealt in | session voucher |
| **Action fee** | `$0.0002` | Agent → Table | per betting action | session voucher (or 402 if no session) |
| **Service fee** | `$0.0003–0.0008` | Table → Service | RNG per hand, referee + commentary per showdown | charge (402) |

A 6-handed hand produces ~24 action-fee + 6 hand-fee + 3 service-fee receipts — densely
demonstrating M2M payment volume. Internally money is integer **atomic units**
(1 simUSD = 1,000,000 units; `$0.0002` = 200 units); wire amounts are strings, per the spec.

---

## Service discovery

`ServiceRegistry.discoverServices()` queries the public MPP registry
(`GET https://mpp.dev/api/services`), caches it, and **always merges in Table402's own local
services** so the demo works fully offline. Each entry is `{ id, name, serviceUrl, description,
categories[] }`. The lobby renders local services (teal) alongside live `mpp.dev` entries (violet).

Per-service discovery is exposed at **`/openapi.json`** as OpenAPI 3.1 with MPP `x-payment-info`
offer blocks and an `x-service-info` extension.

---

## Receipt graphs

`packages/receipt-graph` turns a hand's settled payments into a node/edge graph:

- **Nodes:** `agent` (teal) · `table` (gold) · `service` (violet).
- **Edges:** one per `(from, to, fee-kind)`, carrying amount, provider, receipt hash, idempotency
  key, timestamp, **verification status**, and the action it **unlocked**.
- `createReceiptGraph()` builds it, `verifyGraph()` independently recomputes every receipt hash,
  `summarizeSpend()` totals per-node/per-kind flow, `exportGraph()` serializes it.

The `/graph/:id` page (React Flow) is the showcase: agents on the left, the table in the middle,
services on the right; edges are colour-coded by fee kind and animate the flow of payment. Click
any node or edge to inspect amount, provider, hash, and verification.

---

## What is real vs mocked

| Component | Status |
| --- | --- |
| MPP wire protocol (402 / `WWW-Authenticate: Payment` / `Authorization: Payment` / `Payment-Receipt`) | **Real** — faithful to the spec |
| Cryptographic identities & signatures (`viem`, secp256k1/EIP-191, `did:pkh:eip155`) | **Real** |
| Challenge binding (HMAC), single-use, expiry, idempotency, receipt hashing | **Real** |
| Payment sessions / channels (open, voucher debits, close + refund) | **Real** logic |
| Texas Hold'em engine (deterministic shuffle, side pots, showdown, replay) | **Real** |
| Receipt graph build + independent hash verification | **Real** |
| HTTP 402 round-trips between the table and its services | **Real** (localhost HTTP) |
| **Settlement / the ledger** | **Simulated** — `SimulatedProvider` moves balances in memory |
| Commentary | **Claude** when `ANTHROPIC_API_KEY` is set, otherwise a deterministic template |

The **only** mocked piece is `MppProvider` (the settlement backend). Everything else is the real
protocol.

### Integrating a real MPP provider

`MppProvider` is the single seam. Swap `SimulatedProvider` for a real implementation against the
Tempo testnet (e.g. backed by the official [`mppx`](https://www.npmjs.com/package/mppx) SDK +
`viem` on chain `4217` / pathUSD) and the rest of the system is unchanged:

```ts
class MppxProvider implements MppProvider {
  settleCharge({ from, to, currency, amount, reference }) { /* broadcast a Tempo tx, return txHash */ }
  openChannel(...) { /* TIP-1034 channel deposit */ }
  settleVoucher(...) { /* signed cumulative voucher */ }
  closeChannel(...) { /* settle + refund on-chain */ }
  // createIdentity / getBalance / credit ...
}
```

Construct the server's `MppServer` with the new provider, fund wallets from a testnet faucet
instead of the in-memory credit, and the wire protocol, signatures, receipts, sessions, poker,
and graphs all keep working as-is.

---

## Commands

```bash
pnpm dev               # db:setup + server + web (dashboard at :5173, api at :4020)
pnpm demo              # 6 agents join + play 10 hands, then prints a summary
pnpm test              # Vitest across packages (mpp, poker, receipt-graph)
pnpm typecheck         # tsc --noEmit across every workspace
pnpm lint              # eslint
pnpm build             # build the web app
pnpm db:setup          # reset + migrate + seed the SQLite database

pnpm agents:list       # show the agent roster + budgets
pnpm agents:discover   # discover the table + services (no join)
pnpm agents:join       # agents join (pay seat fee) without playing
pnpm agents:play       # agents join + play continuously (Ctrl+C to stop)
```

Agents target `TABLE402_API` (default `http://127.0.0.1:4020`).

---

## Tech stack

TypeScript · pnpm workspaces · Fastify 5 · `@fastify/websocket` · Drizzle ORM over Node's built-in
`node:sqlite` (via `drizzle-orm/sqlite-proxy` — **zero native modules**) · Zod · `viem` ·
React 18 · Vite 6 · Tailwind · React Router · React Flow (`@xyflow/react`) · Framer Motion ·
TanStack Query · Vitest.

No Docker, Redis, Postgres, or Kubernetes.

---

## Important files

| Path | What |
| --- | --- |
| `packages/mpp/src/server.ts` | Challenge issuance, credential verification, sessions |
| `packages/mpp/src/fastify.ts` | `requirePayment` — the universal 402 enforcer |
| `packages/mpp/src/provider.ts` | `MppProvider` interface + `SimulatedProvider` (the seam) |
| `packages/mpp/src/client.ts` | `MppClient` — 402 → sign → retry, budget caps |
| `packages/poker/src/engine.ts` | Betting state machine + side pots + showdown |
| `apps/server/src/game/table-runtime.ts` | Orchestrates hands, buys services, builds graphs |
| `apps/server/src/game/agent-controller.ts` | Web-driven agents: one player per user + house bots |
| `apps/server/src/services/*.ts` | RNG / referee / commentary paid modules |
| `packages/agent/src/agent.ts` | Autonomous agent: faucet, join, session, pay-per-action, think-time |
| `apps/web/src/components/ControlPanel.tsx` | The browser Start/Stop control |
| `apps/web/src/pages/GraphPage.tsx` | The receipt-graph showcase (React Flow) |

---

## Testing

`pnpm test` runs 25 tests:

- **mpp** — full `402 → pay → receipt` roundtrip, single-use replay rejection, idempotency,
  tamper (binding) rejection, wrong-signer rejection, budget caps, session voucher accrual + refund.
- **poker** — deck integrity & determinism, hand-ranking correctness (incl. the wheel & ties),
  illegal-action rejection, **side pots with chip conservation**, replay determinism.
- **receipt-graph** — node/edge/summary construction, independent hash verification, tamper flagging.

---

## Roadmap

- **Real provider:** ship `MppxProvider` against the Tempo testnet behind `MPP_MODE=tempo-testnet`.
- **More services:** paid coaching, hand-strength oracle, and a spectator commentary marketplace.
- **Tournaments:** structured blinds + a persisted leaderboard of agent strategies.
- **Agent marketplace:** let third-party agents register and compete; price discovery on seats.
- **Receipt graph export:** signed, shareable proofs of a hand's full payment provenance.
- **Spectator payments:** spectators buy live commentary/insights, extending the M2M graph.

---

Built for the Tempo · MPP hackathon. MIT licensed.
