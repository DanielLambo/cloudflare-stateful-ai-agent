# Deployment Guide

This project deploys as two separate Cloudflare services:

- **Worker** — API, Durable Objects, Workflows (`app/worker`)
- **Pages** — React frontend (`app/web`)

---

## Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up)
- `wrangler` CLI authenticated: `npx wrangler login`
- Node.js 18+

---

## Step 1 — Deploy the Worker

```bash
cd app/worker
npm install
npx wrangler deploy
```

Wrangler will print the deployed URL, e.g.:

```
https://sales-objection-coach.<your-subdomain>.workers.dev
```

Keep this URL — you need it for the next step.

> The worker name is set to `sales-objection-coach` in `wrangler.jsonc`.
> Durable Object migrations, AI binding, and Workflow binding are all declared
> there and will be provisioned automatically on first deploy.

---

## Step 2 — Build the Frontend

In `app/web`, copy the example env file and set your worker URL:

```bash
cd app/web
cp .env.example .env.production
```

Edit `.env.production`:

```
VITE_API_BASE=https://sales-objection-coach.<your-subdomain>.workers.dev
```

Then build:

```bash
npm install
npm run build
```

Output goes to `app/web/dist`.

---

## Step 3 — Deploy to Cloudflare Pages

### Option A — Wrangler CLI

```bash
npx wrangler pages deploy dist --project-name=sales-objection-coach-web
```

Run this from inside `app/web` after building.

### Option B — Cloudflare Dashboard (Git integration)

1. Go to **Workers & Pages → Create → Pages → Connect to Git**
2. Select your repo
3. Set the following build settings:

| Setting | Value |
|---|---|
| Root directory | `app/web` |
| Build command | `npm run build` |
| Build output directory | `dist` |

4. Add the environment variable in the Pages dashboard:

| Variable | Value |
|---|---|
| `VITE_API_BASE` | `https://sales-objection-coach.<your-subdomain>.workers.dev` |

5. Deploy.

---

## Step 4 — Allow Your Pages Domain in CORS

The worker's CORS config (`src/index.ts`) automatically allows any `*.pages.dev`
origin, so no extra config is needed for the default Pages URL.

If you add a **custom domain** to your Pages project, add it to the
`ALLOWED_ORIGINS` set in `app/worker/src/index.ts` and redeploy the worker:

```ts
const ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
  "http://localhost:4173",
  "https://your-custom-domain.com",  // add this
]);
```

---

## Local Development

```bash
# Terminal 1 — Worker
cd app/worker
npm run dev   # runs on http://localhost:8787

# Terminal 2 — Frontend
cd app/web
npm run dev   # runs on http://localhost:5173
```

The frontend defaults to `http://localhost:8787` when `VITE_API_BASE` is not set.
