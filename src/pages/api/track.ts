/**
 * Unified Tracking Endpoint
 *
 * POST /api/track
 * Body: { event: "PageView" | "Lead" | "VideoProgress" | ..., ...data }
 *
 * Called from client-side JS after page render. This ensures:
 * - 1 real page view = 1 server-side event (no static asset noise)
 * - Shared event_id with client-side fbq() for deduplication
 * - All server-side CAPI logic in one place
 */

import type { APIRoute } from 'astro';
import { sendMetaCAPI, type MetaEventPayload } from '../../utils/tracking/meta';
import { hashUserData, type RawUserData } from '../../utils/hashing';

const DRY_RUN = import.meta.env.DEBUG === '1';

// ── Helpers ────────────────────────────────────────────────────────

function getClientIp(request: Request): string | null {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0].trim() ||
    request.headers.get('Remote-Addr') ||
    null
  );
}

// ── Endpoint ───────────────────────────────────────────────────────

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const { event } = body;
  if (!event) {
    return new Response(JSON.stringify({ error: 'Missing "event" field' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const clientIp = getClientIp(request);
  const userAgent = request.headers.get('user-agent') || '';
  const clientUuid = cookies.get('uuid')?.value;
  const fbcValue = body.fbc || cookies.get('_fbc')?.value;
  const fbpValue = body.fbp || cookies.get('_fbp')?.value;
  const eventId = body.event_id || cookies.get('event_id')?.value;
  const eventTime = Math.floor(Date.now() / 1000);

  // Location from middleware locals (already fetched, no re-fetch)
  const locationInfo = (locals as any)?.locationInfo;

  // Hash location data
  const rawLocationData: RawUserData = {
    city: locationInfo?.city,
    state: locationInfo?.region,
    countryCode: locationInfo?.countryCode,
  };
  const hashedLocationData = hashUserData(rawLocationData);

  // Base user_data shared across all events
  const baseUserData: Record<string, any> = {
    ...hashedLocationData,
    client_ip_address: clientIp ? String(clientIp) : undefined,
    client_user_agent: userAgent,
    fbc: fbcValue || undefined,
    fbp: fbpValue || undefined,
    external_id: clientUuid,
  };

  let metaEvent: MetaEventPayload;

  // ── Route by event type ──────────────────────────────────────────

  switch (event) {
    case 'PageView': {
      metaEvent = {
        event_name: 'PageView',
        event_time: eventTime,
        action_source: 'website',
        event_id: eventId,
        event_source_url: body.url || '',
        user_data: baseUserData,
      };
      break;
    }

    case 'VideoProgress': {
      const { progress, watchTime, eventType, slug, pageUrl } = body;

      // Determine event name from milestone
      let eventName = 'VideoProgress';
      if (eventType === 'time' && watchTime && watchTime >= 300) {
        eventName = 'Video_Rel_5min';
      } else if (eventType === 'percent' && progress) {
        const percentEventMap: Record<number, string> = {
          25: 'Video_Rel_25',
          50: 'Video_Rel_50',
          75: 'Video_Rel_75',
          90: 'Video_Rel_90',
        };
        eventName = percentEventMap[progress] || `VideoProgress${progress}Percent`;
      }

      metaEvent = {
        event_name: eventName,
        event_time: eventTime,
        action_source: 'website',
        event_id: eventId || `${clientUuid}_${Date.now()}_${progress}`,
        event_source_url: pageUrl || body.url || '',
        user_data: baseUserData,
        custom_data: {
          video_slug: slug || 'unknown',
          ...(progress != null && { progress_percent: progress }),
          ...(watchTime != null && { watch_time_seconds: watchTime }),
          content_type: 'video',
        },
      };
      break;
    }

    default: {
      // Generic / custom event pass-through
      metaEvent = {
        event_name: event,
        event_time: eventTime,
        action_source: 'website',
        event_id: eventId,
        event_source_url: body.url || '',
        user_data: {
          ...baseUserData,
          ...(body.user_data || {}),
        },
        ...(body.custom_data && { custom_data: body.custom_data }),
      };
    }
  }

  console.log(`[/api/track] ${event} event:`, JSON.stringify(metaEvent, null, 2));

  // ── Send to Meta ─────────────────────────────────────────────────

  if (!DRY_RUN) {
    try {
      const results = await sendMetaCAPI([metaEvent]);
      return new Response(JSON.stringify({ success: true, event, results }), {
        headers: { 'content-type': 'application/json' },
      });
    } catch (error) {
      console.error(`[/api/track] Error sending ${event} to Meta:`, error);
      return new Response(JSON.stringify({ success: false, error: 'CAPI send failed' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }
  } else {
    console.log(`[/api/track] DEBUG MODE — not sending ${event} to Meta`);
    return new Response(JSON.stringify({ success: true, event, debug: true }), {
      headers: { 'content-type': 'application/json' },
    });
  }
};
