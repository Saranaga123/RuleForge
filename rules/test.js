function ignite(status, ruleEngineResponse, root) {
  try {
    const table1Response = fetchtablefilter1();
    const table2Response = fetchtablefilter2();
    if (table1Response?.error) return table1Response;
    if (table2Response?.error) return table2Response;
    console.log("Root received inside ignite:", JSON.stringify(root, null, 2));
    const response = { successEvents: [], failureEvents: [] };
    if (ruleEngineResponse.results?.length > 0) {
      ruleEngineResponse.results.forEach((rule) => {
        if (rule.result === true) {
          response.successEvents.push({
            type: rule.event.type,
            params: rule.event.params,
          });
        }
      });
    }
    if (ruleEngineResponse.failureEvents?.length > 0) {
      ruleEngineResponse.failureEvents.forEach((failureEvent) => {
        response.failureEvents.push({
          type: failureEvent.type,
          params: failureEvent.params,
        });
      });
    }
    console.log("rules engine response>>>>>>>", response);
    const getEventByCategory = (category) => {
      return response.successEvents.find(
        (ev) => ev.params?.category === category
      );
    };
    const tableLookupEvent = response.successEvents.find(
      (ev) => ev.params?.lookupFunction && ev.params?.getFromTable
    );
    let matchedPremium = 0;
    if (tableLookupEvent) {
      const lookupFn = tableLookupEvent.params.lookupFunction;
      const table =
        typeof global[lookupFn] === "function" ? global[lookupFn]() : [];
      const facts = {
        who: root?.risk?.who || "",
        region: root?.risk?.region || "",
        plan: root?.risk?.plan || "",
      };
      const match = table.find(
        (row) =>
          row.who === facts.who &&
          row.region === facts.region &&
          row.plan === facts.plan
      );
      matchedPremium = match?.premium || 0;
    }
    const whoCodeEvent = getEventByCategory("whoCode");
    const ergoQuoteSeqEvent = getEventByCategory("ergoQuoteSeqLength");
    const quoteNoEvent = getEventByCategory("quoteNo");
    const quoteNoPrefix = quoteNoEvent?.params?.quoteNo || "SQTP";
    const shortDate = root.timestampCreated?.slice(2, 4);
    const cover = root.risk?.travel_details?.cover;
    const fullQuoteNo =
      quoteNoPrefix +
      cover +
      shortDate +
      ergoQuoteSeqEvent?.params?.value +
      root.ergoQuoteSeq;
    console.log(
      "whoCodeEvent",
      whoCodeEvent,
      "\\n",
      ergoQuoteSeqEvent,
      "\\n",
      cover
    );
    const riskDetail = {
      whoCode: root.risk?.travel_details?.whoCode || "",
      cover: root.risk?.travel_details?.cover || "",
      risk: whoCodeEvent?.type || "N/A",
      premiumAmount: matchedPremium,
    };
    root.quoteNo = fullQuoteNo;
    root.risk.travel_details = riskDetail;
    const finalResponse = root;
     
    return finalResponse;
  } catch (error) {
    return { error: true, function: "ignite", message: error.message };
  }
}
