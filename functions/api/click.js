// Cloudflare Pages Function: POST /api/click
// Sends an email alert (via Resend) when a visitor clicks the "Online Criminal Record Check" button.
// No personal data is collected: only page, time, device type, approximate city and referrer.

const BOT = /bot|crawl|spider|slurp|preview|monitor|curl|wget|python|headless|lighthouse|pingdom|uptime|facebookexternalhit/i;

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function sha(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const done = new Response(null, { status: 204 });

  try {
    // 1. Basic bot filtering
    const ua = request.headers.get('user-agent') || '';
    if (!ua || BOT.test(ua)) return done;

    // 2. Only accept requests coming from our own site
    const allowed = (env.ALLOWED_HOSTS || 'criminalrecordcheckonline.com,www.criminalrecordcheckonline.com')
      .split(',')
      .map((h) => h.trim());
    let host = '';
    try { host = new URL(request.headers.get('origin') || '').host; } catch (e) {}
    if (!allowed.includes(host)) return done;

    // 3. Parse a small JSON body
    const raw = await request.text();
    if (raw.length > 2000) return done;
    let body = {};
    try { body = JSON.parse(raw); } catch (e) {}
    const page = String(body.page || '/').slice(0, 200);
    const ref = String(body.ref || '').slice(0, 300) || 'Direct / none';

    // 4. De-duplicate: one alert per visitor per 2 minutes (needs optional KV binding CLICK_KV)
    if (env.CLICK_KV) {
      const ip = request.headers.get('cf-connecting-ip') || '';
      const key = 'c:' + (await sha(ip + ua));
      if (await env.CLICK_KV.get(key)) return done;
      await env.CLICK_KV.put(key, '1', { expirationTtl: 120 });
    }

    // 5. Build and send the email
    if (!env.RESEND_API_KEY) {
      console.log('RESEND_API_KEY not set; click not emailed');
      return done;
    }
    const cf = request.cf || {};
    const place = [cf.city, cf.region, cf.country].filter(Boolean).join(', ') || 'Unknown';
    const device = /Mobi|Android|iPhone|iPad/i.test(ua) ? 'Mobile' : 'Desktop';
    const when = new Date().toLocaleString('en-CA', {
      timeZone: 'America/Vancouver',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const html =
      '<p>Someone clicked <b>Online Criminal Record Check</b> on criminalrecordcheckonline.com.</p>' +
      '<table cellpadding="4">' +
      `<tr><td><b>Time (Pacific)</b></td><td>${esc(when)}</td></tr>` +
      `<tr><td><b>Page</b></td><td>${esc(page)}</td></tr>` +
      `<tr><td><b>Approx. location</b></td><td>${esc(place)}</td></tr>` +
      `<tr><td><b>Device</b></td><td>${esc(device)}</td></tr>` +
      `<tr><td><b>Came from</b></td><td>${esc(ref)}</td></tr>` +
      '</table>';

    const send = fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + env.RESEND_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.FROM_EMAIL || 'Click Alerts <alerts@criminalrecordcheckonline.com>',
        to: [env.TO_EMAIL || 'info@surreyfingerprint.com'],
        subject: 'Online Criminal Record Check button clicked (' + place + ')',
        html,
      }),
    }).then(async (r) => {
      if (!r.ok) console.log('Resend error', r.status, await r.text());
    });

    context.waitUntil(send);
  } catch (err) {
    console.log('click handler error', err && err.message);
  }
  return done;
}

// Anything other than POST gets a 405
export async function onRequest() {
  return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
}
