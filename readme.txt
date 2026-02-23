✔️ Multiple Products with Different Rules: 
    Each product (e.g., PA, SME) has separate rule sets in JSON files.

✔️ Dynamic Rule Selection:
    The Product parameter in the payload determines which rule set to use.

✔️ XML Payload Input:
    The API should accept XML payloads and convert them to JSON.

✔️ Fact Extraction:
    Extract or flatten relevant facts (like age, plan) from the JSON for rule evaluation.

✔️ Rules Engine:
    Use json-rules-engine to evaluate the rules and trigger matching events.

✔️ Custom Functions:
    Support product-specific functions defined in the rule set JSON.

✔️ API Response:
    Return:
        Product name.
        Input payload (facts).
        Triggered events (type and parameters).
    Handle errors (e.g., missing product, invalid payload, undefined facts).
 

✔️ Extensibility:
If you create a new product like "Health Insurance," you can simply add a new JSON file (e.g., HL.json) with its rules and functions.

✔️ Integrating with Cluster Module for parallel processing.

✔️ Integrating with sql2 Module for DB connection.

✔️ Develop a Dev tool for JS to String.

⏳ Matrix dev test sand box.

✔️ Rules Tables connection using APIs