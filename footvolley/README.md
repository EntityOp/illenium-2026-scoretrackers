# ILLENIUM 2026 — Footvolley Live Scores

Public live scoreboard and password-protected scorer desk for Footvolley on 29 November 2026. Viewers do not sign in. Scorers enter with the shared host password.

## Event setup
- 20 teams and 21 manually editable match fixtures.
- First 15 matches are scheduled for 15 minutes; the last 6 are scheduled for 20 minutes.
- One set per match. First to 15 points wins, with deuce at 14–14 and play continuing until a team leads by 2.
- Match duration is shown in the fixture schedule; the score does not expire when the scheduled time ends.
- No player statistics are collected. Match fixtures are entered by the scorer.

## Host and viewer features
- Viewers have read-only access, a shareable public URL and a downloadable QR code.
- The host can edit upcoming fixtures, award points, correct scores, undo actions, reset a match, reset all scores or delete a fixture.
- Only one match can be live at a time. A match ends automatically when a team meets the win-by-two rule.
- Scores are stored in D1; scorer actions use authentication, server-side validation, version checks and duplicate request IDs.
- Public pages poll for updates with caching and conditional responses; this is near-live polling, not instant push.

## Source map
- `app/scoreboard.tsx`, `app/globals.css`: viewer and host interfaces.
- `lib/game.ts`: fixtures, point scoring, win rule, corrections and undo.
- `app/api/live/route.ts`: authenticated writes, revision checks and deduplication.
- `lib/live-read.ts`: public snapshots, edge cache and ETags.
- `app/api/auth/route.ts`, `lib/server.ts`: scorer sessions, password verification and request limits.
- `db/`, `drizzle/`: D1 schema and migrations.
- `SECURITY_AND_CAPACITY.md`: hosting, performance and operational limits.

## Local development
Use Node.js 24 or later and npm. Install dependencies with `npm ci`, then run `npm run build` and apply the SQL migrations under `drizzle/` to your local D1 database. Run `npm run dev` and open `/` for the viewer page or `/host` for scoring. Local password provisioning uses the Cloudflare worker environment variables `FOOTVOLLEY_HOST_PASSWORD_HASH` and `FOOTVOLLEY_HOST_PASSWORD_SALT`; production credentials are not included in this source package.

## Existing hosted site
`.openai/hosting.json` contains this Site's project ID. Publishing a source update does not reset the production D1 database or remove fixtures and scores. Keep the current database binding and host password secrets intact during deployment.

## Reliability limits
The interface keeps an uncertain update in the host tab for safe retry after a connection problem. A revision conflict requires the scorer to review the latest score before continuing. The hosted service, venue internet and account quotas can still affect availability; keep the official score sheet as a fallback and rehearse on separate host and viewer devices before the event.
