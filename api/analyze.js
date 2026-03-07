export default async function handler(req, res) {
  /* CORS */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { key, model, prompt } = req.body || {};
  if (!key || !prompt) return res.status(400).json({ error: 'Missing key or prompt' });

  const selectedModel = model || 'claude-sonnet-4-20250514';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: selectedModel,
        max_tokens: 8192,
        messages: [{
          role: 'user',
          content: prompt
        }],
        system: `You are a joint crisis-analysis team for the Government of Pakistan. Your output must be decision-grade — suitable for the Prime Minister, Finance Minister, SBP Governor, and military leadership. Use specific numbers, ranges, and data. No fluff, no generic essays. Be conservative and policy-relevant. Structure your response with clear headers (## and ###). Use tables where appropriate (markdown format). Current date: ${new Date().toISOString().split('T')[0]}.`
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: err.error?.message || `Anthropic API error: ${response.status}`
      });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    return res.status(200).json({
      content: text,
      model: selectedModel,
      usage: data.usage || {}
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Internal server error' });
  }
}
