const express = require("express");
const router = express.Router();

function functionToString(func) {
  if (typeof func === "function") {
    return func.toString();
  }
  return null;
}

function functionToJSON(func) {
  const funcString = functionToString(func);
  if (funcString) {
    const cleanFunctionString = funcString
      .replace(/\"/g, "'")
      .replace(/\\(["'\\])/g, "$1")
      .replace(/[\r\n]+/g, " ");

    return {
      name: func.name,
      description: `This is the ${func.name} function.`,
      functionString: cleanFunctionString,
    };
  }
  return null;
}

router.post("/funcStr", (req, res) => {
  const functionJson = functionToJSON(ignite);

  if (functionJson) {
    res.set("Content-Type", "application/json");
    res.status(200).json(functionJson);
  } else {
    res.status(400).json({ error: "Invalid function" });
  }
});

module.exports = { router };

//##########################################################################
// Test function
function ignite(status, ruleEngineResponse, root) {
  try {
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
    const getEventByCategory = (category) => {
      return response.successEvents.find(
        (ev) => ev.params?.category === category
      );
    };

    const tableLookupEvent = {
      params: { lookupFunction: 'generateAnnualTripPremiumTable', getFromTable: true }
    };

    const lookupFn = tableLookupEvent.params.lookupFunction;
    const table = typeof global[lookupFn] === "function" ? global[lookupFn]() : [];
    const travelDetails = root?.risk?.travel_details || {};
    const status = root?.status;
    const promoCode = travelDetails?.promoCode;
    const whoCode = travelDetails?.whoCode;
    const cover = root?.risk?.travel_details?.cover;
    const policyFrom = new Date(root?.policyFrom);
    const policyTo = new Date(root?.policyTo);
    const durationInMilliseconds = policyTo - policyFrom;
    const durationInDays = Math.ceil(durationInMilliseconds / (1000 * 60 * 60 * 24));
    const children = travelDetails?.children;
    const adults = travelDetails?.adults;
    const crown = travelDetails?.crown;
    const notify_email = travelDetails?.notify_email;
    const mobile = root?.customer?.mobile;
    const email = root?.customer?.email;
    const intermediaryId = root?.intermediary;
    const custScreenFlag = root?.risk?.custScreenFlag;
    const productConfigId = root?.productConfigCollection?.productConfig?.$?.id;

    console.log("adults ", adults, " children ", children, crown, intermediaryId);
    const whoListItems = response.successEvents.find(ev => ev.type === 'whoList')?.params?.items;
    if (whoListItems?.length) {
      const whoList = {
        who: whoListItems.map(item => ({
          $: { code: item.code },
          _: item.label
        }))
      };

      root.risk.travel_options = {
        whoList
      };
    };

    const regionListItems = response.successEvents.find(ev => ev.type === 'regionList')?.params?.items;
    if (regionListItems?.length) {
      const regionList = {
        region: regionListItems.map(item => ({
          $: { code: item.code },
          _: item.label
        }))
      };

      root.risk.travel_options = {
        ...root.risk.travel_options,
        regionList
      };
    };

    const paymentOptionListItems = response.successEvents.find(ev => ev.type === 'paymentOptionList')?.params?.items;
    if (paymentOptionListItems?.length) {
      const paymentOptionList = {
        paymentOption : paymentOptionListItems.map(item => ({
          $: { code: item.code },
          _: item.label
        }))
      };
      root.risk.travel_options = {
        ...root.risk.travel_options,
        paymentOptionList
      };
    };

    const nationalityListItems = response.successEvents.find(ev => ev.type === 'nationalityList')?.params?.items;
    if (nationalityListItems?.length) {
      const nationalityList = {
        nationality : nationalityListItems.map(item => ({
          $: { code: item.code },
          _: item.country
        }))
      };
      root.risk.travel_options = {
        ...root.risk.travel_options,
        nationalityList
      };
    };

    const planListItems = response.successEvents.find(ev => ev.type === 'planList')?.params?.items;
    let formattedPlans = [];
    if (Array.isArray(planListItems) && planListItems.length > 0) {
      const plans = planListItems[0].plans?.plan;
      const planArray = Array.isArray(plans) ? plans : plans ? [plans] : [];

      if (planArray.length) {
        formattedPlans = planArray.map(plan => ({
          $: {
            mostPopular: plan._mostPopular || "",
            selected: plan._selected || ""
          },
          type: plan.type || "",
          premium: plan.premium || "",
          qar_premium: plan.qar_premium || "",
          benefits: {
            benefit: (Array.isArray(plan.benefits?.benefit) ? plan.benefits.benefit : []).map(b => {
              const benefitObj = {
                $: {
                  category: b._category,
                  id: b._id,
                  name: b._name
                }
              };

              if (!b.limit) {
                benefitObj.$.coverage = b._coverage || "";
                benefitObj.$.qar_coverage = b._qar_coverage || "";
              }
              if (b.limit) {
                const limits = Array.isArray(b.limit) ? b.limit : [b.limit];
                benefitObj.limit = limits.map(lim => ({
                  $: {
                    name: lim._name,
                    coverage: lim._coverage,
                    qar_coverage : lim._qar_coverage
                  }
                }));
              }

              return benefitObj;
            })
          }
        }));
      }
      console.log("formattedPlans", formattedPlans);
      root.risk.plans = {
        plan: formattedPlans
      };
    };

    
    const declineEmailEvent = getEventByCategory("decline_email");
    const ergoQuoteSeqEvent = getEventByCategory("ergoQuoteSeqLength");
    const quoteNoEvent = getEventByCategory("quoteNo");
    const policyNoEvent = getEventByCategory("policyNo");
    const ergoPolicySeqEvent = getEventByCategory("ergoPolicySeqLength");
    const invoiceNoEvent = getEventByCategory("invoiceNo");
    const ergoTaxNoSeqLengthEvent = getEventByCategory("ergoTaxNoSeqLength");
    const quoteNoPrefix = quoteNoEvent?.params?.quoteNo;
    const shortDate = root.timestampCreated?.slice(2, 4);
    
    if (root.quoteNo === "TBD") {
      if (root.ergoQuoteSeq !== undefined && root.ergoQuoteSeq !== null) {
        const fullQuoteNo = 
          quoteNoPrefix + 
          cover + 
          shortDate + 
          (ergoQuoteSeqEvent?.params?.value || "") + 
          root.ergoQuoteSeq;

        root.quoteNo = (root.status === 'IQ' ? quoteNoPrefix : fullQuoteNo);
      } else {
        root.quoteNo = quoteNoPrefix || "TBD";
      }
    };
    if (root.ergoPolicySeq !== undefined && root.ergoPolicySeq !== null) {
      const fullPolicyNo = 
        (policyNoEvent?.params?.value || "") +
        (ergoPolicySeqEvent?.params?.value || "") + 
        root.ergoPolicySeq;
      root.policyNo = (root.status === 'BQ' ? fullPolicyNo : "");
    };
    if (root.ergoTaxNoSeq !== undefined && root.ergoTaxNoSeq !== null) {
      const fullInvoiceNo = 
        (invoiceNoEvent?.params?.value || "") +
        (ergoTaxNoSeqLengthEvent?.params?.value || "") + 
        root.ergoTaxNoSeq;
      root.invoiceNo = (root.status === 'BQ' ? fullInvoiceNo : "");
    };
    root.risk.travel_details = {
      ...root.risk?.travel_details,
      decline_email: declineEmailEvent?.params?.value ||  root.risk.travel_details.decline_email,
      error_message:""
    };
    if(status=="BQ"){
      root.risk.premium = {
        ...root.risk?.premium,
        $: { 
          premiumclass: getEventByCategory("premiumClass")?.params?.value || "",
          riskclass: getEventByCategory("riskClass")?.params?.value || ""
        },
        charges1: {
          $: {
            type: getEventByCategory("chargesType")?.params?.value || ""
          },
          content: getEventByCategory("content")?.params?.value || ""
        }
      };
      root.risk.bind_status = {
        $: {
          ...root.risk.bind_status?.$,
          value: getEventByCategory("bindStatusValue")?.params?.value,
          reason: getEventByCategory("bindStatusReason")?.params?.value
        }
      };
      root.risk.custScreenFlag =  getEventByCategory("custScreenFlag")?.params?.value;
    }
    
    root.risk = {
      ...root?.risk,
      $: {
        ...root?.risk.$,
        version: "1.5"
      }
    };
    root.notify = {
      ...root?.notify,
    };
    if (status === "RQ" && crown === "false") {
      console.log("priya1");
      if((intermediaryId === "DIRECT") || (intermediaryId !== "DIRECT" && notify_email === true)){
        console.log("priya2");
          if((mobile === "" && email !== "") || mobile !== ""){
            console.log("priya3");
            const date = new Date();
            const dateOnly = date.toISOString().split("T")[0];
            console.log(dateOnly);

            const reminderMessage = 
              "Dear Customer,\n Thank you for visiting our website. We understand that you were in the process of buying Travel Protect online." +
              "\n In case you were not able to complete the transaction, please click QUOTE_EDIT_URL" +
              "\n to resume the transaction. \n For any queries please email us at customersupport@pfs.com.ae and we will assist you." +
              "\n Regards, \n Team PFS";

            root.notify.rq_reminder = {
              _: reminderMessage,
              $: {
                date: dateOnly,
                after_secs: "1800",
                repeat_freq: "N",
                repeat_duration: "0",
                email: email,
                subject: "Incomplete Transaction - " + root.quoteNo,
                mobile: mobile
              }
            };

          };
      };
    };
    if (status === "RQ") {
      const plans = Array.isArray(root?.risk?.plans?.plan)
        ? root.risk.plans.plan
        : [root.risk.plans.plan]; 
      plans.forEach(p => {
        const planName = p?.type;
        const selected = p?.$?.selected;
        console.log("planName$$ ", planName, selected);

        if (selected === "true") { 
          root.risk.travel_details = {
            ...root.risk?.travel_details,
            selected_plan: planName
          };
        }
      });
    };
    if (status !== "IQ" && (!promoCode || promoCode.trim() === "")) {
      const facts = {
        who: whoCode || "",
        region: travelDetails?.regionCode || "",
        duration: (durationInDays + 1) || 0,
      };

      const plans = root?.risk?.plans?.plan;
      const isArray = Array.isArray(plans);

      if (whoCode !== "M") {
        if (cover === "A" && isArray) {
          plans.forEach(p => {
            const planName = p?.type;
            const selected = p?.$?.selected || "";
            const match = table.find(row =>
              row.who === facts.who && row.region === facts.region && row.plan === planName
            );
            p.premium = match?.premium || 0;
            p.qar_premium = match?.qar_premium || 0;
          });
        }

        if (cover === "S" && isArray) {
          const items = response.successEvents.find(ev => ev.type === 'singleTripPremiums')?.params?.items || [];

          plans.forEach(p => {
            const planName = p?.type;
            const match = items.find(item =>
              String(item.days) === String(facts.duration) &&
              item.who === facts.who &&
              item.region === facts.region &&
              item.plan === planName
            );
            p.premium = match?.premium || 0;
            p.qar_premium = (match?.premium || 0) * 3.65;
          });
        }
      } else {
        if (cover === "A" && isArray) {
          plans.forEach(p => {
            const planName = p?.type;
            const match = table.find(row =>
              row.who === facts.who && row.region === facts.region && row.plan === planName
            );
            const adultsChildren = adults + children;
            p.premium = (match?.premium || 0) * adultsChildren;
            p.qar_premium = (match?.qar_premium || 0) * adultsChildren;
          });
        }

        if (cover === "S" && isArray) {
          const items = response.successEvents.find(ev => ev.type === 'singleTripPremiums')?.params?.items || [];

          plans.forEach(p => {
            const planName = p?.type;
            const match = items.find(item =>
              String(item.days) === String(facts.duration) &&
              item.who === facts.who &&
              item.region === facts.region &&
              item.plan === planName
            );
            const total = Number(adults) + Number(children);
            const premium = (match?.premium || 0) * total;
            p.premium = premium;
            p.qar_premium = premium * 3.65;
          });
        }
      }
    };
    if (status === "BQ" && (!promoCode || promoCode.trim() === "")) {
      const facts = {
        who: whoCode || "",
        region: travelDetails?.regionCode || "",
        duration: durationInDays + 1 || 0,
      };

      const plan = root?.risk?.plans?.plan;
      const isArray = Array.isArray(plan);

      if (whoCode !== "M") {
        if (cover === "A" && !isArray) {
          const planName = plan?.type;
          const selected = plan?.$?.selected || "";

          if (selected) {
            const match = table.find(row =>
              row.who === facts.who && row.region === facts.region && row.plan === planName
            );

            const premium = match?.premium || 0;
            root.risk.premium = {
              ...root.risk.premium,
              annual_premium: premium,
              payable_premium: premium,
            };
          }
        }

        if (cover === "S" && !isArray) {
          const items = response.successEvents.find(ev => ev.type === "singleTripPremiums")?.params?.items || [];
          const planName = plan?.type;
          const selected = plan?.$?.selected || "";

          if (selected) {
            const match = items.find(item =>
              String(item.days) === String(facts.duration) &&
              item.who === facts.who &&
              item.region === facts.region &&
              item.plan === planName
            );

            const premium = match?.premium || 0;
            root.risk.premium = {
              ...root.risk.premium,
              annual_premium: premium,
              payable_premium: premium,
            };
          }
        }
      } else {
        if (cover === "A" && !isArray) {
          const planName = plan?.type;
          const selected = plan?.$?.selected || "";

          if (selected) {
            const match = table.find(row =>
              row.who === facts.who && row.region === facts.region && row.plan === planName
            );

            let premium = (match?.premium || 0) * (adults + children);
            root.risk.premium = {
              ...root.risk.premium,
              annual_premium: premium,
              payable_premium: premium,
            };
          }
        }

        if (cover === "S" && !isArray) {
          const items = response.successEvents.find(ev => ev.type === "singleTripPremiums")?.params?.items || [];
          const planName = plan?.type;
          const selected = plan?.$?.selected || "";

          if (selected) {
            const match = items.find(item =>
              String(item.days) === String(facts.duration) &&
              item.who === facts.who &&
              item.region === facts.region &&
              item.plan === planName
            );

            let premium = (match?.premium || 0) * (Number(adults) + Number(children));
            root.risk.premium = {
              ...root.risk.premium,
              annual_premium: premium,
              payable_premium: premium,
            };
          }
        }
      }
    };
    if (status === "BQ"){
      if(custScreenFlag === "HOLD" || custScreenFlag === "STOP"){
        if(productConfigId === "ERGO_TPS_DECLINE_EMAIL_ADDRESS"){
          root.notify.email = {
            ...root.notify?.email,
            $: {
              to: "ERGO_TPS_DECLINE_EMAIL_ADDRESS",
              template: "decline_email",
              onbind: "decline",
              subject: "Customer Decline Notification"
            }
          };
        }
      }else if (custScreenFlag === "GO"){
        root.notify.email = {
          ...root.notify?.email,
          $: {
            to: email,
            template: "email",
          }
        };
        const attachFileItems = response.successEvents.find(ev => ev.type === 'attachFileList')?.params?.items || [];
        const attachTemplateItems = response.successEvents.find(ev => ev.type === 'attachTemplateList')?.params?.items || [];

        if (attachFileItems.length && attachTemplateItems.length) {
          const mergedAttachList = attachFileItems.map((fileItem, index) => {
            const templateItem = attachTemplateItems[index];
            return {
              $: {
                file: fileItem.label || "",
                template: templateItem?.label || ""
              }
            };
          });

          root.notify.email = {
            attach: mergedAttachList
          };
        }
      }else{
        root.notify.email = {
          ...root.notify?.email,
          $: {
            template: "ignore"
          }
        };
      }
    }
    const finalResponse = root;
    return finalResponse;
  } catch (error) {
    return { error: true, function: "ignite", message: error.message };
  }
}

function generateAnnualTripPremiumTable() {
  const rawTable = [
    { who: 'I', region: '1', plan: 'Basic', premium: 'NA' },
    { who: 'I', region: '1', plan: 'Essential', premium: 138 },
    { who: 'I', region: '1', plan: 'Standard', premium: 204 },
    { who: 'I', region: '1', plan: 'Deluxe', premium: 239 },
    { who: 'I', region: '2', plan: 'Basic', premium: 'NA' },
    { who: 'I', region: '2', plan: 'Essential', premium: 180 },
    { who: 'I', region: '2', plan: 'Standard', premium: 224 },
    { who: 'I', region: '2', plan: 'Deluxe', premium: 281 },
    { who: 'I', region: '3', plan: 'Basic', premium: 'NA' },
    { who: 'I', region: '3', plan: 'Essential', premium: 283 },
    { who: 'I', region: '3', plan: 'Standard', premium: 344 },
    { who: 'I', region: '3', plan: 'Deluxe', premium: 398 },
    { who: 'F', region: '1', plan: 'Basic', premium: 'NA' },
    { who: 'F', region: '1', plan: 'Essential', premium: 290 },
    { who: 'F', region: '1', plan: 'Standard', premium: 428 },
    { who: 'F', region: '1', plan: 'Deluxe', premium: 501 },
    { who: 'F', region: '2', plan: 'Basic', premium: 'NA' },
    { who: 'F', region: '2', plan: 'Essential', premium: 378 },
    { who: 'F', region: '2', plan: 'Standard', premium: 470 },
    { who: 'F', region: '2', plan: 'Deluxe', premium: 591 },
    { who: 'F', region: '3', plan: 'Basic', premium: 'NA' },
    { who: 'F', region: '3', plan: 'Essential', premium: 594 },
    { who: 'F', region: '3', plan: 'Standard', premium: 722 },
    { who: 'F', region: '3', plan: 'Deluxe', premium: 835 },
    { who: 'M', region: '1', plan: 'Basic', premium: 'NA' },
    { who: 'M', region: '1', plan: 'Essential', premium: 138 },
    { who: 'M', region: '1', plan: 'Standard', premium: 204 },
    { who: 'M', region: '1', plan: 'Deluxe', premium: 239 },
    { who: 'M', region: '2', plan: 'Basic', premium: 'NA' },
    { who: 'M', region: '2', plan: 'Essential', premium: 180 },
    { who: 'M', region: '2', plan: 'Standard', premium: 224 },
    { who: 'M', region: '2', plan: 'Deluxe', premium: 281 },
    { who: 'M', region: '3', plan: 'Basic', premium: 'NA' },
    { who: 'M', region: '3', plan: 'Essential', premium: 283 },
    { who: 'M', region: '3', plan: 'Standard', premium: 344 },
    { who: 'M', region: '3', plan: 'Deluxe', premium: 398 }
  ];

  return rawTable.map(row => ({
    ...row,
    qar_premium: row.premium === 'NA' ? 'NA' : +(row.premium * 3.65).toFixed(2)
  }));
}

function createQICFactsFromRoot(root) {
  try {
    const facts = {
      ergoQuoteSeq: root?.ergoQuoteSeq || "",
      ergoQuoteSeqLength: root?.ergoQuoteSeq?.length || 0,
      ergoPolicySeq: root?.ergoPolicySeq || "",
      ergoPolicySeqLength: root?.ergoPolicySeq?.length || 0,
      ergoTaxNoSeq: root?.ergoTaxNoSeq || "",
      ergoTaxNoSeqLength: root?.ergoTaxNoSeq?.length || 0,
      product: root?.product || "",
      quoteNo: root?.quoteNo || "",
      id: root?.id || "",
      status: root?.status || "",
      versionNo: root?.versionNo || "",
      policyFrom: root?.policyFrom || "",
      policyTo: root?.policyTo || "",
      intermediaryId: root?.intermediary || "",
      accessToken: root?.accessToken || "",
      timestampCreated: root?.timestampCreated || "",
      timestampUpdated: root?.timestampUpdated || "",
      userUpdated: root?.userUpdated || "",
      whoCode: root?.risk?.travel_details?.whoCode || "",
      cover: root?.risk?.travel_details?.cover || "",
      custScreenFlag: root?.risk?.custScreenFlag || "",
      bypass: root?.risk?.bind_status?.$?.bypass || ""
    };

    console.log("ergoQuoteSeqLength", facts.ergoQuoteSeqLength);
    return facts;
  } catch (error) {
    return {
      error: true,
      function: "createQICFactsFromRoot",
      message: error.message
    };
  }
}

// function createQICFactsFromRoot(root) {
//   try {
//     function flattenObject(obj, prefix = '', result = {}) {
//       for (const key in obj) {
//         if (Object.hasOwnProperty.call(obj, key)) {
//           const value = obj[key];
//           const fullKey = prefix ? `${prefix}_${key}` : key;

//           if (value && typeof value === 'object' && !Array.isArray(value)) {
//             flattenObject(value, fullKey, result);
//           } else {
//             result[fullKey] = value || "";
//             if (typeof value === 'string') {
//               result[`${fullKey}Length`] = value.length;
//             }
//           }
//         }
//       }
//       return result;
//     }

//     const facts = flattenObject(root);

//     console.log("Flattened Facts:", facts);
//     return facts;
//   } catch (error) {
//     return {
//       error: true,
//       function: "createQICFactsFromRoot",
//       message: error.message
//     };
//   }
// }
