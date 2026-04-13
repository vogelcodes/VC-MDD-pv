/**
 * Purchase Event Endpoint - Hotmart Webhook Handler
 * Receives PURCHASE_APPROVED from Hotmart and fires:
 * - Meta CAPI (Purchase event)
 * - Google Ads Enhanced Conversion (Purchase event)
 * - Telegram notification
 */

import { sendMetaCAPI, buildMetaUserData } from '../../../utils/tracking/meta';
import { fireGoogleAdsConversion } from '../../../utils/tracking/googleAds';

const META_PIXEL_ID = import.meta.env.META_PIXEL_ID;
const META_ACCESS_TOKEN = import.meta.env.META_ACCESS_TOKEN;
const GOOGLE_ADS_ID = import.meta.env.GOOGLE_ADS_ID || 'AW-16561604318';
const GOOGLE_ADS_PURCHASE_LABEL = import.meta.env.GOOGLE_ADS_PURCHASE_LABEL || 'Purchase';
const TELEGRAM_BOT_URL = import.meta.env.TELEGRAM_BOT_URL;

export async function POST() {
  let requestBody: any;
  
  try {
    requestBody = await Astro.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Only process PURCHASE_APPROVED events
  if (requestBody?.event !== 'PURCHASE_APPROVED') {
    return new Response(null, { status: 204 });
  }

  const { data } = requestBody;
  const { buyer, purchase } = data;

  if (!buyer || !purchase) {
    console.error('Missing buyer or purchase data');
    return new Response(JSON.stringify({ error: 'Missing data' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const {
    email,
    name,
    first_name,
    last_name,
    checkout_phone_code,
    checkout_phone,
    address,
  } = buyer;

  const {
    full_price,
    transaction,
    order_date,
    payment,
    offer,
    price,
  } = purchase;

  const firstName = first_name;
  const lastName = last_name;
  const phone = `+${checkout_phone_code}${checkout_phone}`;
  const eventTime = purchase?.order_date
    ? Math.floor(Number(purchase.order_date) / 1000)
    : Math.floor(Date.now() / 1000);

  // Extract price value
  const purchaseValue = (() => {
    const raw = price?.value ?? full_price;
    const asNumber = Number(raw);
    return Number.isFinite(asNumber) ? asNumber : undefined;
  })();

  const currency = price?.currency_value || 'BRL';
  const transactionId = transaction;

  // Build user data
  const userData = buildMetaUserData({
    email,
    phone,
    firstName,
    lastName,
    city: address?.city,
    state: address?.state,
    country: address?.country_iso,
    zipCode: address?.zipcode,
  });

  // Also add fbc/fbp if available (from cookies passed in headers or lookup by email)
  // For now, we send what's available from the webhook

  // 1. Meta CAPI - Purchase Event
  if (META_PIXEL_ID && META_ACCESS_TOKEN) {
    const result = await sendMetaCAPI(META_PIXEL_ID, META_ACCESS_TOKEN, [
      {
        eventName: 'Purchase',
        eventTime,
        actionSource: 'website',
        eventId: transactionId,
        eventSourceUrl: offer?.code,
        userData,
        customData: {
          currency: currency,
          value: purchaseValue,
          content_type: 'product',
          order_id: transactionId,
        },
      },
    ]);

    if (result.success) {
      console.log(`Meta CAPI: Purchase event sent for ${email}`);
    } else {
      console.error(`Meta CAPI Error: ${result.error}`);
    }
  }

  // 2. Google Ads Enhanced Conversion (Purchase)
  // Note: Enhanced Conversions API requires OAuth setup
  // For now, we log it - see googleAds.ts for full implementation
  if (GOOGLE_ADS_ID && GOOGLE_ADS_PURCHASE_LABEL) {
    console.log('Google Ads Purchase:', {
      conversionId: GOOGLE_ADS_ID,
      label: GOOGLE_ADS_PURCHASE_LABEL,
      value: purchaseValue,
      transactionId,
    });
    // Full Enhanced Conversion API requires developer token + OAuth
    // Uncomment when credentials are available:
    // await sendGoogleAdsEnhancedConversion(GOOGLE_ADS_ID, GOOGLE_ADS_PURCHASE_LABEL, userData, {
    //   value: purchaseValue,
    //   currency,
    //   transactionId,
    // });
  }

  // 3. Telegram notification
  if (TELEGRAM_BOT_URL) {
    const msg = encodeURIComponent(
      `💰 COMPRA REALIZADA\n` +
      `${firstName} ${lastName}\n` +
      `Email: ${email}\n` +
      `Telefone: ${phone}\n` +
      `Valor: R$ ${purchaseValue?.toFixed(2)}\n` +
      `Transação: ${transactionId}\n` +
      `Data: ${new Date(eventTime * 1000).toLocaleString('pt-BR')}`
    );
    fetch(`${TELEGRAM_BOT_URL}&text=${msg}`).catch((err) =>
      console.error('Telegram error:', err)
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Purchase event processed',
      transaction: transactionId,
    }),
    {
      headers: { 'content-type': 'application/json' },
      status: 200,
    }
  );
}
