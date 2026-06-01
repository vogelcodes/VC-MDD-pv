/**
 * Unified Tracking Module for LactoFlow
 * 
 * Usage:
 * 
 * Server-side (API endpoints):
 *   import { sendMetaCAPI, buildMetaUserData, type MetaEventPayload } from '../utils/tracking/meta'
 * 
 * Client-side (Astro component scripts):
 *   import { fireMetaPixel, getMetaCookies } from '../utils/tracking'
 *   import { fireGoogleAdsConversion } from '../utils/tracking/googleAds'
 * 
 * Event flow:
 *   1. Middleware bootstraps cookies (uuid, _fbc, _fbp, event_id) + geolocation
 *   2. Layout.astro fires client-side PageView (fbq) + server-side PageView (POST /api/track)
 *   3. Lead events fire from /forms/leads-astro (server) + fbqTrack('Lead') (client)
 *   4. Video progress fires from client JS → POST /api/video-progress
 *   5. Purchase fires from Hotmart webhook → /api/wh/[id]
 * 
 * Environment variables needed:
 *   META_PIXEL_ID=id1,id2 (comma-separated for multiple)
 *   META_PIXEL_ACCESS_TOKEN=tok1,tok2 (comma-separated, same order)
 *   GOOGLE_ADS_ID=AW-16561604318
 *   GOOGLE_ADS_LEAD_LABEL=Lead
 *   GOOGLE_ADS_PURCHASE_LABEL=Purchase
 *   GSHEET_LEAD_WEBHOOK_URL=https://...
 *   TELEGRAM_BOT_URL=https://api.telegram.org/botXXX:YYY/sendMessage?chat_id=...
 */

export * from './meta';
export * from './googleAds';
