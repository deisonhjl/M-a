// Netlify Function — proxy seguro para la API de Anthropic
// La API key se lee de una variable de entorno (nunca queda en el código)

const rateLimitMap = new Map();

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key no configurada' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }

  // Rate limit básico por IP (50 requests por hora)
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hora
  const maxRequests = 50;

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }
  const timestamps = rateLimitMap.get(ip).filter(t => now - t < windowMs);
  if (timestamps.length >= maxRequests) {
    return new Response(JSON.stringify({ error: 'Demasiadas solicitudes. Intenta en un rato.' }), {
      status: 429, headers: { 'Content-Type': 'application/json' }
    });
  }
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);

  try {
    const body = await req.json();

    const safeBody = {
      model: 'claude-sonnet-4-20250514',
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
