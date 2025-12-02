const META_PIXEL_ACCESS_TOKENS_CSV = import.meta.env.META_PIXEL_ACCESS_TOKEN;
const META_PIXEL_IDS_CSV = import.meta.env.META_PIXEL_ID;

export const sendToMeta = async (metaEventData: any) => {
  console.log("metaEventData", JSON.stringify(metaEventData, null, 2));
  try {
    if (!META_PIXEL_ACCESS_TOKENS_CSV || !META_PIXEL_IDS_CSV) {
      console.error(
        "META_PIXEL_ACCESS_TOKEN or META_PIXEL_ID are not set in environment variables"
      );
      return;
    }

    const accessTokens = META_PIXEL_ACCESS_TOKENS_CSV.split(",");
    const pixelIds = META_PIXEL_IDS_CSV.split(",");
    console.log("pixelIds", pixelIds);

    if (accessTokens.length !== pixelIds.length) {
      console.error(
        "Mismatch between the number of Meta Pixel Access Tokens and IDs."
      );
      return;
    }

    for (let i = 0; i < pixelIds.length; i++) {
      const pixelId = pixelIds[i].trim();
      const accessToken = accessTokens[i].trim();

      if (!accessToken || !pixelId) {
        console.error(
          `Missing Access Token or Pixel ID for index ${i}. Skipping.`
        );
        continue;
      }

      console.log(`Sending event to Pixel ID: ${pixelId}`);

      // Create AbortController for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        const response = await fetch(
          `https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${accessToken}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(metaEventData),
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error(
            `Meta Conversion API HTTP Error for Pixel ID ${pixelId}:`,
            response.status,
            response.statusText
          );
          continue;
        }

        const result = await response.json();
        console.log(
          `Meta Conversion API Response for Pixel ID ${pixelId}:`,
          result
        );

        if (result.error) {
          console.error(
            `Meta Conversion API Error for Pixel ID ${pixelId}:`,
            result.error
          );
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === "AbortError") {
          console.error(
            `Meta Conversion API Timeout for Pixel ID ${pixelId} (10s timeout)`
          );
        } else {
          console.error(
            `Meta Conversion API Fetch Error for Pixel ID ${pixelId}:`,
            fetchError.message || fetchError
          );
        }
        // Continue to next pixel instead of breaking the entire function
        continue;
      }
    }
  } catch (error) {
    console.error("Error sending data to Meta Conversion API:", error);
  }
};

// Removed the example call to the function
