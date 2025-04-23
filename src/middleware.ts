import { sendToMeta } from "./utils/metaConversionsAPI";

const ADMIN_USERNAME = import.meta.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = import.meta.env.ADMIN_PASSWORD;

export const onRequest = async (
  context: { request: Request },
  next: () => Promise<Response>
) => {
  console.time("onRequest");
  const { request } = context;
  if (request.url.includes("fbclid=")) {
    //Get fbclid from url
    const fbclid = request.url.split("fbclid=")[1];
    const metaEventData = {
      data: [
        {
          event_name: "ViewContent", // Standard event name for a lead
          event_time: Math.floor(Date.now() / 1000), // Current timestamp in seconds
          action_source: "website",
          user_data: {
            fbc: fbclid,
          },
        },
      ],
      test_event_code: "TEST41321",
    };
    sendToMeta(metaEventData);
  }
  // Check if the request is for an admin route
  if (request.url.includes("/admin")) {
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

  console.timeEnd("onRequest");
  return next();
};
