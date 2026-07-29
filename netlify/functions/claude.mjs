// Netlify Edge Function — proxy seguro para la API de Anthropic

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  }

  const apiKey = Netlify.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key no configurada en el servidor' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json();

    const safeBody = {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: Math.min(body.max_tokens || 800, 1000),
      system: (body.system || '').substring(0, 2000),
      messages: (body.messages || []).slice(0, 2)
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(safeBody)
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Error interno: ' + err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = {
  path: "/.netlify/functions/claude"
};
