# Crypto Market Insights Dashboard — Project Overview

## What It Is

**Crypto Market Insights Dashboard** is a Node.js web application for viewing and managing daily crypto market research digests and 100x opportunity analyses. It provides:

- **Dashboard** — Browse all market insight digests in a card grid (newest first)
- **Individual insight view** — Read full markdown content rendered as HTML
- **Add insight form** — Create new insights via web form with a 100x opportunity checklist
- **Dark theme** — UI optimized for extended reading

### Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js |
| Framework | Express.js |
| Templates | EJS |
| Markdown | marked |
| Deployment | Vercel (serverless) |

### File Structure

```
├── server.js              # Express server + Vercel handler
├── package.json            # Dependencies: express, ejs, marked, nodemon
├── vercel.json             # Vercel config (routes all traffic to server.js)
├── views/
│   ├── index.ejs           # Main dashboard (insight cards)
│   ├── add-insight.ejs     # Form to add new insights
│   ├── insight.ejs         # Single insight detail view
│   └── error.ejs           # Error page
├── insights/               # Markdown insight files (auto-detected)
│   └── research-digest-YYYY-MM-DD-slug.md
└── public/                 # Static assets (referenced but may be empty)
```

### How It Works

1. **Insights** are markdown files in `insights/` with names like `research-digest-2026-02-04-sample-opportunity.md`.
2. The server scans this directory, parses markdown, and shows cards on the homepage.
3. Users can add insights via `/add-insight`; the form posts to `/api/add-insight`, which writes a new `.md` file.
4. Individual insights are viewed at `/insight/:filename`.

---

## Bugs Found & Fixed

### 1. **Server fails to start locally** — FIXED

**Problem:** `server.js` unconditionally requires `require('vercel/node')`, but `vercel` is not in `package.json`. Running `node server.js` or `npm run dev` crashes with:

```
Error: Cannot find module 'vercel/node'
```

**Fix:** Wrapped the Vercel handler assignment in a try/catch so local development works without the `vercel` package. Vercel provides it in its deployment environment.

```javascript
try {
  module.exports.handler = require('vercel/node')(app);
} catch (err) {
  // vercel not installed - fine for local development
}
```

---

## Minor Issues / Notes

### 1. **Missing `public/` directory**

The README mentions a `public/` folder for static assets. It does not exist. The server uses `express.static(path.join(__dirname, 'public'))`, which will not error but will serve nothing. Create `public/` if you add CSS, JS, or images.

### 2. **Card titles show filename instead of content title**

On the dashboard, each card shows `insight.filename` (e.g. `research-digest-2026-02-04-sample-opportunity.md`) as the heading. A better UX would be to extract the first `# Title` from the markdown content. Same for the individual insight page header.

### 3. **Excerpt may add "..." to short content**

`getExcerpt()` always appends `...` even when content is under 200 characters. Consider only appending when the content was truncated.

### 4. **URL encoding for filenames**

Links use `/insight/research-digest-2026-02-04-sample-opportunity.md`. Filenames with spaces or special characters would need `encodeURIComponent()` in links and `decodeURIComponent()` when reading the param.

### 5. **Vercel file system**

On Vercel, the filesystem is read-only except at build time. Writing insights via `/api/add-insight` will fail in production. For deployment, you’d need a database or external storage instead of writing to the local filesystem.

---

## Quick Start

```bash
npm install
npm run dev
```

Then open http://localhost:3000

---

*Generated for debugging and documentation — Feb 6, 2026*
