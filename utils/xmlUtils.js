const xml2js = require("xml2js");

function convertToXML(jsonObj) {
  const builder = new xml2js.Builder({ headless: true });
  return builder.buildObject({ root: jsonObj });
}

module.exports = { convertToXML };
