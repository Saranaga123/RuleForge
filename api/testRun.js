const express = require("express");
const serverless = require("serverless-http");
const xml2js = require("xml2js");
const { convertToXML } = require("../utils/xmlUtils");
const { processEvaluation } = require("../functions/productProcessor");
const { router: testfunc } = require("../rules/FuncStr");
const { router: smeRoutes } = require("../functions/SME");
const { router: funcRoutes } = require("../functions/FuncList");
const { router: paRoutes } = require("../functions/PA");
const cors = require("cors");

const app = express();

// Middleware
app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ extended: true, limit: "500mb" }));
app.use(express.text({ type: "application/xml" }));

app.use(cors({
  origin: "*", // adjust if you want a specific frontend
  methods: "GET,POST,OPTIONS",
  allowedHeaders: "Content-Type",
}));

// Routes
app.use("/", testfunc);
app.use("/", smeRoutes);
app.use("/", funcRoutes);
app.use("/", paRoutes);

// Helper function
async function parseXML(xmlPayload) {
  try {
    return await xml2js.parseStringPromise(xmlPayload, {
      explicitArray: false,
    });
  } catch (error) {
    throw new Error(`Error parsing XML: ${error.message}`);
  }
}

// POST /testRun
app.post("/testRun", async (req, res) => {
  try {
    const { rules, xml } = req.body;

    if (!xml) {
      return res.status(400).json({ error: "No XML provided in the request" });
    }

    const parsedXml = await parseXML(xml);
    const quote = parsedXml.quote;
    const productFromPayload = quote.product;
    const status = quote.status;
    const productFromQuery = req.query.product;
    const product = productFromQuery || productFromPayload;

    if (productFromQuery && productFromPayload && productFromQuery !== productFromPayload) {
      return res.status(400).json({
        success: false,
        message: `Mismatch between query string product ('${productFromQuery}') and payload product ('${productFromPayload}')`,
      });
    }

    const response = await processEvaluation(product, status, quote, rules);

    if (req.headers["accept"]?.includes("application/xml")) {
      const xmlResponse = convertToXML(response);
      res.set("Content-Type", "application/xml");
      res.send(xmlResponse);
    } else {
      res.json({ success: true, quote: response });
    }

  } catch (error) {
    console.error("Error processing /testRun request:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports.handler = serverless(app);