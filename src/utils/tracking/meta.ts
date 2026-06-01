/**
 * Meta Ads Tracking Utility
 * Single implementation for all server-side Meta Conversions API calls.
 * Supports multiple pixels via comma-separated env vars.
 *
 * Usage:
 *   import { sendMetaCAPI, buildMetaUserData } from '../utils/tracking/meta';
 */

import pkg from 'hash.js';
const { sha256 } = pkg;

// ── Types ──────────────────────────────────────────────────────────

export interface MetaUserData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  fbp?: string;
  fbc?: string;
  clientIP?: string;
  clientUserAgent?: string;
  externalId?: string;
}

export interface MetaEventPayload {
  event_name: string;
  event_time: number;
  action_source: string;
  event_id?: string;
  event_source_url?: string;
  user_data: Record<string, any>;
  custom_data?: Record<string, any>;
}

// ── Hashing helpers ────────────────────────────────────────────────

/** SHA-256 hash a single value (lowercased + trimmed). */
export function hashData(value: string): string {
  if (!value) return '';
  return sha256().update(value.toLowerCase().trim()).digest('hex');
}

/** Hash phone number — strips non-digits, prepends country code. */
export function hashPhone(phone: string, countryCode = '55'): string {
  const digits = phone.replace(/\D/g, '');
  const withCountry = countryCode ? `+${countryCode}${digits}` : `+${digits}`;
  return hashData(withCountry);
}

/**
 * Build the hashed `user_data` object for Meta CAPI.
 * Non-PII fields (fbp, fbc, IP, UA, external_id) are passed through as-is.
 */
export function buildMetaUserData(data: MetaUserData): Record<string, string | undefined> {
  const user_data: Record<string, string | undefined> = {};

  if (data.email) user_data.em = hashData(data.email);
  if (data.phone) user_data.ph = hashPhone(data.phone);
  if (data.firstName) user_data.fn = hashData(data.firstName);
  if (data.lastName) user_data.ln = hashData(data.lastName);
  if (data.city) user_data.ct = hashData(data.city.replace(/\s+/g, ''));
  if (data.state) user_data.st = hashData(data.state);
  if (data.country) user_data.country = hashData(data.country);
  if (data.zipCode) user_data.zp = hashData(data.zipCode);
  if (data.fbp) user_data.fbp = data.fbp;
  if (data.fbc) user_data.fbc = data.fbc;
  if (data.clientIP) user_data.client_ip_address = data.clientIP;
  if (data.clientUserAgent) user_data.client_user_agent = data.clientUserAgent;
  if (data.externalId) user_data.external_id = data.externalId;

  return user_data;
}

// ── Core sender ────────────────────────────────────────────────────

const META_API_VERSION = 'v24.0';
const SEND_TIMEOUT_MS = 10_000;

/**
 * Send one or more events to **all** configured Meta Pixels.
 *
 * Pixel IDs and access tokens come from comma-separated env vars:
 *   META_PIXEL_ID=id1,id2
 *   META_PIXEL_ACCESS_TOKEN=tok1,tok2
 *
 * Returns an array of per-pixel results.
 */
export async function sendMetaCAPI(
  events: MetaEventPayload[],
): Promise<Array<{ pixelId: string; success: boolean; error?: string }>> {
  const pixelIdsCsv = import.meta.env.META_PIXEL_ID ?? '';
  const tokensCsv = import.meta.env.META_PIXEL_ACCESS_TOKEN ?? '';

  const pixelIds = pixelIdsCsv.split(',').map((s: string) => s.trim()).filter(Boolean);
  const tokens = tokensCsv.split(',').map((s: string) => s.trim()).filter(Boolean);

  if (pixelIds.length === 0 || tokens.length === 0) {
    console.error('[Meta CAPI] META_PIXEL_ID or META_PIXEL_ACCESS_TOKEN not set');
    return [{ pixelId: 'none', success: false, error: 'Missing env vars' }];
  }

  if (pixelIds.length !== tokens.length) {
    console.error('[Meta CAPI] Mismatch between pixel IDs and access tokens count');
    return [{ pixelId: 'mismatch', success: false, error: 'ID/token count mismatch' }];
  }

  const payload = { data: events };
  const results: Array<{ pixelId: string; success: boolean; error?: string }> = [];

  for (let i = 0; i < pixelIds.length; i++) {
    const pixelId = pixelIds[i];
    const token = tokens[i];
    const url = `https://graph.facebook.com/${META_API_VERSION}/${pixelId}/events?access_token=${token}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Meta CAPI] HTTP ${response.status} for pixel ${pixelId}: ${errorText}`);
        results.push({ pixelId, success: false, error: `HTTP ${response.status}: ${errorText}` });
        continue;
      }

      const result = await response.json();
      if (result.error) {
        console.error(`[Meta CAPI] API error for pixel ${pixelId}:`, result.error);
        results.push({ pixelId, success: false, error: result.error.message || JSON.stringify(result.error) });
      } else {
        console.log(`[Meta CAPI] Success for pixel ${pixelId}:`, result);
        results.push({ pixelId, success: true });
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      const errMsg = err.name === 'AbortError'
        ? `Timeout (${SEND_TIMEOUT_MS}ms)`
        : (err.message || 'Unknown error');
      console.error(`[Meta CAPI] Error for pixel ${pixelId}: ${errMsg}`);
      results.push({ pixelId, success: false, error: errMsg });
    }
  }

  return results;
}

// ── Client-side helpers (for use in Astro component scripts) ──────

/** Get _fbc and _fbp from cookies (client-side only). */
export function getMetaCookies(): { fbp: string | null; fbc: string | null } {
  if (typeof document === 'undefined') return { fbp: null, fbc: null };

  const getCookie = (name: string) =>
    document.cookie.split('; ').find((row) => row.startsWith(`${name}=`))?.split('=')[1] || null;

  return {
    fbc: getCookie('_fbc'),
    fbp: getCookie('_fbp'),
  };
}

/** Fire Meta Pixel event (client-side only). */
export function fireMetaPixel(eventName: string, params?: Record<string, any>) {
  if (typeof window === 'undefined') return;
  const fbq = (window as any).fbq;
  if (typeof fbq === 'function') {
    fbq('track', eventName, params);
  }
}
