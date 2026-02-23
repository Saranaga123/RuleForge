const express = require("express");
const app = express();
app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ extended: true, limit: "500mb" }));
const { loadRules, initializeEngine } = require("./utils/rulesUtils");
const {
  processProductRequest,
  processEvaluation,
} = require("./functions/productProcessor");

const cluster = require("cluster");
const os = require("os");
const xml2js = require("xml2js");
const { convertToXML } = require("./utils/xmlUtils");

app.use(express.text({ type: "application/xml" }));
const { router: testfunc } = require("./rules/FuncStr");
const { router: smeRoutes } = require("./functions/SME");

const { router: funcRoutes } = require("./functions/FuncList");
const { router: paRoutes } = require("./functions/PA");
app.use("/", testfunc);
app.use("/", smeRoutes);

app.use("/", funcRoutes);
app.use("/", paRoutes);
app.use(express.json());
app.use(express.text({ type: "application/xml" }));
const cors = require("cors");
app.use(
  cors({
    origin: "http://localhost:4200",
    methods: "GET,POST,OPTIONS",
    allowedHeaders: "Content-Type",
  })
);
app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:4200");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.sendStatus(200);
});
app.use((req, res, next) => {
  console.log(
    `Worker ${process.pid} is handling the request: ${req.method} ${req.url}`
  );
  next();
});

async function parseXML(xmlPayload) {
  try {
    return await xml2js.parseStringPromise(xmlPayload, {
      explicitArray: false,
    });
  } catch (error) {
    throw new Error(`Error parsing XML: ${error.message}`);
  }
}
app.post("/testRun", async (req, res) => {
  try {
    const { rules, xml } = req.body;

    if (rules) {
      const rulesVariable = rules;
      // console.log("Received JSON:", JSON.stringify(rulesVariable, null, 2));
    } else {
      // console.log("No JSON provided in the request");
    }

    if (xml) {
      const parsedXml = await xml2js.parseStringPromise(xml, {
        explicitArray: false,
      });
      const builder = new xml2js.Builder();
      const formattedXml = builder.buildObject(parsedXml);
      // console.log("Formatted XML:", formattedXml);

      const quote = parsedXml.quote;

      // console.log("quote>>>:", quote);
      const productFromPayload = quote.product;
      const status = quote.status;
      // console.log("product>>>:", productFromPayload);

      const productFromQuery = req.query.product;

      if (
        productFromQuery &&
        productFromPayload &&
        productFromQuery !== productFromPayload
      ) {
        return res.status(400).json({
          success: false,
          message: `Mismatch between query string product ('${productFromQuery}') and payload product ('${productFromPayload}')`,
        });
      }

      const product = productFromQuery || productFromPayload;

      const response = await processEvaluation(product, status, quote, rules);

      if (req.headers["accept"]?.includes("application/xml")) {
        
        const xmlResponse = convertToXML(response);
        console.log("step 1");
        // console.log("xmlResponse>>>>",xmlResponse)
        res.set("Content-Type", "application/xml");
        res.send(response);
      } else {
        // console.log("!xmlResponse>>>>",response)
          console.log("step 2",);
        res.json({ success: true, quote: response });
      }
    } else {
      res.status(400).json({ error: "No XML provided in the request" });
    }
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/evaluate", async (req, res) => {
  const xmlPayload = req.body;

  try {
    const productFromQuery = req.query.product;

    const parsedPayload = await parseXML(xmlPayload);

    const root = parsedPayload.quote;
    const { product: productFromPayload, status } = root;

    if (
      productFromQuery &&
      productFromPayload &&
      productFromQuery !== productFromPayload
    ) {
      return res.status(400).json({
        success: false,
        message: `Mismatch between query string product ('${productFromQuery}') and payload product ('${productFromPayload}')`,
      });
    }

    const product = productFromQuery || productFromPayload;

    if (!product) {
      return res.status(400).json({
        success: false,
        message: "Missing Product field in payload or query string",
      });
    }

    const response = await processProductRequest(product, status, root);

    if (req.headers["accept"]?.includes("application/xml")) {
      const xmlResponse = convertToXML(response);
      res.set("Content-Type", "application/xml");
      res.send(response);
    } else {
      res.json({ success: true, root: response });
    }
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

if (cluster.isMaster) {
  const numCPUs = os.cpus().length;
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  cluster.on("exit", (worker) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork();
  });
} else {
  const PORT = 3000;
  const HOST = process.env.HOST || "localhost";
  const PROTOCOL = process.env.PROTOCOL || "http";

  app.listen(PORT, () => {
    console.log(
      `Worker ${process.pid} running on ${PROTOCOL}://${HOST}:${PORT}`
    );
  });
}
