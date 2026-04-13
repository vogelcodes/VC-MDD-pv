/**
 * Meta Ads Tracking Utility
 * Handles both client-side Pixel and server-side CAPI
 */

import { sha256 } from 'hash.js';

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

export interface MetaEventData {
  eventName: string;
  eventTime?: number;
  actionSource?: string;
  eventId?: string;
  eventSourceUrl?: string;
  customData?: Record<string, any>;
}

// Hash a value for Meta CAPI
export function hashData(value: string): string {
  if (!value) return '';
  return sha256().update(value.toLowerCase().trim()).digest('hex');
}

// Hash phone number (remove non-digits, prepend +55 for Brazil)
export function hashPhone(phone: string, countryCode = '55'): string {
  const digits = phone.replace(/\D/g, '');
  const withCountry = countryCode ? `+${countryCode}${digits}` : `+${digits}`;
  return hashData(withCountry);
}

// Build hashed user_data for Meta CAPI
export function buildMetaUserData(data: MetaUserData) {
  const user_data: Record<string, string | undefined> = {};

  if (data.email) user_data.em = hashData(data.email);
  if (data.phone) user_data.ph = hashPhone(data.phone);
  if (data.firstName) user_data.fn = hashData(data.firstName);
  if (data.lastName) user_data.ln = hashData(data.lastName);
  if (data.city) user_data.ct = hashData(data.city);
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

// Send event to Meta CAPI (server-side)
export async function sendMetaCAPI(
  pixelId: string,
  accessToken: string,
  events: Array<{
    eventName: string;
    eventTime?: number;
    actionSource?: string;
    eventId?: string;
    eventSourceUrl?: string;
    userData: ReturnType<typeof buildMetaUserData>;
    customData?: Record<string, any>;
  }>
): Promise<{ success: boolean; error?: string }> {
  const url = `https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${accessToken}`;

  const payload = {
    data: events.map((evt) => ({
      event_name: evt.eventName,
      event_time: evt.eventTime ?? Math.floor(Date.now() / 1000),
      action_source: evt.actionSource ?? 'website',
      event_id: evt.eventId,
      event_source_url: evt.eventSourceUrl,
      user_data: evt.userData,
      custom_data: evt.customData,
    })),
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${error}` };
    }

    const result = await response.json();
    if (result.error) {
      return { success: false, error: result.error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error' };
  }
}

// Get fbc and fbp from cookies (client-side)
export function getMetaCookies(): { fbp: string | null; fbc: string | null } {
  if (typeof document === 'undefined') return { fbp: null, fbc: null };

  const getCookie = (name: string) =>
    document.cookie.split('; ').find((row) => row.startsWith(`${name}=`))?.split('=')[1] || null;

  return {
    fbc: getCookie('_fbc'),
    fbp: getCookie('_fbp'),
  };
}

// Fire Meta Pixel event (client-side)
export function fireMetaPixel(eventName: string, params?: Record<string, any>) {
  if (typeof window === 'undefined') return;
  const fbq = (window as any).fbq;
  if (typeof fbq === 'function') {
    fbq('track', eventName, params);
  }
}
