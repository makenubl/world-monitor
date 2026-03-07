export default async function handler(req, res) {
  /* CORS */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured on server' });

  const systemPrompt = `You are the AI engine for the World Situation Room — a GLOBAL geopolitical crisis simulation platform. The user will ask a "What if..." scenario question. You must generate a simulation that will play on an interactive 3D globe (Mapbox).

CRITICAL: Generate simulations with a GLOBAL perspective. Show worldwide impacts and consequences — not just one country. Include effects on multiple continents, global markets, supply chains, and international responses. Only focus on a specific region if the user explicitly names it. Always think about cascading second and third-order effects across the entire world.

Your response must be ONLY valid JSON — no markdown, no explanation, no backticks. Just a raw JSON object.

The JSON must match this exact structure:
{
  "name": "Short scenario name (max 40 chars)",
  "badge": "high|mod|active|elev|low",
  "badgeText": "SEVERITY LABEL (e.g. HIGH 70%)",
  "steps": [
    {
      "cam": {
        "center": [longitude, latitude],
        "zoom": 4.5,
        "pitch": 45,
        "bearing": 10,
        "duration": 2500
      },
      "phase": "PHASE LABEL (e.g. HOUR 1, DAY 3, WEEK 2)",
      "title": "Dramatic title with <em>emphasis</em> on key word",
      "body": "2-4 sentence narrative. Specific facts, numbers, consequences. No fluff. Write like a war-room briefing.",
      "rip": [
        {"la": 33.69, "lo": 73.04, "c": "red", "n": 3}
      ],
      "imp": [
        {"i": "emoji", "v": "VALUE", "l": "Label", "c": "var(--red)"}
      ],
      "dur": 8000
    }
  ]
}

RULES:
1. Generate 3-5 steps/phases. Each step is a phase of the crisis unfolding.
2. Use REAL geographic coordinates for camera positions and ripple effects. Be accurate.
3. Camera center is [longitude, latitude]. Zoom 3-7 (3=global, 7=city). Pitch 30-55. Duration 2000-3000ms.
4. Ripple colors: "red" for conflict/crisis, "amber" for warning/economic, "cyan" for strategic/diplomatic, "green" for positive/resolution. n = number of ripples (2-5).
5. Impact cards (imp): Use relevant emojis. Value should be a short metric (e.g. "$90B", "+40%", "CLOSED", "3 FRONTS"). Label max 15 chars. Color: var(--red), var(--amber), var(--cyan), var(--green), var(--blue).
6. Each step duration (dur): 7000-10000ms.
7. Titles MUST use <em>word</em> to highlight one dramatic word in red.
8. Body text should be specific, data-driven, and written in present tense like a live briefing.
9. The scenario should escalate through the phases, showing cause and effect.
10. Think about second and third-order effects: economic, military, humanitarian, diplomatic.

Current date: ${new Date().toISOString().split('T')[0]}

Active global context you can reference:
- Ukraine-Russia war (frontline ~48.5°N, 37.5°E)
- Gaza conflict (31.4°N, 34.4°E)
- Hormuz Strait crisis — currently closed (26.56°N, 56.25°E)
- India-Pakistan tensions, LOC active (34.3°N, 74.3°E)
- Sudan civil war (15.6°N, 32.5°E)
- Pakistan-Afghan border war (32.3°N, 69.87°E)
- Myanmar civil war (19.8°N, 96.2°E)
- Taiwan Strait tensions (24°N, 120.5°E)
- Yemen/Red Sea Houthi attacks (15.4°N, 44.2°E)
- Sahel instability (14.6°N, -2°E)
- Brent crude at $90.8

Return ONLY the JSON object. No other text.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
        system: systemPrompt
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: err.error?.message || `API error: ${response.status}`
      });
    }

    const data = await response.json();
    const text = (data.content?.[0]?.text || '').trim();

    /* Try to parse JSON — handle potential markdown wrapping */
    let sim;
    try {
      sim = JSON.parse(text);
    } catch (e) {
      /* Try extracting JSON from markdown code block */
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        sim = JSON.parse(match[1].trim());
      } else {
        /* Try finding first { to last } */
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
          sim = JSON.parse(text.substring(start, end + 1));
        } else {
          return res.status(500).json({ error: 'Failed to parse simulation data' });
        }
      }
    }

    /* Basic validation */
    if (!sim.steps || !Array.isArray(sim.steps) || sim.steps.length === 0) {
      return res.status(500).json({ error: 'Invalid simulation: no steps generated' });
    }

    return res.status(200).json({
      simulation: sim,
      usage: data.usage || {}
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Internal server error' });
  }
}
