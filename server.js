// ─────────────────────────────────────────────────────────────
// CrashQuote AI — Backend Server
// Securely proxies requests to the Claude API so your API key
// never lives in the browser/phone. Serves the front-end app too.
// ─────────────────────────────────────────────────────────────

// Prevent unhandled errors from crashing the process
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err.message, err.stack);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

const express = require("express");
const path = require("path");

const app = express();

// Allow large JSON bodies (photos are base64 — can be a few MB each)
app.use(express.json({ limit: "25mb" }));

// Serve the front-end (everything in /public) at the root URL
app.use(express.static(path.join(__dirname, "public")));

// ── API key from environment (never hard-code it) ──
const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6";

// ── PostgreSQL (optional — gracefully absent if DATABASE_URL not set) ──
let pool = null;
if (process.env.DATABASE_URL) {
  try {
    const { Pool } = require("pg");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    pool.query(`
      CREATE TABLE IF NOT EXISTS quotes (
        id         SERIAL PRIMARY KEY,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        rego       TEXT        DEFAULT '',
        vehicle    JSONB       DEFAULT '{}',
        damage     JSONB,
        line_items JSONB       DEFAULT '[]',
        total      NUMERIC(10,2) DEFAULT 0
      )
    `).then(() => console.log("DB ready"))
      .catch(err => console.error("DB init error:", err.message));
  } catch (err) {
    console.error("Failed to initialise pg pool:", err.message);
    pool = null;
  }
}

// ── Quote CRUD ──────────────────────────────────────────────

// List all quotes (most recent first)
app.get("/api/quotes", async (_req, res) => {
  if (!pool) return res.json([]);
  try {
    const { rows } = await pool.query(
      "SELECT id, created_at, updated_at, rego, vehicle, damage, line_items, total FROM quotes ORDER BY updated_at DESC LIMIT 200"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save a new quote
app.post("/api/quotes", async (req, res) => {
  if (!pool) return res.status(503).json({ error: "No database configured." });
  const { rego, vehicle, damage, lineItems, total } = req.body;
  try {
    const { rows } = await pool.query(
      "INSERT INTO quotes (rego, vehicle, damage, line_items, total) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [rego || "", vehicle || {}, damage || null, JSON.stringify(lineItems || []), total || 0]
    );
    res.json({ id: rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update an existing quote
app.put("/api/quotes/:id", async (req, res) => {
  if (!pool) return res.status(503).json({ error: "No database configured." });
  const { rego, vehicle, damage, lineItems, total } = req.body;
  try {
    await pool.query(
      "UPDATE quotes SET rego=$1, vehicle=$2, damage=$3, line_items=$4, total=$5, updated_at=NOW() WHERE id=$6",
      [rego || "", vehicle || {}, damage || null, JSON.stringify(lineItems || []), total || 0, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a quote
app.delete("/api/quotes/:id", async (req, res) => {
  if (!pool) return res.status(503).json({ error: "No database configured." });
  try {
    await pool.query("DELETE FROM quotes WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Damage analysis endpoint ──
app.post("/api/analyze", async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({ error: "Server is missing ANTHROPIC_API_KEY." });
  }

  try {
    const { photos = [], vehicle = {} } = req.body;
    if (!photos.length) {
      return res.status(400).json({ error: "No photos provided." });
    }

    const imageBlocks = photos.slice(0, 6).map(p => ({
      type: "image",
      source: { type: "base64", media_type: p.mime || "image/jpeg", data: p.base64 },
    }));

    const prompt = `You are an expert panel & paint damage assessor for a NZ collision repair shop. Analyse the attached vehicle photo(s) for crash damage.

Vehicle context: ${vehicle.make || "unknown make"} ${vehicle.model || ""} ${vehicle.year || ""}, colour ${vehicle.colour || "unknown"}.

Respond with ONLY valid JSON (no markdown, no preamble) in this exact shape:
{
  "summary": "one-sentence overall assessment",
  "panels": [
    { "panel": "panel name e.g. Front Bumper", "severity": "minor|moderate|heavy|severe", "repair_method": "PDR|Fill & Paint|Replace|Blend", "labour_hours": number, "notes": "short note" }
  ],
  "flags": ["any structural/safety/ADAS concerns"],
  "paint_complexity": "solid|metallic|pearl|tri-coat"
}

If you cannot clearly see damage, give your best professional estimate based on what's visible. Use standard collision-repair panel names.`;

    const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        messages: [{ role: "user", content: [...imageBlocks, { type: "text", text: prompt }] }],
      }),
    });

    if (!anthropicResp.ok) {
      const errText = await anthropicResp.text();
      return res.status(502).json({ error: "Claude API error: " + errText });
    }

    const data = await anthropicResp.json();
    const text = data.content.filter(b => b.type === "text").map(b => b.text).join("");

    let parsed;
    try {
      parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch {
      return res.status(500).json({ error: "Could not parse AI response.", raw: text });
    }

    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message || "Unknown server error." });
  }
});

// Health check
app.get("/api/health", (_req, res) => res.json({ ok: true, model: MODEL, db: !!pool }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CrashQuote AI server running on port ${PORT}`));
