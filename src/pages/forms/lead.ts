import type { APIRoute } from "astro";
import { formatPhoneNumber } from "react-phone-number-input";

export const GET: APIRoute = ({ params, request }) => {
  return new Response(
    JSON.stringify({
      message: "This was a GET!",
    })
  );
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const userIP = "";
    const data = await request.formData();
    const name = data.get("name");
    const email = data.get("email");
    const phoneac = data.get("phoneac");
    const phone = data.get("phone");
    const source = data.get("source");
    console.log(data, userIP);
    return new Response(null, {
      status: 302,
      headers: {
        Location: `https://pay.hotmart.com/O84147403X?off=32k5pbhv&checkoutMode=10&sck=${source}&email=${email}&name=${name}&phonenumber=${phoneac}`,
      },
    });

    // Do something with the data
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: "https://pv.lactoflow.com.br",
    },
  });
};

export const DELETE: APIRoute = ({ request }) => {
  return new Response(
    JSON.stringify({
      message: "This was a DELETE!",
    })
  );
};

export const ALL: APIRoute = ({ request }) => {
  return new Response(
    JSON.stringify({
      message: `This was a ${request.method}!`,
    })
  );
};
