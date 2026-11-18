# ILLENIUM 2026 Score Trackers

Two independent live event websites, each with a public viewer page and a password-protected host page.

| Project | Event | Date |
| --- | --- | --- |
| [Spin & Swing](spin-and-swing/) | Cricket | 28 November 2026 |
| [Footvolley](footvolley/) | Footvolley | 29 November 2026 |

## Project structure

Each folder contains its frontend, scoring engine, API routes, database schema and migrations, assets, and deployment configuration. See each project's README for setup details.

## Development

Use Node.js 24 and npm. Run commands inside the individual project folder:

```sh
npm ci
npm run build
```

Configure a separate Cloudflare D1 database and host authentication for each project. Apply SQL migrations in filename order. Production passwords, sessions, live scores and database contents are not included.

## Hosting

The projects currently run as separate managed Sites. Their `.openai/hosting.json` files identify the existing deployments. Publishing to GitHub does not automatically deploy either website. Preserve existing database bindings when updating the managed Sites.

For a separate installation, use Cloudflare Workers and D1 and follow the project-specific instructions. Never commit local environment files, credentials, database exports or build output.

## Scoring

Cricket uses five overs per innings, seven wickets, mandatory third-over targets and repeat Super Overs for ties. During a betting over, wickets deduct five from the overall total without reducing progress toward the declared target.

Footvolley uses one set to 15, with play continuing at 14–14 until one team leads by two points.

## Verification

Builds passed for the included source revisions. Automated test files are included; they were not run during repository preparation. Rehearse a full match on separate scorer and viewer devices before event use.
