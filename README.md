# Career141 — CV Processing & Recruitment Pipeline System

An AI-driven multi-channel recruitment pipeline, candidate deduplication, matching engine, and automated outreach system built on **Next.js**, **Convex**, and **Clerk**.

---

## Development Workflows: Hosted vs Local Machine

To maintain stability and prevent server crashes from concurrent developer updates, developers can choose to run against the shared **Hosted VPS (`api.career141.com`)** or an isolated **Local Machine (`127.0.0.1`)** backend.

---

### Commands Overview

| Command | Environment | Description |
| :--- | :--- | :--- |
| `npm run dev` | Frontend | Starts Next.js development server (`http://localhost:3000`). |
| `npm run dev:hosted` | Hosted VPS | Switches `.env.local` to hosted mode and connects Convex to `https://api.career141.com`. |
| `npm run dev:local` | Local Machine | Switches `.env.local` to local mode and starts local Convex backend (`http://127.0.0.1:3210`). |
| `npm run switch:hosted` | Hosted VPS | Switches `.env.local` variables to Hosted VPS without launching Convex CLI. |
| `npm run switch:local` | Local Machine | Switches `.env.local` variables to Local Machine without launching Convex CLI. |
| `npm run db:sync-from-hosted` | Local Machine | Exports database from Hosted VPS and imports it into your Local Machine database with `--replace`. |

---

## 1. Working on Local Machine (Recommended for Daily Dev)

Running locally isolates your development, prevents database lock contention, and provides instantaneous hot-reloading.

```bash
# 1. Start Next.js frontend
npm run dev

# 2. In a second terminal, start Local Convex backend
npm run dev:local
```

Your local frontend connects to `http://127.0.0.1:3210`.

---

## 2. Working on Hosted VPS (`api.career141.com`)

Use hosted mode when testing multi-channel webhooks (WhatsApp / MS Graph / Email) or when deploying integrated role updates.

```bash
# 1. Start Next.js frontend
npm run dev

# 2. In a second terminal, connect to Hosted VPS backend
npm run dev:hosted
```

---

## 3. Database Syncing (Cloning Hosted DB to Local Machine)

To populate your local database with real-time jobs, candidates, CVs, and applications from the Hosted VPS:

### Option A: Automatic 1-Click Sync
```bash
npm run db:sync-from-hosted
```
*Exports `https://api.career141.com` data to `hosted_export.zip` and imports it into your local backend (`127.0.0.1`).*

### Option B: Manual Dashboard Export/Import
1. Open the hosted Convex Dashboard (`https://api.career141.com` or port `:6791`).
2. Go to **Settings** → **Export Database** and download `export.zip`.
3. Import the snapshot into your local machine database:
   ```bash
   npm run switch:local
   npx convex import --path export.zip --replace
   ```

---

## Recommended Team Workflow

1. **Feature Building**: Use `npm run dev:local` for daily coding and testing.
2. **Fresh Production Snapshot**: Run `npm run db:sync-from-hosted` whenever you need fresh candidate or job data on your machine.
3. **Staging / Hosted Integration**: Run `npm run dev:hosted` to test live integration flows before pushing code to production.
