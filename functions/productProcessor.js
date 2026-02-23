const { loadRules, initializeEngine } = require("../utils/rulesUtils");
const { Engine } = require("json-rules-engine");
const xml2js = require("xml2js");
const {
  addNumbers,
  subtractNumbers,
  multiplyNumbers,
  divideNumbers,
} = require("./FuncList");
const axios = require("axios");
const fs = require("fs").promises;

// async function fetchRulesConfig() {
//   try {
//     const response = await axios.get(
//       "http://10.8.2.1:8080/jsrules_config.json"
//     );
//     return response.data.rulesLocation;
//   } catch (error) {
//     console.error("Error fetching rules config:", error);
//     throw error;
//   }
// }

// async function fetchRulestable(tblname, fltrobj) {
//   try {
//     const payload = {
//       table: tblname,
//       filter: fltrobj,
//     };

//     const response = await axios.post(
//       "http://10.8.2.1:8080/rules-js-services/internal/queryDB",
//       payload
//     );

//     // console.log("API Response:", response.data);
//     return response.data;
//   } catch (error) {
//     // console.error("Error fetching rules table:", error);
//     throw error;
//   }
// }

async function loadProductConfig(product) {
  try {
    const data = await fs.readFile(`./rules/${product}.json`, "utf8");
    const jsonData = JSON.parse(data);
    return jsonData;
  } catch (err) {
    console.error(`Error reading or processing ${product}.json:`, err);
    throw err;
  }
}

async function createFunctions(functions) {
  for (const [name, funcCode] of Object.entries(functions)) {
    try {
      eval(`global.${name} = ${funcCode}`);
      console.log(`Function ${name} created dynamically.`);
    } catch (err) {
      console.error(`Error creating function ${name}:`, err);
      throw err;
    }
  }
}
async function operators(engine) {
  // engine.addOperator("isEqualTo", (factValue, value) => factValue === value);
  engine.addOperator("isEqualTo", (factValue, value) => {
    if (Array.isArray(value)) {
      return value.includes(factValue);
    }
    return factValue === value;
  });
  engine.addOperator("isNotEqualTo", (factValue, value) => factValue !== value);
  engine.addOperator("isGreaterThan", (factValue, value) => factValue > value);
  engine.addOperator(
    "isGreaterOrEqual",
    (factValue, value) => factValue >= value
  );
  engine.addOperator("isLessThan", (factValue, value) => factValue < value);
  engine.addOperator("isLessOrEqual", (factValue, value) => factValue <= value);
  engine.addOperator("isBetween", (factValue, range) => {
    if (!Array.isArray(range) || range.length !== 2) return false;
    const [min, max] = range;
    return factValue >= min && factValue <= max;
  });
}
async function processEvaluation(product, status, quote, rules, xml) {
  try {
    console.log("step 1", quote);
    // const ruleLocation = await fetchRulesConfig();
    // if (!ruleLocation) {
    //   console.error("No rule location fetched, unable to proceed.");
    //   return { success: false, message: "No rule location found" };
    // }
    // console.log("ruleLocation:", ruleLocation);

    const jsonData = rules;
    if (!jsonData || !jsonData.functions) {
      console.error("No product config or functions found.");
      return { success: false, message: "Invalid product config" };
    }

    const functions = jsonData.functions;
    await createFunctions(functions);

    const responseFunctionName = "ignite";

    if (typeof global[responseFunctionName] !== "function") {
      console.error(`${responseFunctionName} function is not available.`);
      return { success: false, message: `${responseFunctionName} not found` };
    }

    let facts = global[`create${product}FactsFromRoot`](quote);
    if (!facts) {
      console.error("Unable to create facts from quote.");
      return { success: false, message: "Failed to create facts" };
    }
    console.log("Facts:", facts);

    let formattedXml;
    if (xml) {
      const parsedXml = await parseXML(xml);
      formattedXml = new xml2js.Builder().buildObject(parsedXml);
      // console.log("Formatted XML:", formattedXml);
    }

    const originalRules = jsonData.rules || (await loadRules(product)).rules;
    if (!originalRules) {
      console.error("Rules config not found or invalid for product:", product);
      return { success: false, message: "Rules config not found" };
    }

    // ✅ Patch rules to use wildcard fact with fallback
    const patchedRules = originalRules.map((rule) => {
      const patchCondition = (condition) => {
        return {
          ...condition,
          params: { factParam: condition.fact },
          fact: "*",
        };
      };

      const patchConditionsGroup = (group) => {
        if (!group) return group;
        if (group.all) {
          return { all: group.all.map(patchCondition) };
        } else if (group.any) {
          return { any: group.any.map(patchCondition) };
        }
        return group;
      };

      return {
        ...rule,
        conditions: patchConditionsGroup(rule.conditions),
      };
    });

    // ✅ Initialize engine with patched rules
    const { Engine } = require("json-rules-engine");
    const engine = new Engine(patchedRules);
    await operators(engine);
    // ✅ Add wildcard fact to resolve any undefined facts gracefully
    engine.addFact("*", async (params, almanac) => {
      const factName = params.factParam;
      const value = facts[factName];
      if (value === undefined) {
        console.warn(`⚠️ Fact "${factName}" is not defined in facts.`);
        return null; // or return a default like "" or 0 if needed
      }
      return value;
    });

    const ruleEngineResponse = await engine.run(facts);
    if (!ruleEngineResponse) {
      console.error("No response from the rule engine.");
      return { success: false, message: "Rule engine returned no response" };
    }

    const response = global[responseFunctionName](
      status,
      ruleEngineResponse,
      quote
    );
    // console.log("response>>>>>>#####",response)
    const builder = new xml2js.Builder({ rootName: 'quote' });
    const xmlResponse = builder.buildObject(response); 
    // console.log("xmlResponse>>>>>>#####",xmlResponse)
    return response;
  } catch (error) {
    console.error("Error in processEvaluation:", error);
    return { success: false, message: error.message || "Unknown error" };
  }
}
 

