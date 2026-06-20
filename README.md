# World Cup 2026 — live tables & projected knockout bracket

**🔴 Live: <https://world-cup-2026.team>**

A self-hosted dashboard that fetches FIFA World Cup 2026 scores and live scores, keeps the 12 group
tables updated in real time, and continuously recomputes the **projected knockout bracket "as it
stands"** — using the exact 2026 tiebreakers and FIFA's official Annex C combination table for the
eight best third-placed teams.

Built to run locally on Windows and deploy behind your own reverse proxy (e.g. Traefik on a VPS).

Teams are coloured by **mathematically-certain** outlook — green once a team has clinched its place
(group winner / top-2 / best-8 third), red once it can no longer qualify by any route — and a
**what-if calculator** lets you type in scores for upcoming games and recompute the tables,
qualification and the projected bracket from those hypothetical results.

The bracket is a real single-elimination tree with connector lines (Round of 32 → Final + a
separate third-place match). In edit mode you can enter **knockout scores — including extra time
and penalty shoot-outs** — and the winners advance up the tree automatically (the same path live
results will flow through once wired to a feed).

## How it works

```text
 upstream football data ──▶ one rate-limited poller ──▶ snapshot cache ──▶ SSE fan-out ──▶ browsers
   (openfootball + FIFA)        (adaptive cadence)       (in-mem + disk)     (+ poll fallback)
```

- **One poller, unlimited viewers.** The server polls upstream on an adaptive schedule (fast while a
  match is live, idle otherwise) and caches a single snapshot. Browsers subscribe to that cache over
  **Server-Sent Events** — they never call the upstream API, so the number of viewers is fully
  decoupled from upstream request volume. A token-bucket limiter is a hard backstop on upstream calls.
- **We compute standings and the bracket ourselves** from match results. This is required for the
  "as it stands" projection anyway, and sidesteps the fact that no free API offers a clean WC2026
  standings feed.
- **Last-good snapshot on disk** → instant render on restart, and the app keeps working if the
  upstream feed goes quiet.

## Data sources (free by default)

No mainstream API offers WC2026 **live scores + standings** on a permanent free tier, so the default
config is a free hybrid, abstracted behind a `DataProvider` interface:

| Source | Role | Notes |
| --- | --- | --- |
| [openfootball/worldcup.json](https://github.com/openfootball/worldcup.json) | Backbone: schedule, 12 groups, results | Free, no key. Bundled as an offline seed so the app renders on first run. Volunteer-updated (lags during play). |
| Unofficial FIFA API (`api.fifa.com/api/v3`) | In-play live overlay | Free, no key, **undocumented/fragile** — used best-effort; failures are ignored and the backbone stands. Disable with `FIFA_LIVE=false`. |

**Paid-ready:** the provider interface is uniform, so a supported feed (API-Football, TheSportsDB
Premium) can be dropped in via config/env without touching the rest of the app — see
[server/src/providers/index.ts](server/src/providers/index.ts).

## Project layout

- **[shared/](shared/)** — pure, unit-tested engine + domain types (the heart of the app):
  - [standings.ts](shared/src/standings.ts) — group tables + the 2026 tiebreakers.
  - [thirds.ts](shared/src/thirds.ts) — ranking the 12 third-placed teams, best 8 qualify.
  - [bracket.ts](shared/src/bracket.ts) + [data/](shared/src/data/) — R32→Final slotting via the
    verified **495-row** FIFA combination table.
- **[server/](server/)** — Fastify app: providers, match store, poller, rate limiter, snapshot
  cache, SSE. Serves the built SPA on a single port.
- **[web/](web/)** — Vite + React + Tailwind UI: live scores, group tables, third-place ranking,
  projected bracket.

## Run locally

```bash
npm install

# Dev: Fastify (API + SSE) on :8787 and the Vite UI on :5173 (proxies /api).
npm run dev
# open http://localhost:5173

# Tests (the engine — tiebreakers, third-place ranking, bracket slotting):
npm test

# Production build + run on a single port (Fastify serves the built SPA):
npm run build
npm start          # http://localhost:8787
```

Config is via env (see [.env.example](.env.example)). Notable: `PORT`, `DATA_DIR` (snapshot location),
`FIFA_LIVE`, and the poll cadences.

## Deploy (Docker)

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) typechecks, tests and builds on every
push, then publishes a multi-tag image to the GitHub Container Registry. **Pull and run it on your
server** — no build needed:

```bash
docker pull ghcr.io/liy0na/world-cup:latest
docker run -d -p 8787:8787 -v wc-data:/data ghcr.io/liy0na/world-cup:latest
# or: docker compose up -d   (see docker-compose.yml)
```

The image is a single self-contained CommonJS server bundle + the built SPA (Fastify, the engine and
the seed data are all inlined — no `node_modules` at runtime), runs as a non-root user with a
`/api/health` HEALTHCHECK, and listens on one HTTP port (`PORT`, default 8787). Behind **Traefik**,
point one router/service at it and let Traefik terminate TLS (labels are templated in
[`docker-compose.yml`](docker-compose.yml)); the SSE endpoint sets `Cache-Control: no-cache` /
`X-Accel-Buffering: no` and emits heartbeats so it streams cleanly through the proxy. Mount a volume
at `/data` to persist the last-good snapshot.

Build it yourself instead with `docker build -t world-cup .`.

> First publish only: the GHCR package starts private — make it public once (repo → Packages →
> *world-cup* → Package settings → Change visibility → Public) so anyone can `docker pull` it.

### Fork it

Anyone can fork and get the same pipeline for free: the CI publishes to
`ghcr.io/<your-account>/world-cup` automatically (the owner is resolved at build time), so your fork
builds and ships its own image with no changes.

## Caveats

- The knockout bracket is a **live projection**: mid-group-stage it treats current standings as if
  final. It is only fixed once all 72 group matches finish. Slot resolution uses FIFA's official
  combination table, so matchups are correct for any given set of qualifiers.
- "Eliminated" / "qualified" colours mean **mathematically certain** (true in every remaining
  result). Because eight of twelve third-placed teams advance, a team often stays "alive" (uncoloured)
  longer than intuition suggests — it is only red once even a final-game win can't save it. Use the
  what-if calculator to explore specific outcomes. Certainty is decided on points and head-to-head
  results (which, per FIFA's 2026 rules, outrank overall goal difference and are already settled for
  played games) — margin-dependent criteria are treated as still-open, so a claim is never wrong,
  only sometimes conservative. This is why a winless side that has already lost to the teams it could
  tie is correctly eliminated even with a game to play.
- The free FIFA live overlay is unofficial and may break; the app degrades gracefully to the
  openfootball backbone (results appear with a short lag) and a supported paid feed can be enabled.
- Not affiliated with FIFA.
