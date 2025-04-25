const META_PIXEL_ACCESS_TOKEN = import.meta.env.META_PIXEL_ACCESS_TOKEN;
const META_PIXEL_ID = import.meta.env.META_PIXEL_ID;

export const sendToMeta = async (metaEventData: any) => {
  console.log("metaEventData", JSON.stringify(metaEventData, null, 2));
  try {
    if (!META_PIXEL_ACCESS_TOKEN || !META_PIXEL_ID) {
      console.error(
        "META_PIXEL_ACCESS_TOKEN or META_PIXEL_ID are not set in environment variables"
      );
      return;
    }
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${META_PIXEL_ID}/events?access_token=${META_PIXEL_ACCESS_TOKEN}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metaEventData),
      }
    );

    const result = await response.json();
    console.log("Meta Conversion API Response:", result);

    if (result.error) {
      console.error("Meta Conversion API Error:", result.error);
    }
  } catch (error) {
    console.error("Error sending data to Meta Conversion API:", error);
  }
};

// Call the function to send data to Meta
