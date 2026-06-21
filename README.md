# CrashQuote AI — Backend Server

This is the piece that makes the AI work on your phone. It holds your
Anthropic API key **securely on a server** (never on your phone) and serves
the app at a real web address you can open in any browser.

Once deployed, the **whole flow works on your Samsung**: camera, gallery,
AI damage analysis, quote builder, and export — no preview, no sandbox.

---

## What's in here

| File | What it does |
|------|--------------|
| `server.js` | The backend. Receives photos from the app, adds your secret API key, calls Claude, returns the assessment. |
| `public/index.html` | The app itself (the same one you tested, now pointed at the backend). |
| `package.json` | Lists the one dependency (Express). |
| `.env.example` | Template for your API key. |

---

## Option A — Deploy to Railway (easiest, ~10 min)

You do this on a **computer**, once. After that you just use the URL on your phone.

### 1. Get an Anthropic API key
- Go to **https://console.anthropic.com** → sign in
- **Settings → API Keys → Create Key**
- Copy it (starts with `sk-ant-...`). You'll paste it in step 4.
- Note: the API is **pay-as-you-go** and separate from your Claude chat
  subscription. Damage analysis costs roughly a few cents per quote.

### 2. Put this folder on GitHub
- Create a free account at **https://github.com** if you don't have one
- Make a new repository (e.g. `crashquote-server`)
- Upload all files from this folder (drag-and-drop works on github.com:
  "Add file → Upload files")
- **Do not upload a `.env` file** — your key must stay off GitHub

### 3. Connect Railway
- Go to **https://railway.app** → sign in with GitHub
- **New Project → Deploy from GitHub repo → pick `crashquote-server`**
- Railway auto-detects Node and runs `npm start`

### 4. Add your API key
- In your Railway project → **Variables** tab
- Add a new variable:
  - **Name:** `ANTHROPIC_API_KEY`
  - **Value:** your `sk-ant-...` key
- Railway redeploys automatically

### 5. Get your URL
- Railway project → **Settings → Networking → Generate Domain**
- You'll get something like `https://crashquote-server-production.up.railway.app`
- Open that on your phone. **Done** — bookmark it or add to home screen.

---

## Option B — Deploy to Render (also free tier)

1. Push this folder to GitHub (same as Option A, steps 1–2)
2. Go to **https://render.com** → **New → Web Service** → connect the repo
3. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. **Environment → Add Environment Variable:**
   `ANTHROPIC_API_KEY` = your key
5. Deploy → you get a `https://...onrender.com` URL

> Render's free tier sleeps after inactivity, so the first request after a
> while takes ~30s to wake up. Railway stays awake but has a small monthly
> credit. Either is fine to start.

---

## Test it locally first (optional, needs Node on a computer)

```bash
npm install
# create a .env file with your key (copy .env.example)
ANTHROPIC_API_KEY=sk-ant-... npm start
# open http://localhost:3000
```

Visit `http://localhost:3000/api/health` — you should see `{"ok":true,...}`.

---

## What this does NOT include yet (future build steps)

- **Chrome Extension** for auto-filling Panel Quote (separate project)
- **Rego lookup** (CarJam/NZTA) to auto-fill vehicle details
- **Live parts pricing** (Parts Trader or supplier catalogue)
- **Spies Hecker paint costing**
- **Saving/quote history** (currently each quote is in-memory only)

Each of these is a self-contained add-on we can build next.

---

## Security notes

- Your API key lives **only** in the host's environment variables, never in
  the app or on your phone. That's the correct, safe setup.
- Keep `.env` out of GitHub (the included `.gitignore` handles this).
- If a key ever leaks, revoke it in the Anthropic console and make a new one.
