/**
 * Google Ads Tracking Utility
 * Handles both client-side gtag and server-side Enhanced Conversions API
 */

import pkg from 'hash.js';
const { sha256 } = pkg;

// Google Ads Configuration
export interface GoogleAdsConfig {
  conversionId: string; // AW-XXXXXXXXX
  leadLabel: string;
  purchaseLabel: string;
}

// Hash a value for Google Enhanced Conversions (same as Meta CAPI)
export function hashData(value: string): string {
  if (!value) return '';
  return sha256().update(value.toLowerCase().trim()).digest('hex');
}

export function hashPhone(phone: string, countryCode = '55'): string {
  const digits = phone.replace(/\D/g, '');
  const withCountry = countryCode ? `+${countryCode}${digits}` : `+${digits}`;
  return hashData(withCountry);
}

export function buildGoogleAdsUserData(data: GoogleAdsUserData) {
  const address: Record<string, string> = {};
  if (data.city) address.city = data.city;
  if (data.state) address.region = data.state;
  if (data.country) address.country = data.country;
  if (data.zipCode) address.postal_code = data.zipCode;

  const userData: Record<string, any> = {};

  if (data.email) userData.email_address = data.email.toLowerCase().trim();
  if (data.phone) userData.phone_number = data.phone.replace(/\D/g, '');
  if (data.firstName || data.lastName) {
    userData.address = {
      ...address,
      ...(data.firstName && { first_name: data.firstName }),
      ...(data.lastName && { last_name: data.lastName }),
    };
  }

  return userData;
}

// Fire Google Ads conversion (client-side gtag)
export function fireGoogleAdsConversion(
  conversionId: string,
  label: string,
  value?: number,
  transactionId?: string
) {
  if (typeof window === 'undefined') return;
  const gtag = (window as any).gtag;
  if (typeof gtag !== 'function') return;

  gtag('event', 'conversion', {
    send_to: `${conversionId}/${label}`,
    ...(value !== undefined && { value }),
    ...(transactionId && { transaction_id: transactionId }),
  });
}

// Send Enhanced Conversion to Google Ads (server-side)
export async function sendGoogleAdsEnhancedConversion(
  conversionId: string,
  conversionLabel: string,
  userData: ReturnType<typeof buildGoogleAdsUserData>,
  customData?: {
    value?: number;
    currency?: string;
    transactionId?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  // Google Ads Enhanced Conversions API endpoint
  const url = `https://googleads.googleapis.com/v18/customers/${conversionId.replace('AW-', '')}/conversions: EnhancedConversions`;

  // Note: This requires a developer token and proper OAuth setup
  // For most cases, use the gtag approach or Google Ads API directly
  // This is a placeholder for when you have the proper credentials

  console.log('Google Enhanced Conversion payload:', {
    conversionId,
    conversionLabel,
    userData,
    customData,
  });

  // TODO: Implement with proper OAuth when you have:
  // - GOOGLE_ADS_DEVELOPER_TOKEN
  // - GOOGLE_ADS_CLIENT_ID
  // - GOOGLE_ADS_CLIENT_SECRET
  // - GOOGLE_ADS_REFRESH_TOKEN

  return { success: false, error: 'Enhanced Conversions API requires OAuth setup. Use client-side gtag for now.' };
}

// Convenience wrappers for specific events
export function fireGoogleAdsLead(conversionId: string, label: string) {
  fireGoogleAdsConversion(conversionId, label);
}

export function fireGoogleAdsPurchase(
  conversionId: string,
  label: string,
  value: number,
  transactionId: string
) {
  fireGoogleAdsConversion(conversionId, label, value, transactionId);
}
