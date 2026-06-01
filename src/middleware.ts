/**
 * Middleware — lightweight request processing.
 *
 * Responsibilities:
 *  1. Early-return for static assets
 *  2. Block bots (Facebook crawler)
 *  3. Basic auth for admin paths
 *  4. Geolocation lookup (cached in encrypted cookie + locals)
 *  5. Cookie bootstrapping: uuid, _fbc, _fbp, event_id
 *
 * ❌ Does NOT send any events to Meta/Google/etc.
 *    Events are sent via POST /api/track (called from client-side JS).
 */

import { defineMiddleware } from "astro:middleware";
import { encryptData, decryptData, type LocationInfo } from "./utils/crypto";
import { createId } from "@paralleldrive/cuid2";

const ADMIN_USERNAME = import.meta.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = import.meta.env.ADMIN_PASSWORD;
const LOCATION_COOKIE_NAME = "loc_info";
const LOCATION_COOKIE_MAX_AGE_SECONDS = 24 * 60 * 60; // 1 day

// Helper function to get client IP
function getClientIp(request: Request): string | null {
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0].trim() ||
    request.headers.get("Remote-Addr");
  return ip || null;
}

const middleware = async (
  { locals, request, cookies }: { locals: any; request: Request; cookies: any },
  next: () => Promise<Response>
) => {
  const url = new URL(request.url);
  const fbclid = url.searchParams.get("fbclid");
  const clientUserAgent = request.headers.get("user-agent");

  // ── 1. Early return for static assets ────────────────────────────
  if (
    url.pathname.startsWith("/_image") ||
    url.pathname.startsWith("/_astro") ||
    url.pathname.startsWith("/favicon") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".xml") ||
    url.pathname.endsWith(".txt") ||
    url.pathname.endsWith(".json") ||
    url.pathname.endsWith(".webmanifest")
  ) {
    return next();
  }

  // ── 2. Block / skip bots ─────────────────────────────────────────
  const isFacebookBot =
    clientUserAgent ===
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

  if (isFacebookBot) {
    console.log("Facebook Bot detected, skipping middleware processing");
    return next();
  }

  // ── 3. Webhook passthrough ───────────────────────────────────────
  if (url.pathname.startsWith("/api/wh")) {
    return next();
  }

  // ── 4. Basic auth for admin paths ────────────────────────────────
  const authPaths = ["/admin", "/test"];
  if (authPaths.includes(url.pathname)) {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Basic ")) {
      return new Response("Authentication required", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="Admin Area"',
        },
      });
    }

    const base64Credentials = authHeader.split(" ")[1];
    const credentials = atob(base64Credentials);
    const [username, password] = credentials.split(":");

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return new Response("Invalid credentials", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="Admin Area"',
        },
      });
    }
  }

  // ── 5. UUID cookie ───────────────────────────────────────────────
  let clientUuid = cookies.get("uuid")?.value;
  if (!clientUuid) {
    clientUuid = createId();
    cookies.set("uuid", clientUuid, {
      path: "/",
      httpOnly: false,
      maxAge: 365 * 24 * 60 * 60, // 1 year
    });
  }
  locals.clientUuid = clientUuid;

  // ── 6. Event ID cookie (for client/server deduplication) ─────────
  const currentTimestampMs = Date.now();
  let eventId = fbclid || `${clientUuid}_${currentTimestampMs}`;
  cookies.set("event_id", eventId, { path: "/", httpOnly: false });
  locals.eventId = eventId;

  // ── 7. _fbc / _fbp cookie bootstrapping ──────────────────────────
  let fbcValue: string | undefined = cookies.get("_fbc")?.value;
  let fbpValue: string | undefined = cookies.get("_fbp")?.value;

  if (fbclid) {
    const newFbcValue = `fb.1.${currentTimestampMs}.${fbclid}`;
    if (fbcValue !== newFbcValue) {
      fbcValue = newFbcValue;
      cookies.set("_fbc", fbcValue, {
        path: "/",
        httpOnly: false,
        maxAge: 90 * 24 * 60 * 60, // 90 days
      });
    }
  }

  if (!fbpValue) {
    const randomNumber = Math.floor(Math.random() * 10000000000);
    fbpValue = `fb.1.${currentTimestampMs}.${randomNumber}`;
    cookies.set("_fbp", fbpValue, {
      path: "/",
      httpOnly: false,
      maxAge: 90 * 24 * 60 * 60, // 90 days
    });
  }

  // ── 8. Geolocation (cached in encrypted cookie) ──────────────────
  let locationInfo: LocationInfo | null = null;
  let needsLocationCookieUpdate = false;
  const clientIp = getClientIp(request);

  // Try to read from existing cookie
  const locationCookie = cookies.get(LOCATION_COOKIE_NAME);
  if (locationCookie?.value) {
    const decryptedData = decryptData(locationCookie.value);
    if (decryptedData) {
      try {
        const parsedData: LocationInfo = JSON.parse(decryptedData);
        if (clientIp && parsedData.query === clientIp) {
          locationInfo = parsedData;
        } else if (!clientIp && parsedData.query) {
          locationInfo = parsedData;
        } else {
          cookies.delete(LOCATION_COOKIE_NAME, { path: "/" });
        }
      } catch (e) {
        console.error("Error parsing decrypted location data:", e);
        cookies.delete(LOCATION_COOKIE_NAME, { path: "/" });
      }
    } else {
      cookies.delete(LOCATION_COOKIE_NAME, { path: "/" });
    }
  }

  // Fetch fresh geolocation if not cached
  if (!locationInfo) {
    if (import.meta.env.DEBUG === "1") {
      console.log("DEBUG MODE: Using mock geolocation data.");
      locationInfo = {
        status: "success",
        country: "United States",
        countryCode: "US",
        region: "CA",
        regionName: "California",
        city: "Los Angeles",
        zip: "90038",
        lat: 33.9533,
        lon: -43.1883,
        timezone: "America/Sao_Paulo",
        isp: "Mock ISP (Dev Mode)",
        org: "Mock Org (Dev Mode)",
        as: "Mock AS (Dev Mode)",
        query: clientIp || "127.0.0.1",
      };
      needsLocationCookieUpdate = true;
    } else if (clientIp) {
      try {
        const geoResponse = await fetch(
          `http://ip-api.com/json/${clientIp}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`
        );
        const geoData: LocationInfo = await geoResponse.json();

        if (geoData.status === "success" && geoData.query) {
          locationInfo = geoData;
          needsLocationCookieUpdate = true;
        } else {
          console.error(
            "Geolocation lookup failed:",
            geoData.status,
            geoData.message
          );
        }
      } catch (error) {
        console.error("Error during IP geolocation lookup:", error);
      }
    }
  }

  // Persist location cookie if updated
  if (needsLocationCookieUpdate && locationInfo) {
    const encrypted = encryptData(JSON.stringify(locationInfo));
    if (encrypted) {
      cookies.set(LOCATION_COOKIE_NAME, encrypted, {
        path: "/",
        httpOnly: true,
        maxAge: LOCATION_COOKIE_MAX_AGE_SECONDS,
      });
    }
  }

  // Expose to downstream pages / API routes via locals
  locals.locationInfo = locationInfo;

  // ── 9. Process request ───────────────────────────────────────────
  const response = await next();

  // Ensure UTF-8 charset for HTML responses
  try {
    const contentType = response.headers.get("content-type");
    if (!contentType && response.headers) {
      const looksHtml = url.pathname.endsWith(".html") || url.pathname === "/";
      if (looksHtml) {
        response.headers.set("content-type", "text/html; charset=utf-8");
      }
    } else if (
      contentType &&
      contentType.startsWith("text/html") &&
      !/charset=/i.test(contentType)
    ) {
      response.headers.set("content-type", "text/html; charset=utf-8");
    }
  } catch (e) {
    // noop: don't break request pipeline for header setting issues
  }

  return response;
};

export const onRequest = defineMiddleware(middleware);
