const { Engine } = require("json-rules-engine");
const path = require("path");
const fs = require("fs");

const RULES_DIR = path.join(__dirname, "../rules");

function loadRules(product) {
  const filePath = path.join(RULES_DIR, `${product}.json`);
  if (!fs.existsSync(filePath)) {
    console.error(`Rules file not found for product: ${product}`);
    throw new Error(`Rules for product "${product}" not found.`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function initializeEngine(rulesConfig) { 
  const engine = new Engine();
  operators(engine);
  rulesConfig.rules.forEach((rule) => {
    engine.addRule(rule);
  });

  return engine;
}
function operators(engine) {
  engine.addOperator("isEqualTo", (factValue, value) => factValue === value);
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
module.exports = { loadRules, initializeEngine };
