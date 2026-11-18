# ILLENIUM — Spin & Swing Live Cricket

Public scoreboard and protected scorer desk for 28 November 2026. All 15 cricket fixtures retain their original IDs and times, including the 13:00–13:30 lunch break. Existing hosted cricket scores/team names survive this upgrade.

## Included
- 8 players, minimum 2 girls; at least 1 girl on the field throughout.
- Five overs / seven wickets per innings; no last batter continuation.
- Runs 0–6 and +12; wides/no-balls add one automatically and are rebowled; optional batting runs can be entered.
- Repeat Super Overs (six legal balls / two wickets) after ties.
- Mandatory third-over target with immediate settlement, wicket penalties, undo and corrections.
- Dark scoreboard, sharing link/QR, fixtures, results and mobile layout.
- Durable database state, host passwords/sessions, server validation, bounded requests, throttling, optimistic concurrency and idempotent retries.

## Third-over declaration: exact semantics
At exactly 2.0 overs in either regular innings, the scorer must lock a positive target before scoring the next delivery. There is no skip or normal-over option. The target is unavailable in Super Overs. Existing innings already past 2.0 are not changed retroactively.

Runs earned during an active declaration count toward the fixed target. The scorer enters runs apart from the automatic wide/no-ball penalty; the server adds one run and does not count that delivery as legal. Each wicket subtracts 5 from the overall innings score, but does not reduce progress toward the target.

Reaching or exceeding the target credits exactly 2 × the declared target, even if the final delivery overshoots it. The third over ends immediately; its unused legal deliveries are skipped and the display shows the actual point in the over (for example, 3.1 after one legal ball). If six legal deliveries finish without success, the over earns zero. All-out or manually ending the innings before success also earns zero for the declaration over. Wickets are never erased. In a chase, only credited runs determine victory, so pending runs cannot cause a premature win.

Undo restores the complete prior state, including declaration, runs, wickets, balls and innings status. During an active declaration, use Undo to correct a delivery. After settlement, the scorer can adjust the overall total while preserving the betting over’s recorded wickets and ball position; use Undo before changing those delivery records.

## Source map
- `app/scoreboard.tsx`, `app/globals.css`: viewer/host UI and dark theme.
- `lib/game.ts`: fixtures, scoring, declaration settlement and undo.
- `app/api/live/route.ts`: authorised mutations, revision checks and request deduplication.
- `lib/live-read.ts`: public snapshots, edge cache, conditional responses.
- `app/api/auth/route.ts`, `lib/server.ts`: passwords, sessions and owner checks.
- `lib/http-security.ts`, `worker/index.ts`: request limits, headers and public fast path.
- `db/schema.ts`, `drizzle/`: D1 schema and migrations.
- `tests/`: scoring/security tests and bounded API load test.
- `scripts/set-host-password.mjs`: local/self-managed password provisioning.
- `scripts/prepare-cloudflare.mjs`: standalone deployment configuration.

## Requirements
Node.js 24, npm, a browser, and Cloudflare Workers + D1 for deployment. Python 3 with aiohttp is needed only for the optional load test. No production credentials, passwords, sessions or database content are included. The artwork and QR are included; regenerate the QR if you change the public URL.

