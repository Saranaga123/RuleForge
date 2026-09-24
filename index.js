const express = require("express");
const xml2js = require("xml2js");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const cluster = require("cluster");
const os = require("os");
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

// CORS_ORIGIN (comma-separated) restricts which origins may call the API.
// Left unset, any origin is allowed -- the previous behaviour, which the
// hosted RuleForge Lab frontend relies on.
const corsOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Desktop mode serves the frontend and API from the same origin, on a
    // port picked dynamically at launch -- it can never be in a hardcoded
    // allowlist, and Chromium still sends an Origin header on same-origin
    // POSTs. It's a single local user talking to its own embedded backend.
    if (process.env.DESKTOP_MODE || !origin || corsOrigins.length === 0 || corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  methods: "GET,POST,OPTIONS",
  allowedHeaders: "Content-Type",
}));

// Serves the RuleForge Lab Angular production build same-origin as the API
// (used by the desktop-packaged app) when a build is present.
// FRONTEND_DIST_PATH lets a packaged build point this at wherever the
// frontend dist actually ships; it defaults to the sibling Lab project's dist.
const FRONTEND_DIST =
  process.env.FRONTEND_DIST_PATH ||
  path.join(__dirname, "..", "RuleForge-Lab", "dist", "ruleforge");
if (fs.existsSync(path.join(FRONTEND_DIST, "index.html"))) {
  app.use(express.static(FRONTEND_DIST));
}

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
    res.status(500).json({ error: "Internal Server Error", message: error.message });
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
    res.status(500).json({ error: "Internal Server Error", message: error.message });
  }
});

function startSingleInstance() {
  // Without these, an unhandled rejection or uncaught exception anywhere
  // (including in eval'd rule-JSON functions) kills this process with no
  // logged reason. Log the real error before exiting (in cluster mode the
  // primary respawns the worker; in desktop mode this makes a crash
  // diagnosable in the app logs).
  process.on("uncaughtException", (err) => {
    console.error(`Worker ${process.pid} uncaughtException:`, err);
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    console.error(`Worker ${process.pid} unhandledRejection:`, reason);
    process.exit(1);
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Worker ${process.pid} running at http://localhost:${PORT}`);
  });
}

if (process.env.DESKTOP_MODE) {
  // A desktop app serves exactly one local user -- cluster's multi-core
  // fan-out is unneeded there, so run a single Express instance directly.
  startSingleInstance();
} else if (cluster.isMaster) {
  const numCPUs = os.cpus().length;
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  cluster.on("exit", (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died (code=${code}, signal=${signal})`);
    cluster.fork();
  });
} else {
  startSingleInstance();
}
