import type { APIRoute } from 'astro';
import { sendMetaCAPI, buildMetaUserData } from '../../../utils/tracking/meta';

const META_PIXEL_ID = import.meta.env.META_PIXEL_ID;
const META_ACCESS_TOKEN = import.meta.env.META_ACCESS_TOKEN;
const GOOGLE_ADS_ID = import.meta.env.GOOGLE_ADS_ID || 'AW-16561604318';
const GOOGLE_ADS_LEAD_LABEL = import.meta.env.GOOGLE_ADS_LEAD_LABEL || 'Lead';

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const {
    email,
    phone,
    firstName,
    lastName,
    city,
    state,
    country,
    fbp,
    fbc,
    clientIP,
    clientUserAgent,
    clientID,
    leadScore,
    highUrgency,
    source,
    babyBirthDate,
    usingFormula,
    difficulty,
    backToWork,
  } = body;

  const userData = buildMetaUserData({
    email,
    phone,
    firstName,
    lastName,
    city,
    state,
    country,
    fbp,
    fbc,
    clientIP,
    clientUserAgent,
    externalId: clientID,
  });

  const eventTime = Math.floor(Date.now() / 1000);

  // 1. Send Meta CAPI (server-side)
  if (META_PIXEL_ID && META_ACCESS_TOKEN) {
    const result = await sendMetaCAPI(META_PIXEL_ID, META_ACCESS_TOKEN, [
      {
        eventName: 'Lead',
        eventTime,
        actionSource: 'website',
        eventId: clientID || `lead_${eventTime}`,
        eventSourceUrl: source || '',
        userData,
        customData: {
          lead_score: leadScore,
          high_urgency: highUrgency,
          using_formula: usingFormula,
          back_to_work: backToWork,
        },
      },
    ]);
    console.log('Meta CAPI Lead result:', result);
  }

  // 2. Send to Google Sheets (if configured)
  const GSHEET_WEBHOOK_URL = import.meta.env.GSHEET_LEAD_WEBHOOK_URL;
  if (GSHEET_WEBHOOK_URL) {
    fetch(GSHEET_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: new Date().toISOString(),
        name: `${firstName} ${lastName}`.trim(),
        email,
        phone,
        city,
        state,
        country,
        source,
        lead_score: leadScore,
        high_urgency: highUrgency,
        using_formula: usingFormula,
        back_to_work: backToWork,
        baby_birth_date: babyBirthDate || null,
        difficulty_text: difficulty || null,
        fbp,
        fbc,
        client_ip: clientIP,
        user_agent: clientUserAgent,
        client_id: clientID,
      }),
    }).catch((err) => console.error('Sheet webhook error:', err));
  }

  // 3. Send Telegram notification
  const TELEGRAM_BOT_URL = import.meta.env.TELEGRAM_BOT_URL;
  if (TELEGRAM_BOT_URL && phone) {
    const urgencyEmoji = highUrgency ? '🚨' : '📌';
    const message = encodeURIComponent(
      `${urgencyEmoji} ${highUrgency ? 'HIGH URGENCY LEAD' : 'Nova Lead'}\n` +
      `${firstName} ${lastName}\n` +
      `${email}\n` +
      `${phone}\n` +
      `Score: ${leadScore || 0}/100\n` +
      `Urgência: ${highUrgency ? 'ALTA' : 'normal'}\n` +
      `Cidade: ${city || 'N/A'}, ${state || 'N/A'}\n` +
      `Origem: ${source || 'N/A'}\n` +
      `\n[WhatsApp](https://api.whatsapp.com/send?phone=${phone.replace('+', '')})`
    );
    fetch(`${TELEGRAM_BOT_URL}&text=${message}`).catch((err) => console.error('Telegram error:', err));
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'content-type': 'application/json' },
  });
};