async function processProductRequest(product, status, quote) {
  try {
    // const ruleLocation = await fetchRulesConfig();
    // if (!ruleLocation) {
    //   console.error("❌ No rule location fetched, unable to proceed.");
    //   return;
    // }

    const jsonData = await loadProductConfig(product);
    await createFunctions(jsonData.functions);

    const responseFunctionName = "ignite";
    if (typeof global[responseFunctionName] !== "function") {
      console.error(`❌ Missing global function: ${responseFunctionName}`);
      console.log("Available global functions:", Object.keys(global));
      return;
    }

    const createFactsFunc = global[`create${product}FactsFromRoot`];
    if (typeof createFactsFunc !== "function") {
      console.error(`❌ Function create${product}FactsFromRoot is not defined.`);
      return;
    }

    const facts = createFactsFunc(quote);
    // console.log("✅ Facts:", facts);

    const rulesConfig = jsonData.rules || (await loadRules(product)).rules;
    // console.log("rulesConfig>>>",rulesConfig)
    if (!Array.isArray(rulesConfig)) {
      console.error("❌ Invalid rulesConfig: Expected an array but got", typeof rulesConfig);
      return;
    }
    const engine = new Engine(rulesConfig, { allowUndefinedFacts: true }); // ⬅️ key fix

    await operators(engine); // assuming this adds custom operators

    // Wildcard fact handler to catch all dynamic facts
    engine.addFact("*", async (params) => {
      const factName = params.factParam;
      const value = facts[factName];
      if (value === undefined) {
        console.warn(`⚠️ Fact "${factName}" is not defined in facts.`);
        return null; // or provide default like "" or 0 if needed
      }
      return value;
    });

    const ruleEngineResponse = await engine.run(facts);

    // Optional: log results
    if (!ruleEngineResponse || ruleEngineResponse.events.length === 0) {
      console.warn("⚠️ No rules triggered.");
    } else {
      console.log("✅ Rule Engine Events:", ruleEngineResponse.events);
    }

    return global[responseFunctionName](status, ruleEngineResponse, quote);
  } catch (error) {
    console.error("❌ Error in processProductRequest:", error);
    throw error; // optional: allow caller to handle
  }
}



module.exports = { processProductRequest, processEvaluation };
