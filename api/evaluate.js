const express = require("express");
const serverless = require("serverless-http");
const xml2js = require("xml2js");
const { convertToXML } = require("../utils/xmlUtils");
const { processProductRequest } = require("../functions/productProcessor");
const cors = require("cors");

const app = express();

// Middleware
app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ extended: true, limit: "500mb" }));
app.use(express.text({ type: "application/xml" }));

app.use(cors({
  origin: "*", // adjust if needed
  methods: "GET,POST,OPTIONS",
  allowedHeaders: "Content-Type",
}));

// Helper
async function parseXML(xmlPayload) {
  try {
    return await xml2js.parseStringPromise(xmlPayload, {
      explicitArray: false,
    });
  } catch (error) {
    throw new Error(`Error parsing XML: ${error.message}`);
  }
}

// POST /evaluate
app.post("/evaluate", async (req, res) => {
  const xmlPayload = req.body;

  try {
    const parsedPayload = await parseXML(xmlPayload);
    const root = parsedPayload.quote;
    const { product: productFromPayload, status } = root;
    const productFromQuery = req.query.product;
    const product = productFromQuery || productFromPayload;

    if (!product) {
      return res.status(400).json({
        success: false,
        message: "Missing Product field in payload or query string",
      });
    }

    if (productFromQuery && productFromPayload && productFromQuery !== productFromPayload) {
      return res.status(400).json({
        success: false,
        message: `Mismatch between query string product ('${productFromQuery}') and payload product ('${productFromPayload}')`,
      });
    }

    const response = await processProductRequest(product, status, root);

    if (req.headers["accept"]?.includes("application/xml")) {
      const xmlResponse = convertToXML(response);
      res.set("Content-Type", "application/xml");
      res.send(xmlResponse);
    } else {
      res.json({ success: true, root: response });
    }

  } catch (error) {
    console.error("Error processing /evaluate request:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports.handler = serverless(app);