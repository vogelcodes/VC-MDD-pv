import { defineMiddleware } from "astro:middleware";
import { sendToMeta } from "./utils/metaConversionsAPI";
// import { v4 as uuidv4 } from "uuid"; // Not used directly
import { encryptData, decryptData, type LocationInfo } from "./utils/crypto";
import { hashUserData, type RawUserData } from "./utils/hashing"; // Import the new hashing utility
import { createId } from "@paralleldrive/cuid2";
// import { sha256 } from "crypto"; // Incorrect import, remove
import { UAParser } from "ua-parser-js";

const ADMIN_USERNAME = import.meta.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = import.meta.env.ADMIN_PASSWORD;
const LOCATION_COOKIE_NAME = "loc_info";
const LOCATION_COOKIE_MAX_AGE_SECONDS = 24 * 60 * 60; // 1 day
// const LOCATION_ENCRYPTION_KEY = import.meta.env.LOCATION_ENCRYPTION_KEY; // Not used directly
// const META_ACCESS_TOKEN = import.meta.env.META_ACCESS_TOKEN; // Not used directly

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
  // console.time("onRequest - start"); // Debug timing
  // console.log("ENCRYPTION_KEY: ", import.meta.env.LOCATION_ENCRYPTION_KEY); // Debug env
  // console.log("encryptData('test'): ", encryptData("test")); // Debug encryption

  const url = new URL(request.url);
  const fbclid = url.searchParams.get("fbclid");
  // console.log("fbclid", fbclid); // Debug fbclid

  let clientUuid = cookies.get("uuid")?.value; // Use existing cookie value
  if (!clientUuid) {
    clientUuid = createId(); // Generate CUID if no cookie
    // Set cookie in the response later
  }
  if (url.pathname.startsWith("/api/wh")) {
    console.log("WH API call detected");
    return next();
  }
  // console.log("clientUuid determined:", clientUuid); // Debug CUID

  // Admin check (keep as is)
  if (url.pathname.startsWith("/admin")) {
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

  // --- Location Cookie / Lookup Logic ---
  let locationInfo: LocationInfo | null = null;
  let needsLocationCookieUpdate = false;
  const clientIp = getClientIp(request);
  // console.log("clientIp determined as:", clientIp); // Debug IP

  const locationCookie = cookies.get(LOCATION_COOKIE_NAME);
  if (locationCookie?.value) {
    // console.log("Existing location cookie found."); // Informational
    const decryptedData = decryptData(locationCookie.value);
    if (decryptedData) {
      try {
        const parsedData: LocationInfo = JSON.parse(decryptedData);
        if (clientIp && parsedData.query === clientIp) {
          // console.log(
          //   "Decrypted location data matches current IP:",
          //   parsedData
          // ); // Debugging cookie data
          locationInfo = parsedData;
        } else if (!clientIp && parsedData.query) {
          // console.log(
          //   "Could not determine current IP, using location data from cookie based on previous IP:",
          //   parsedData.query
          // ); // Debugging cookie data
          locationInfo = parsedData;
        } else {
          // console.log(
          //   "IP mismatch or invalid data in location cookie. Current IP:",
          //   clientIp,
          //   "Cookie IP:",
          //   parsedData.query
          // ); // Debugging cookie data
          cookies.delete(LOCATION_COOKIE_NAME, { path: "/" }); // Delete invalid cookie
        }
      } catch (e) {
        console.error("Error parsing decrypted location data:", e);
        cookies.delete(LOCATION_COOKIE_NAME, { path: "/" });
      }
    } else {
      // console.log("Failed to decrypt location cookie."); // Informational / Error
      cookies.delete(LOCATION_COOKIE_NAME, { path: "/" });
    }
  } else {
    // console.log("No location cookie found."); // Informational
  }

  if (!locationInfo) {
    if (import.meta.env.DEBUG === "1") {
      console.log(`DEBUG MODE: Using mock geolocation data.`); // Keep: Debug mode
      const mockQueryIp = clientIp || "127.0.0.1";
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
        isp: "Mock ISP (Dev Mode)", // Indicate mock
        org: "Mock Org (Dev Mode)",
        as: "Mock AS (Dev Mode)",
        query: mockQueryIp,
      };
      needsLocationCookieUpdate = true;
    } else if (clientIp) {
      // console.log(
      //   `PRODUCTION MODE: Performing IP geolocation lookup for ${clientIp}...`
      // ); // Informational
      try {
        const geoResponse = await fetch(
          `http://ip-api.com/json/${clientIp}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`
        );
        const geoData: LocationInfo = await geoResponse.json();

        if (geoData.status === "success" && geoData.query) {
          console.log(
            "Geolocation lookup successful:",
            JSON.stringify(geoData, null, 2)
          ); // Keep: Location Info
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
    } else {
      // console.log(
      //   "PRODUCTION MODE: Skipping geolocation lookup as client IP could not be determined."
      // ); // Informational
    }
  } else {
    // console.log("Using location info from cookie."); // Informational
  }

  // Store final location info in locals
  locals.locationInfo = locationInfo;
  locals.clientUuid = clientUuid; // Pass CUID via locals

  // --- Meta Pixel Cookie (_fbc, _fbp) Handling ---
  let fbcCookie = cookies.get("_fbc");
  let fbpCookie = cookies.get("_fbp");
  let fbcValue: string | undefined = fbcCookie?.value;
  let fbpValue: string | undefined = fbpCookie?.value;
  const currentTimestamp = Date.now();
  let needsFbcCookieUpdate = false;
  let needsFbpCookieUpdate = false;

  if (fbclid) {
    // console.log("fbclid found:", fbclid); // Informational
    const creationTime = Math.floor(currentTimestamp / 1000);
    const newFbcValue = `fb.1.${creationTime}.${fbclid}`;
    if (fbcValue !== newFbcValue) {
      // console.log("Setting/updating fbc value for event/cookie:", newFbcValue); // Informational
      fbcValue = newFbcValue;
      needsFbcCookieUpdate = true;
    }
  } // No else needed, if no fbclid, use existing fbcValue (which might be undefined)

  if (!fbpValue) {
    // console.log("No existing fbp cookie found, generating new one."); // Informational
    const creationTime = Math.floor(currentTimestamp / 1000);
    const randomNumber = Math.floor(Math.random() * 10000000000);
    fbpValue = `fb.1.${creationTime}.${randomNumber}`;
    needsFbpCookieUpdate = true;
  } // else { console.log("Using existing fbp cookie value:", fbpValue); } // Informational

  // --- Hashing Data for Meta --- NOTE: Only location data is available here
  const rawLocationData: RawUserData = {
    city: locationInfo?.city,
    state: locationInfo?.region,
    countryCode: locationInfo?.countryCode,
  };
  const hashedLocationData = hashUserData(rawLocationData); // Remove extra 'true' argument
  // console.log("hashedLocationData", hashedLocationData); // Debug hash

  // --- Prepare Meta PageView Event Data ---
  // Declare pageViewEventData *before* using it in logs
  const pageViewEventData = {
    event_name: "PageView",
    event_time: Math.floor(currentTimestamp / 1000),
    action_source: "website",
    event_source_url: url.href,
    event_id: clientUuid + "_" + currentTimestamp, // Unique event ID
    user_data: {
      ...hashedLocationData,
      client_ip_address: clientIp || undefined, // Pass IP if available
      client_user_agent: request.headers.get("user-agent") || "",
      fbc: fbcValue || undefined,
      fbp: fbpValue || undefined,
      external_id: clientUuid, // Pass CUID
    },
  };

  // Log the final PageView event data (useful for debugging Meta calls)
  console.log(
    "Final PageView Event Data (Server-Side):",
    JSON.stringify(pageViewEventData, null, 2)
  ); // Keep: PageView Event Data

  // --- Send PageView Event to Meta (Server-Side) ---
  // Only send if not in DEBUG mode AND fbclid is present
  if (import.meta.env.DEBUG !== "1" && fbclid) {
    try {
      // Don't await, let it run in the background

      sendToMeta({ data: [pageViewEventData] });
    } catch (error) {
      console.error("Error sending server-side PageView event to Meta:", error);
    }
  } else if (import.meta.env.DEBUG === "1") {
    console.log("DEBUG MODE: Not sending server-side PageView event to Meta"); // Keep: Debug mode
  } else {
    // Log why it wasn't sent (missing fbclid)
    console.log(
      "Not sending server-side PageView event to Meta: Missing fbclid"
    );
  }

  // --- Process Request and Get Response ---
  const response = await next();

  // --- Set Cookies on the Response ---
  const baseCookieOptions = {
    path: "/",
    httpOnly: true,
    secure: import.meta.env.PROD, // True in production
    sameSite: "Lax" as const,
  };

  // Set UUID cookie if it wasn't present on request
  if (!cookies.get("uuid")) {
    response.headers.append(
      "Set-Cookie",
      cookies.serialize("uuid", clientUuid, {
        ...baseCookieOptions,
        maxAge: 60 * 60 * 24 * 365,
      }) // 1 year
    );
  }

  // Set Location Cookie if needed
  // Use locationCookie?.value check here
  // if (needsLocationCookieUpdate && locationInfo && !locationCookie?.value) {
  //   try {
  //     const dataToEncrypt = JSON.stringify(locationInfo);
  //     const encryptedLocation = encryptData(dataToEncrypt);
  //     if (encryptedLocation) {
  //       // console.log("Setting encrypted location cookie."); // Informational
  //       response.headers.append(
  //         "Set-Cookie",
  //         cookies.serialize(LOCATION_COOKIE_NAME, encryptedLocation, {
  //           ...baseCookieOptions,
  //           maxAge: LOCATION_COOKIE_MAX_AGE_SECONDS,
  //         })
  //       );
  //     } else {
  //       console.error("Failed to encrypt location data. Cookie not set.");
  //     }
  //   } catch (error) {
  //     console.error("Error encrypting or setting location cookie:", error);
  //   }
  // }

  // Set FBC Cookie if needed
  // if (needsFbcCookieUpdate && fbcValue) {
  //   // console.log("Setting _fbc cookie in response:", fbcValue); // Informational
  //   response.headers.append(
  //     "Set-Cookie",
  //     cookies.serialize("_fbc", fbcValue, {
  //       ...baseCookieOptions,
  //       httpOnly: false, // Needs to be readable by client-side JS
  //       maxAge: 90 * 24 * 60 * 60, // 90 days
  //     })
  //   );
  // }

  // // Set FBP Cookie if needed
  // if (needsFbpCookieUpdate && fbpValue) {
  //   // console.log("Setting _fbp cookie in response:", fbpValue); // Informational
  //   response.headers.append(
  //     "Set-Cookie",
  //     cookies.serialize("_fbp", fbpValue, {
  //       ...baseCookieOptions,
  //       httpOnly: false, // Needs to be readable by client-side JS
  //       maxAge: 90 * 24 * 60 * 60, // 90 days
  //     })
  //   );
  // }

  // console.timeEnd("onRequest - start"); // Debug timing
  return response;
};

export const onRequest = defineMiddleware(middleware);