## Run locally
1. Extract this package and enter the project directory.
2. Run `npm ci`. If your runtime cannot fetch the pinned Vinext build, use `npm run install:ci`, which is the included verified installer.
3. Run `npm run build` to produce `dist/server/wrangler.json`.
4. Apply each migration in filename order (only once per database):

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_salty_mikhail_rasputin.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_panoramic_rage.sql
```

5. Set a local test password, without putting it in source or shell history (Bash):

```sh
read -r -s -p 'Host password (10+ characters): ' task_password
printf '\n'
printf '%s' "$task_password" | node scripts/set-host-password.mjs --local
unset task_password
npm run dev
```

Open the URL printed by the dev server. Use `/host` and the password you set. For a production-build local check, use `npm start` after building. Hosted and local databases are separate. Sites owner sign-in is only available on the hosted Site; use the CLI provisioner locally.

## Existing Sites deployment
The included `.openai/hosting.json` identifies the existing Site. Do not change it to another project's ID. Sites publication uses the tracked source, the build output and the schema migrations, and preserves the hosted database. The configured `OWNER_EMAIL` secret enables owner-only password setup through Sites' trusted ChatGPT identity headers. Scorers use the shared password; viewers do not sign in.

## Deploy to your own Cloudflare account
Use a Workers Paid account for this event's expected sustained traffic. These steps create a separate installation with a new empty database, not a copy of live scores.

1. Authenticate: `npx wrangler login`.
2. Create D1: `npx wrangler d1 create spin-swing`. Record the returned database ID.
3. Build: `npm run build`.
4. Generate standalone config: `node scripts/prepare-cloudflare.mjs spin-swing YOUR_DATABASE_ID`.
5. Apply the two SQL files above with `--remote --config dist/server/wrangler.standalone.json` instead of local flags. Ensure this is the intended new database before running them.
6. Provision a host password using the same hidden prompt above, but run `node scripts/set-host-password.mjs --remote dist/server/wrangler.standalone.json`.
7. Deploy: `npx wrangler deploy --config dist/server/wrangler.standalone.json`.
8. Open the returned HTTPS URL, verify anonymous viewing and `/host` login, then update the sharing QR for the new URL.

The generated standalone config sets `AUTH_MODE=standalone`, disabling owner authentication based on Sites-only headers. Keep it set. Do not configure OWNER_EMAIL as a way to trust arbitrary internet headers. Password provisioning/reset for standalone hosting is through the database-owner CLI. You may add a verified identity provider later.

Rebuild/regenerate the standalone config after source changes. Keep database IDs stable; apply only pending migrations. Do not delete or re-create a live event database to deploy UI changes.

## How updates work
A scorer submits one action with the last seen revision and a random request ID. The server checks the session, origin, rate limit, input and cricket rules; then atomically updates the database only if the revision still matches. Recently committed request IDs prevent duplicate scoring when a request is retried. Responses update the host immediately.

Spectators poll roughly every 3–3.5 seconds with jitter. A two-second edge cache and coalesced reads shield the database; a compact public snapshot excludes undo records. ETags yield empty 304 responses when nothing changed. Hidden tabs stop polling, stalled requests time out, failures back off, and visible pages reconnect. Typical viewer delay includes cache age plus the next poll; this is near-live, not instant push.

A timed-out host request remains in that tab's session storage for safe retry after refresh. It is not blindly replayed. A revision conflict requires review of the current score. Do not clear browser storage while an uncertain update is pending.

## Checks
```sh
npx tsc --noEmit
node tests/scoring.mjs
node tests/api.mjs
npm audit --omit=dev
```

For a bounded authorised production check:
```sh
python -m pip install aiohttp
python tests/load-live.py https://YOUR-OWN-SITE
```
Read `SECURITY_AND_CAPACITY.md` for safeguards and limitations.

## Scorer controls
Normal overs include +12 runs (one legal delivery). After 2.0 overs, the host must lock a positive target for the third over. Regular run, extra and wicket buttons remain disabled until the betting over settles. Enter other runs; a wide or no-ball adds its one-run penalty automatically and uses no legal ball. Wickets deduct 5 from the overall total only and do not change target progress.

Reaching or exceeding the target ends the over immediately and credits exactly twice the declared target. Six legal deliveries without reaching it, or being all out, credits zero betting runs. Wicket penalties remain deducted from the overall total. Undo reverses a delivery or settlement. After a bet settles, score correction can change the official total while keeping its delivery record unchanged; use Undo to change the ball or wicket record.

The header uses the original ILLENIUM logo with a transparent background; the sponsor logo appears at top right. Sharing, the dark layout and all 15 cricket fixtures remain.

## Release 4: reset and delete
On /host, sign in, choose a match, then expand Reset / delete matches. Reset selected match requires RESET followed by the match number; it clears scores and results while preserving teams and time. Undo can reverse a reset, subject to the one-live-match rule. Delete selected match requires DELETE followed by its number; it permanently removes the fixture, scores and undo history. Reset tournament scores requires RESET ALL and clears scores/results on every remaining fixture. Each reset can be reversed with that match's Undo. Original match numbers remain stable after deletions. Empty tournaments display an empty state. All actions use authenticated server validation, version checks and deduplicated request IDs. Deploying this feature does not perform any reset or deletion.
