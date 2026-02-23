const express = require("express");
const router = express.Router();

router.post("/PAInit", (req, res) => {
  const xmlResponse = `
    
<quote>
    <product>PA</product>
    <productCheck>PA</productCheck>
    <status>IQ</status>
    <id>12345</id>
    <versionNo>1.0</versionNo>
    <policyFrom>2025-01-01</policyFrom>
    <policyTo>2025-12-31</policyTo>
    <intermediaryId>98765</intermediaryId>
    <accessToken>abcd1234xyz</accessToken>
    <timestampCreated>2025-01-03T05:30:31.268Z</timestampCreated>
    <timestampUpdated>2025-01-03T05:30:31.268Z</timestampUpdated>
    <charges1>1000</charges1>
    <charges2>2000</charges2>
    <charges3>3000</charges3>
    <userCreated>admin</userCreated>
    <userUpdated>admin</userUpdated>
    <productJSON>
        <risk_locations>
            <risk_details>
                <age>45</age>
            </risk_details>
        </risk_locations>
    </productJSON>
</quote>`;

  res.set("Content-Type", "application/xml");
  res.status(200).send(xmlResponse);
});

module.exports = {
  router,
};
