# Security, hosting and capacity

## Security controls
- Every write is authorised server-side. Viewer reads cannot mutate scores.
- PBKDF2-SHA256 hashes with random salt; no plaintext password storage.
- Random session tokens stored as hashes; 12-hour expiry, HttpOnly/Secure/SameSite cookies; reset revokes sessions.
- Same-origin checks, JSON-only bounded input, parameterized SQL, integer/rule validation and escaped UI text.
- Login throttling (10 attempts per IP per 15 minutes); write throttling (180 updates per session per minute).
- Revision compare-and-swap prevents silent concurrent overwrites. Last 256 request IDs support safe retries.
- CSP, nosniff, referrer, permissions and HTTPS headers. CSP allows framework inline hydration; it is not a strict nonce-based CSP.
- Owner setup trusts only the managed Sites identity boundary. Standalone mode disables this and uses CLI password setup.

## 500-viewer architecture
500 visible clients polling about every 3.25 seconds generate roughly 154 requests/second. For eight continuously active hours this is about 4.43 million polls. ETags reduce transferred data, not the number of requests. Two-second edge caching/coalescing sharply reduces database reads; each data centre/isolate has its own cache. Score writes are infrequent compared with viewer reads.

For self-managed hosting, recommend Cloudflare Workers Paid + D1, with request/CPU budgets, usage alerts and database recovery checked before the event. Avoid relying on a free daily request allowance for a full day with 500 continuous viewers. This code already targets Workers/D1; another hosting provider needs adaptation and equivalent durable storage/authentication. The existing managed Site's account quotas and WAF controls are owned by its hosting service and have not been independently verified or changed here.

Official references (checked 13 November 2026):
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/workers/runtime-apis/cache/

## Verification scope
Scoring test source covers mandatory third-over targets, automatic wide/no-ball penalties, wicket deductions from the overall score, target progress, correction/undo, chases and repeated Super Overs. The updated test source has not been run as part of this change. API tests cover anonymous viewing, protected writes, owner setup, login/logout, secure cookies, CSRF, request limits, throttling, duplicate request IDs, revision conflicts, ETags and 500 simultaneous local reads.

The optional live test simulates 500 API polling clients from one location. It is not 500 complete browsers, multiple regions, a full-day endurance test, a penetration test or a DDoS test. Results, if obtained, are included separately in this package.

## Operational notes
Scores survive refresh because they are stored in D1. The latest 120 actions per match can be undone. This is not a full historical audit or backup. Use database point-in-time recovery/backups where your hosting account provides them; keep the paper score sheet as the official fallback.

Only share the host password with scorers. Use a strong unique password and reset it if disclosed. Shared credentials do not identify individual scorers. Internet loss prevents new confirmed writes; the UI retains the last received score and an uncertain action for safe retry. It never claims an unsaved action is confirmed.

No finite test proves crash-proof or hack-proof operation. Dependency audits do not replace security review, and hosting outages, quotas, venue connectivity and distributed abuse can still affect availability. Rehearse a full match on separate scorer/viewer devices before the event.
