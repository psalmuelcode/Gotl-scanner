const fetch = require("node-fetch");

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  const data = JSON.parse(event.body);

  try {
    const response = await fetch("https://script.google.com/macros/s/AKfycbzsUjkeMPvbuyxbZtwRYQykqOFQiuvMJEwstSOLXvHBY_djnrQlhEMg1PNfChB11j9Fjg/exec", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const text = await response.text();

    return {
      statusCode: 200,
      body: text,
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: `Proxy error: ${error.message}`,
    };
  }
};
