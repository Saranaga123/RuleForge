const express = require("express");
const xml2js = require("xml2js");
const cors = require("cors");
const { convertToXML } = require("./utils/xmlUtils");
const { processEvaluation, processProductRequest } = require("./functions/productProcessor");

// Routers
const { router: testfunc } = require("./rules/FuncStr");
const { router: smeRoutes } = require("./functions/SME");
const { router: funcRoutes } = require("./functions/FuncList");
const { router: paRoutes } = require("./functions/PA");

const app = express();

// Middleware
app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ extended: true, limit: "500mb" }));
app.use(express.text({ type: "application/xml" }));

app.use(cors({
  origin: "*", // adjust to your frontend
  methods: "GET,POST,OPTIONS",
  allowedHeaders: "Content-Type",
}));

// Routes
app.use("/", testfunc);
app.use("/", smeRoutes);
app.use("/", funcRoutes);
app.use("/", paRoutes);

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

// POST /testRun
app.post("/testRun", async (req, res) => {
  try {
    const { rules, xml } = req.body;

    if (!xml) return res.status(400).json({ error: "No XML provided" });

    const parsedXml = await parseXML(xml);
    const quote = parsedXml.quote;
    const productFromPayload = quote.product;
    const status = quote.status;
    const productFromQuery = req.query.product;
    const product = productFromQuery || productFromPayload;

    if (productFromQuery && productFromPayload && productFromQuery !== productFromPayload) {
      return res.status(400).json({
        success: false,
        message: `Mismatch between query product ('${productFromQuery}') and payload product ('${productFromPayload}')`,
      });
    }

    const response = await processEvaluation(product, status, quote, rules);

    if (req.headers["accept"]?.includes("application/xml")) {
      res.set("Content-Type", "application/xml");
      res.send(convertToXML(response));
    } else {
      res.json({ success: true, quote: response });
    }

  } catch (error) {
    console.error("Error in /testRun:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /evaluate
app.post("/evaluate", async (req, res) => {
  try {
    const xmlPayload = req.body;
    if (!xmlPayload) return res.status(400).json({ error: "No XML provided" });

    const parsedPayload = await parseXML(xmlPayload);
    const root = parsedPayload.quote;
    const { product: productFromPayload, status } = root;
    const productFromQuery = req.query.product;
    const product = productFromQuery || productFromPayload;

    if (!product) return res.status(400).json({ error: "Missing Product" });

    if (productFromQuery && productFromPayload && productFromQuery !== productFromPayload) {
      return res.status(400).json({
        success: false,
        message: `Mismatch between query product ('${productFromQuery}') and payload product ('${productFromPayload}')`,
      });
    }

    const response = await processProductRequest(product, status, root);

    if (req.headers["accept"]?.includes("application/xml")) {
      res.set("Content-Type", "application/xml");
      res.send(convertToXML(response));
    } else {
      res.json({ success: true, root: response });
    }

  } catch (error) {
    console.error("Error in /evaluate:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Start server locally
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Local server running at http://localhost:${PORT}`);
});