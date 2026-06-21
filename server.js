// ─────────────────────────────────────────────────────────────
// CrashQuote AI — Backend Server
// Securely proxies requests to the Claude API so your API key
// never lives in the browser/phone. Serves the front-end app too.
// ─────────────────────────────────────────────────────────────

const express = require("express");
const path = require("path");

const app = express();

// Allow large JSON bodies (photos are base64 — can be a few MB each)
app.use(express.json({ limit: "25mb" }));

// Serve the front-end (everything in /public) at the root URL
app.use(express.static(path.join(__dirname, "public")));

// ── API key from environment (never hard-code it) ──
const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6"; // current production default (June 2026)

// ── Damage analysis endpoint ──
// The phone sends { photos: [{ base64, mime }], vehicle: {...} }
// The server adds the secret API key and calls Claude, then
// returns the parsed JSON assessment.
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

// Health check (handy after deploying)
app.get("/api/health", (_req, res) => res.json({ ok: true, model: MODEL }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CrashQuote AI server running on port ${PORT}`));
