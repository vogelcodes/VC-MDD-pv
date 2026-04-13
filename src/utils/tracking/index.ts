/**
 * Unified Tracking Module for LactoFlow
 * 
 * Usage:
 * 
 * Client-side (in Astro components):
 *   import { fireMetaPixel, fireGoogleAdsConversion, getMetaCookies } from '../utils/tracking'
 *   fireMetaPixel('Lead', { lead_score: 75 })
 *   fireGoogleAdsConversion('AW-16561604318', 'Lead')
 * 
 * Server-side API endpoints:
 *   import { sendMetaCAPI, buildMetaUserData } from '../utils/tracking/meta'
 *   import { sendGoogleAdsEnhancedConversion } from '../utils/tracking/googleAds'
 * 
 * Environment variables needed:
 *   META_PIXEL_ID=879805447822781 (comma-separated for multiple)
 *   META_ACCESS_TOKEN=EAADzCoQr2C8... (comma-separated, same order)
 *   GOOGLE_ADS_ID=AW-16561604318
 *   GOOGLE_ADS_LEAD_LABEL=Lead
 *   GOOGLE_ADS_PURCHASE_LABEL=Purchase
 *   GSHEET_LEAD_WEBHOOK_URL=https://...
 *   TELEGRAM_BOT_URL=https://api.telegram.org/botXXX:YYY/sendMessage?chat_id=...
 */

export * from './meta';
export * from './googleAds';
