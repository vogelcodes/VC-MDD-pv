import { sendToMeta } from "./utils/metaConversionsAPI";
import { v4 as uuidv4 } from "uuid"; // For random number generation
import { encryptData, decryptData, type LocationInfo } from "./utils/crypto";

const ADMIN_USERNAME = import.meta.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = import.meta.env.ADMIN_PASSWORD;
const LOCATION_COOKIE_NAME = "loc_info";
const LOCATION_COOKIE_MAX_AGE_SECONDS = 24 * 60 * 60; // 1 day

// Helper function to get client IP
function getClientIp(request: Request): string | null {
  // Standard headers, including Cloudflare
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0].trim() ||
    request.headers.get("Remote-Addr"); // Less reliable, often server IP
  return ip || null;
}

export const onRequest = async (
  { locals, request, cookies }: { locals: any; request: Request; cookies: any }, // Add cookies to context
  next: () => Promise<Response>
) => {
  console.time("onRequest - start");

  const url = new URL(request.url);
  const fbclid = url.searchParams.get("fbclid");
  console.log("fbclid", fbclid);

  // Check if the request is for an admin route
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

  const locationCookie = cookies.get(LOCATION_COOKIE_NAME);
  if (locationCookie?.value) {
    console.log("Existing location cookie found.");
    const decryptedData = decryptData(locationCookie.value);
    if (decryptedData) {
      try {
        const parsedData: LocationInfo = JSON.parse(decryptedData);
        // Check if the IP in the cookie matches the current request IP
        const clientIp = getClientIp(request);
        if (parsedData.query === clientIp) {
          console.log(
            "Decrypted location data matches current IP:",
            parsedData
          );
          locationInfo = parsedData;
        } else {
          console.log(
            "IP mismatch in location cookie. Old:",
            parsedData.query,
            "New:",
            clientIp
          );
          // Invalidate cookie data if IP changed
          cookies.delete(LOCATION_COOKIE_NAME, { path: "/" }); // Delete old cookie
        }
      } catch (e) {
        console.error("Error parsing decrypted location data:", e);
        cookies.delete(LOCATION_COOKIE_NAME, { path: "/" }); // Delete corrupted cookie
      }
    } else {
      console.log("Failed to decrypt location cookie.");
      cookies.delete(LOCATION_COOKIE_NAME, { path: "/" }); // Delete undecryptable cookie
    }
  } else {
    console.log("No location cookie found.");
  }

  // Perform lookup if locationInfo is still null and we have an IP
  const clientIp = getClientIp(request);
  if (!locationInfo && clientIp) {
    console.log(`Performing IP geolocation lookup for ${clientIp}...`);
    try {
      // Request specific fields from ip-api
      const geoResponse = await fetch(
        `http://ip-api.com/json/${clientIp}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`
      );
      const geoData: LocationInfo = await geoResponse.json();

      if (geoData.status === "success" && geoData.query) {
        console.log("Geolocation lookup successful:", geoData);
        locationInfo = geoData; // Use fetched data
        needsLocationCookieUpdate = true; // Mark that we need to set the cookie later
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
  } else if (locationInfo) {
    console.log("Using location info from cookie/cache.");
  } else {
    console.log("Skipping geolocation lookup (no IP or already have info).");
  }
  // Store location info in locals for potential use in pages/endpoints
  locals.locationInfo = locationInfo;

  let fbcCookie = cookies.get("_fbc"); // Use Astro's cookies object
  let fbpCookie = cookies.get("_fbp"); // Use Astro's cookies object
  let fbcValue: string | undefined = fbcCookie?.value;
  let fbpValue: string | undefined = fbpCookie?.value;
  const currentTimestamp = Date.now();
  let needsFbcCookieUpdate = false;
  let needsFbpCookieUpdate = false;

  if (fbclid) {
    console.log("fbclid found:", fbclid);
    const subdomainIndex = 1; // As per Meta docs for server-side generation
    const newFbcValue = `fb.${subdomainIndex}.${currentTimestamp}.${fbclid}`;

    // Check if we need to update fbc
    const existingFbclid = fbcValue ? fbcValue.split(".").pop() : null;
    if (!fbcValue || existingFbclid !== fbclid) {
      console.log("Setting/updating fbc value for event/cookie:", newFbcValue);
      fbcValue = newFbcValue; // Update fbcValue to be used in event and potentially set in cookie later
      needsFbcCookieUpdate = true;
    } else {
      console.log(
        "Existing fbc cookie found and fbclid matches. Not updating cookie value, but using existing value for event."
      );
    }

    // Generate fbp if it doesn't exist
    if (!fbpValue) {
      const randomNumber = uuidv4().replace(/-/g, "").slice(0, 16); // Generate and limit random part
      const newFbpValue = `fb.${subdomainIndex}.${currentTimestamp}.${randomNumber}`;
      console.log("Generating fbp value for event/cookie:", newFbpValue);
      fbpValue = newFbpValue; // Update fbpValue to be used in event and potentially set in cookie later
      needsFbpCookieUpdate = true;
    } else {
      console.log("Existing fbp cookie found. Using existing value for event.");
    }

    // Prepare and send PageView event
    if (fbcValue && fbpValue) {
      // Ensure we have values before sending
      const eventData = {
        data: [
          {
            event_name: "PageView",
            event_time: Math.floor(currentTimestamp / 1000), // Meta expects seconds
            action_source: "website",
            event_source_url: request.url,
            user_data: {
              fbc: fbcValue,
              fbp: fbpValue,
              client_ip_address: clientIp,
              client_user_agent: request.headers.get("User-Agent"),
            },
            custom_data: {},
          },
        ],
        // test_event_code: 'YOUR_TEST_EVENT_CODE' // Add if testing
      };

      console.log(
        "Sending PageView event to Meta:",
        JSON.stringify(eventData, null, 2)
      );
      sendToMeta(eventData); // Send event (fire and forget)
    }
  } else {
    console.log("No fbclid found in URL.");
    // Optionally: Send PageView event even without fbclid, using existing cookies if available
    if (fbcValue || fbpValue) {
      const eventData = {
        data: [
          {
            event_name: "PageView",
            event_time: Math.floor(currentTimestamp / 1000),
            action_source: "website",
            event_source_url: request.url,
            user_data: {
              ...(fbcValue && { fbc: fbcValue }),
              ...(fbpValue && { fbp: fbpValue }),
              client_ip_address: clientIp,
              client_user_agent: request.headers.get("User-Agent"),
            },
            custom_data: {},
          },
        ],
      };
      console.log(
        "Sending PageView event to Meta (no fbclid):",
        JSON.stringify(eventData, null, 2)
      );
      sendToMeta(eventData);
    }
  }

  // --- Process request and modify response ---
  console.time("next()");
  const response = await next();
  console.timeEnd("next()");

  // Set cookies on the response if they were generated/updated
  const cookieOptions = {
    path: "/",
    maxAge: 90 * 24 * 60 * 60, // 90 days in seconds
    httpOnly: true, // Recommended for security
    secure: import.meta.env.PROD, // Use Astro's env variable for production check
    sameSite: "Lax" as const,
  };

  // Set Location Cookie if needed
  if (needsLocationCookieUpdate && locationInfo) {
    const dataToEncrypt = JSON.stringify(locationInfo);
    const encryptedLocation = encryptData(dataToEncrypt);
    if (encryptedLocation) {
      console.log("Setting encrypted location cookie.");
      cookies.set(LOCATION_COOKIE_NAME, encryptedLocation, {
        ...cookieOptions,
        maxAge: LOCATION_COOKIE_MAX_AGE_SECONDS,
      });
    } else {
      console.error("Failed to encrypt location data. Cookie not set.");
    }
  }

  // Set FBC Cookie if needed
  if (needsFbcCookieUpdate && fbcValue) {
    console.log("Setting _fbc cookie in response:", fbcValue);
    cookies.set("_fbc", fbcValue, {
      ...cookieOptions,
      maxAge: 90 * 24 * 60 * 60, // 90 days
    });
  }

  // Set FBP Cookie if needed
  if (needsFbpCookieUpdate && fbpValue) {
    console.log("Setting _fbp cookie in response:", fbpValue);
    cookies.set("_fbp", fbpValue, {
      ...cookieOptions,
      maxAge: 90 * 24 * 60 * 60, // 90 days
    });
  }

  console.timeEnd("onRequest - start");
  return response; // Return the original or modified response
};
