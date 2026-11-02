// Additional decision calculators. All monetary arithmetic is deterministic;
// these scenarios are not forecasts and do not assign probabilities.
const money = value => Math.round(value * 100) / 100;
const count = value => Math.ceil(value - 1e-9);
const num = (value, field) => {
  if (value === '' || value == null) throw new Error(`Please enter a value for ${field}.`);
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0) throw new Error(`${field} must be a finite non-negative number.`);
  return result;
};
const ensure = (input, fields) => fields.forEach(field => num(input[field], field));
const positive = (value, field) => {
  if (value <= 0) throw new Error(`${field} must be greater than zero.`);
};
const card = (label, value, format = 'money', warning = false) => ({ label, value: value == null ? null : money(value), format, warning });
const metric = (label, value, format = 'money', warning = false) => ({ label, value: value == null ? null : money(value), format, warning });
const risk = (severity, title, reason, test, basis = 'Calculated from entered assumptions') => ({ severity, title, reason, test, basis });
const gate = (status, title, reason) => ({ status, title, reason });

// A review flag means an input needs evidence, not that the cost is definitely missing.
function auditDecisionAssumptions(mode, input) {
  const flags=[];
  const add=(severity,title,reason,test)=>flags.push({severity,title,reason,test});
  const v=(field)=>Number(input[field]||0);
  if(mode==='hire') {
    if(input.projectRevenue==null || input.projectRevenue==='') add('high','Project revenue is missing','Cost comparisons alone cannot show whether accepting the project is profitable.','Enter the actual client quote and compare both options on full-period cash cost.');
    if(v('projectHoursNeeded') < v('productiveHoursPerMonth')*v('periodMonths')) add('medium','Unfilled employee hours need a plan','Allocated hourly cost assumes remaining employee capacity has other productive uses.','List confirmed work that uses the remaining paid hours; otherwise use the full cash commitment.');
  }
  if(mode==='inventory') {
    if(v('salvageValuePerUnsoldUnit')>Math.min(v('bulkUnitCost'),v('smallUnitCost'))) add('high','Recoverable unsold value exceeds purchase cost','The model can show profit even with no customer sales when recoverable value exceeds the purchase cost of an option. This is mathematically consistent but needs evidence.','Provide a written buyback or liquidation offer, including fees, or enter a conservative recoverable value.');
    add('medium','Expected demand is not verified by this calculator','Expected sales are a user estimate, not confirmed orders.','Validate with pre-orders, historical sell-through, or a small pilot.');
    if(v('salvageValuePerUnsoldUnit')>0) add('medium','Unsold inventory recovery is not confirmed','Modeled profit includes liquidation proceeds for every unsold unit in the period. A recoverable value is not cash unless the stock can actually be sold or returned at that price.','Get written buyback or liquidation terms including timing and fees; rerun with zero recovery as a downside.');
  }
  if(mode==='discount') add('medium','Sales uplift is an unverified hypothesis','The calculator cannot establish that a lower price will increase demand.','Run a small controlled price experiment or use comparable past promotions.');
  if(mode==='ads') {
    add('medium','Attributable orders are an assumption','Entered orders and conversion are not measured by the calculator.','Track incremental paid orders, actual lead-to-customer conversion, and refunds.');
    if(v('expectedOrdersFromAds')>0 && v('leadToCustomerConversionPct')===0) add('high','Expected orders conflict with zero lead conversion','The scenario expects orders while the entered lead conversion rate is zero. A different acquisition path may exist but is not represented.','Clarify the acquisition funnel or correct the conversion estimate.');
  }
  if(mode==='service') add('medium','New client volume needs evidence','Expected clients per month are assumed, not validated demand.','Get paid pilots or signed commitments before the full setup investment.');
  if(mode==='branch') add('medium','Sales and opening ramp-up need evidence','The model uses the same expected monthly volume throughout the evaluation period.','Test a slower opening ramp, foot traffic and working-capital requirements before signing a lease.');
  return flags;
}

export const decisionModeConfig = {
  hire: {
    short: 'Hire vs subcontract', title: 'Hire an employee or subcontract?', description: 'Compare allocated project cost, the full-period cash commitment, and available capacity.',
    nameLabel: 'Project / role', fields: [
      ['projectRevenue','Client revenue for this project ($)'],['monthlySalary','Employee salary per month ($)'],['employerCostPct','Employer taxes & benefits (%)'],['monthlyToolsCost','Tools / equipment per month ($)'],['hiringSetupCost','Recruitment / setup cost ($)'],['productiveHoursPerMonth','Productive hours per month'],['projectHoursNeeded','Project hours required'],['periodMonths','Comparison period (months)'],['subcontractorQuote','Subcontractor quote for same scope ($)'],['subcontractorManagementCost','Subcontractor coordination cost ($)'],['employeeReworkCost','Expected employee rework cost ($)'],['subcontractorReworkCost','Expected subcontractor rework cost ($)']
    ], example: { business:'Build a 80-hour website project', projectRevenue:8000, monthlySalary:2500, employerCostPct:20, monthlyToolsCost:150, hiringSetupCost:500, productiveHoursPerMonth:120, projectHoursNeeded:80, periodMonths:1, subcontractorQuote:5500, subcontractorManagementCost:300, employeeReworkCost:200, subcontractorReworkCost:300, details:'Employee may have idle capacity after this project. Confirm whether the same scope, quality, deadlines, and rework obligations are included in both options.' }
  },
  inventory: {
    short: 'Bulk vs small batch', title: 'Buy a large batch or start small?', description: 'Compare expected profit, unsold stock exposure, break-even sales, and possible stockouts.',
    nameLabel: 'Product / inventory decision', fields: [
      ['bulkQuantity','Large-batch quantity (units)'],['bulkUnitCost','Large-batch unit cost ($)'],['bulkShippingCost','Large-batch shipping / import cost ($)'],['smallQuantity','Small-batch quantity (units)'],['smallUnitCost','Small-batch unit cost ($)'],['smallShippingCost','Small-batch shipping / import cost ($)'],['sellingPrice','Selling price per unit ($)'],['expectedSalesUnits','Expected demand in period (units)'],['holdingCostPerUnsoldUnit','Storage cost per unsold unit ($)'],['salvageValuePerUnsoldUnit','Recoverable value per unsold unit ($)']
    ], example: { business:'Imported home accessory', bulkQuantity:500, bulkUnitCost:12, bulkShippingCost:700, smallQuantity:100, smallUnitCost:15, smallShippingCost:180, sellingPrice:25, expectedSalesUnits:220, holdingCostPerUnsoldUnit:1.5, salvageValuePerUnsoldUnit:5, details:'Demand is an estimate, not confirmed orders. Import duties, defects, returns, and storage beyond this planning period may need separate estimates.' }
  },
  discount: {
    short: 'Discount test', title: 'Offer a discount or keep the price?', description: 'Calculate how many additional units you must sell to preserve the current contribution profit.',
    nameLabel: 'Offer / promotion', fields: [
      ['currentPrice','Current selling price per unit ($)'],['unitCost','Variable cost per unit ($)'],['currentSalesUnits','Current sales volume (units)'],['discountPct','Proposed discount (%)'],['expectedSalesAfterDiscount','Expected sales after discount (units)']
    ], example: { business:'15% seasonal promotion', currentPrice:100, unitCost:55, currentSalesUnits:100, discountPct:15, expectedSalesAfterDiscount:125, details:'Fixed costs are excluded from both sides because they are assumed unchanged. Include extra fulfillment, payment, or return costs in unit cost if the promotion creates them.' }
  },
  ads: {
    short: 'Ad spend ROI', title: 'Will a $1,000 ad campaign pay back?', description: 'Calculate the sales, orders, leads, and ROAS needed to recover ad spend after variable costs.',
    nameLabel: 'Campaign / channel', fields: [
      ['adSpend','Ad spend ($)'],['averageOrderRevenue','Average revenue per order ($)'],['variableCostPerOrder','Variable cost per order ($)'],['expectedOrdersFromAds','Expected orders from campaign'],['leadToCustomerConversionPct','Lead-to-customer conversion (%)']
    ], example: { business:'Test campaign for an online store', adSpend:1000, averageOrderRevenue:100, variableCostPerOrder:60, expectedOrdersFromAds:20, leadToCustomerConversionPct:5, details:'This checks the break-even economics only. It does not predict click costs, lead quality, conversion, attribution, repeat purchases, or organic sales.' }
  },
  service: {
    short: 'New service', title: 'Should you add a new service?', description: 'Estimate contribution, monthly break-even clients, and whether the setup investment pays back in the chosen period.',
    nameLabel: 'Proposed service', fields: [
      ['setupInvestment','One-time setup / launch investment ($)'],['monthlyFixedCost','Additional fixed cost per month ($)'],['pricePerClient','Price per client / project ($)'],['variableCostPerClient','Variable cost per client / project ($)'],['expectedClientsPerMonth','Expected clients per month'],['evaluationMonths','Evaluation period (months)']
    ], example: { business:'AI automation service package', setupInvestment:3500, monthlyFixedCost:500, pricePerClient:500, variableCostPerClient:150, expectedClientsPerMonth:4, evaluationMonths:6, details:'Client volume is a hypothesis. Include onboarding, support, software, sales time, and delivery labor in variable or fixed costs.' }
  },
  branch: {
    short: 'New branch', title: 'Can a new branch cover its costs?', description: 'Calculate required monthly turnover, base profit, downside profit, and total cash impact including setup.',
    nameLabel: 'New location / branch', fields: [
      ['setupCost','One-time opening / fit-out cost ($)'],['monthlyRent','Rent per month ($)'],['monthlyPayroll','Payroll per month ($)'],['monthlyUtilities','Utilities per month ($)'],['monthlyOtherFixedCost','Other fixed costs per month ($)'],['averageSaleValue','Average sale value ($)'],['variableCostPerSale','Variable cost per sale ($)'],['expectedSalesPerMonth','Expected sales per month (transactions)'],['downsideSalesDropPct','Downside sales decline (%)'],['evaluationMonths','Evaluation period (months)']
    ], example: { business:'Second retail location', setupCost:20000, monthlyRent:2500, monthlyPayroll:5000, monthlyUtilities:500, monthlyOtherFixedCost:1000, averageSaleValue:50, variableCostPerSale:25, expectedSalesPerMonth:500, downsideSalesDropPct:30, evaluationMonths:6, details:'Expected transaction volume needs evidence. Permits, renovation overruns, opening delays, working capital, taxes, and cannibalization of the existing location are not separately modeled.' }
  }
};

function analyzeHire(input) {
  const fields = ['monthlySalary','employerCostPct','monthlyToolsCost','hiringSetupCost','productiveHoursPerMonth','projectHoursNeeded','periodMonths','subcontractorQuote','subcontractorManagementCost','employeeReworkCost','subcontractorReworkCost'];
  ensure(input, fields);
  const v = Object.fromEntries(fields.map(k => [k, num(input[k], k)]));
  positive(v.monthlySalary, 'monthlySalary'); positive(v.productiveHoursPerMonth, 'productiveHoursPerMonth'); positive(v.periodMonths, 'periodMonths'); positive(v.projectHoursNeeded, 'projectHoursNeeded'); positive(v.subcontractorQuote, 'subcontractorQuote');
  const loadedMonthly = v.monthlySalary * (1 + v.employerCostPct / 100) + v.monthlyToolsCost;
  const loadedHourly = loadedMonthly / v.productiveHoursPerMonth;
  const employeeAllocatedCost = loadedHourly * v.projectHoursNeeded + v.hiringSetupCost + v.employeeReworkCost;
  const employeeCashCommitment = loadedMonthly * v.periodMonths + v.hiringSetupCost + v.employeeReworkCost;
  const capacityHours = v.productiveHoursPerMonth * v.periodMonths;
  const spareHours = capacityHours - v.projectHoursNeeded;
  const subcontractorTotal = v.subcontractorQuote + v.subcontractorManagementCost + v.subcontractorReworkCost;
  const difference = employeeAllocatedCost - subcontractorTotal;
  // Optional for backwards compatibility with earlier saved scenarios.
  const projectRevenue = input.projectRevenue == null || input.projectRevenue === '' ? null : num(input.projectRevenue, 'projectRevenue');
  const employeeAllocatedProfit = projectRevenue === null ? null : projectRevenue - employeeAllocatedCost;
  const employeeCashProfit = projectRevenue === null ? null : projectRevenue - employeeCashCommitment;
  const subcontractProfit = projectRevenue === null ? null : projectRevenue - subcontractorTotal;
  const risks = [];
  if (projectRevenue !== null && employeeCashProfit < 0 && subcontractProfit < 0) risks.push(risk('high','Neither delivery option covers its full modeled cost',`Project revenue ${money(projectRevenue)} is below both full-period employee cash commitment ${money(employeeCashCommitment)} and subcontractor cost ${money(subcontractorTotal)}.`, 'Renegotiate the project price or scope before selecting a delivery option.'));
  if (spareHours < 0) risks.push(risk('high','Employee capacity is insufficient for this period',`The project needs ${money(v.projectHoursNeeded)} hours, but the entered period provides ${money(capacityHours)} productive hours.`, 'Extend the timeline or calculate overtime / extra capacity before comparing prices.'));
  if (Math.abs(difference) / Math.max(1, employeeAllocatedCost, subcontractorTotal) < 0.1) risks.push(risk('medium','The cost difference is small',`The allocated project costs differ by only ${money(Math.abs(difference))}; small scope or rework changes may reverse the result.`, 'Get fixed-scope written quotes and compare delivery, revision limits, ownership, and warranty.'));
  if (spareHours > 0 && employeeCashCommitment > subcontractorTotal) risks.push(risk('medium','Unused employee capacity may become a cash cost',`The full-period employee cash commitment is ${money(employeeCashCommitment)}, versus ${money(subcontractorTotal)} for the subcontractor. The allocated comparison assumes spare hours can be used productively elsewhere.`, 'List confirmed work for the spare hours; if there is none, compare full-period cash cost rather than allocated hours alone.'));
  const bothOptionsLose = employeeCashProfit !== null && employeeCashProfit < 0 && subcontractProfit < 0;
  const status = spareHours < 0 || bothOptionsLose ? 'rework' : difference < 0 ? 'verify' : 'review';
  return {
    kind:'hire', cards:[card('Employee allocated project cost',employeeAllocatedCost,'money',employeeAllocatedCost>subcontractorTotal),card('Subcontractor total cost',subcontractorTotal,'money',subcontractorTotal>employeeAllocatedCost),card('Full-period employee cash commitment',employeeCashCommitment,'money',employeeCashCommitment>subcontractorTotal),card('Employee capacity utilization',capacityHours>0?100*v.projectHoursNeeded/capacityHours:null,'percent',spareHours<0),card('Employee cash-basis project profit',employeeCashProfit,'money',employeeCashProfit!==null&&employeeCashProfit<0),card('Subcontractor project profit',subcontractProfit,'money',subcontractProfit!==null&&subcontractProfit<0)],
    metrics:[metric('Cost difference (employee minus subcontractor)',difference),metric('Spare productive hours in period',spareHours,'number',spareHours<0),metric('Loaded employee cost per productive hour',loadedHourly),metric('Revenue needed for employee cash break-even',employeeCashCommitment),metric('Revenue needed for subcontractor break-even',subcontractorTotal)],
    decisionGate:gate(status,spareHours<0?'Resolve capacity before choosing':bothOptionsLose?'Do not accept this project at the entered revenue':'Compare the true scope and unused capacity',spareHours<0?'The employee option does not fit the entered timeline. Cost alone cannot resolve a capacity shortfall.':bothOptionsLose?'Neither full-period employee cash cost nor the subcontractor quote is covered by the entered project revenue. Renegotiate scope or price.':difference<0?'Employee labor is cheaper on an allocated-hours basis under these assumptions. This does not mean the full-period cash commitment is lower.':'Subcontracting is cheaper on the allocated project-cost basis under these assumptions. Confirm that both options cover the same scope and quality.'),
    risks, assumptionAudit:auditDecisionAssumptions('hire',input), explanation:'Employee allocated cost uses a loaded hourly rate plus setup and employee rework. The full-period cash commitment is shown separately because unused time is still paid unless other work fills it.'
  };
}

function inventoryOption(quantity, unitCost, shipping, demand, price, holdingPerUnit, salvagePerUnit, label) {
  const sold = Math.min(quantity, demand);
  const unsold = Math.max(0, quantity - sold);
  const unserved = Math.max(0, demand - quantity);
  const revenue = sold * price;
  const salvageRevenue = unsold * salvagePerUnit;
  const purchaseCost = quantity * unitCost;
  const holdingCost = unsold * holdingPerUnit;
  const profit = revenue + salvageRevenue - purchaseCost - shipping - holdingCost;
  const denominator = price - salvagePerUnit + holdingPerUnit;
  const rawBreakEven = denominator > 0 ? (purchaseCost + shipping + quantity * holdingPerUnit - quantity * salvagePerUnit) / denominator : null;
  const breakEvenSales = rawBreakEven == null || rawBreakEven < 0 ? (rawBreakEven == null ? null : 0) : count(rawBreakEven);
  const unsoldExposure = Math.max(0, unsold * (unitCost - salvagePerUnit) + holdingCost);
  const missedContribution = unserved * Math.max(0, price - unitCost);
  return {label, quantity, unitCost, shipping, sold, unsold, unserved, revenue:money(revenue), salvageRevenue:money(salvageRevenue), purchaseCost:money(purchaseCost), holdingCost:money(holdingCost), profit:money(profit), breakEvenSales, breakEvenAchievable:breakEvenSales !== null && breakEvenSales <= quantity, unsoldExposure:money(unsoldExposure), missedContribution:money(missedContribution)};
}
// Find the first integer demand level at which bulk earns strictly more than small.
// The difference is piecewise linear, with slope changes only at the two batch
// quantities. Binary search each segment to avoid scanning potentially huge lots.
function inventoryBulkWinningDemand(v) {
  const difference = demand => {
    const bulk = inventoryOption(v.bulkQuantity,v.bulkUnitCost,v.bulkShippingCost,demand,v.sellingPrice,v.holdingCostPerUnsoldUnit,v.salvageValuePerUnsoldUnit,'Large batch');
    const small = inventoryOption(v.smallQuantity,v.smallUnitCost,v.smallShippingCost,demand,v.sellingPrice,v.holdingCostPerUnsoldUnit,v.salvageValuePerUnsoldUnit,'Small batch');
    return bulk.profit - small.profit;
  };
  const points = [...new Set([0,v.bulkQuantity,v.smallQuantity])].sort((a,b)=>a-b);
  for (let i=0; i<points.length-1; i++) {
    const left=points[i], right=points[i+1];
    if (difference(left)>0.005) return left;
    if (difference(right)<=0.005) continue;
    let lo=left+1, hi=right;
    while(lo<hi) {
      const mid=Math.floor((lo+hi)/2);
      if(difference(mid)>0.005) hi=mid;
      else lo=mid+1;
    }
    return lo;
  }
  const last=points.at(-1);
  return difference(last)>0.005 ? last : null;
}

function analyzeInventory(input) {
  const fields = ['bulkQuantity','bulkUnitCost','bulkShippingCost','smallQuantity','smallUnitCost','smallShippingCost','sellingPrice','expectedSalesUnits','holdingCostPerUnsoldUnit','salvageValuePerUnsoldUnit'];
  ensure(input, fields);
  const v = Object.fromEntries(fields.map(k => [k, num(input[k], k)]));
  positive(v.bulkQuantity,'bulkQuantity'); positive(v.smallQuantity,'smallQuantity'); positive(v.sellingPrice,'sellingPrice');
  if (!Number.isInteger(v.bulkQuantity) || !Number.isInteger(v.smallQuantity) || !Number.isInteger(v.expectedSalesUnits)) throw new Error('Batch quantities and expected demand must be whole units.');
  const bulk = inventoryOption(v.bulkQuantity,v.bulkUnitCost,v.bulkShippingCost,v.expectedSalesUnits,v.sellingPrice,v.holdingCostPerUnsoldUnit,v.salvageValuePerUnsoldUnit,'Large batch');
  const small = inventoryOption(v.smallQuantity,v.smallUnitCost,v.smallShippingCost,v.expectedSalesUnits,v.sellingPrice,v.holdingCostPerUnsoldUnit,v.salvageValuePerUnsoldUnit,'Small batch');
  const risks=[];
  if (bulk.unsold > 0) risks.push(risk('medium','Large batch leaves unsold inventory',`${bulk.unsold} units remain unsold under the entered demand. Modeled net unsold-stock exposure is ${bulk.unsoldExposure}.`, 'Validate demand with pre-orders or a smaller paid pilot; confirm storage, expiry, returns, and salvage value.'));
  if (small.unserved > 0) risks.push(risk('medium','Small batch may stock out',`The small batch serves ${small.sold} of ${v.expectedSalesUnits} expected units and leaves ${small.unserved} units of demand unserved if no reorder arrives in time.`, 'Check supplier lead time and calculate a reorder point before assuming the remaining demand can be captured.'));
  if (bulk.profit < 0 || small.profit < 0) risks.push(risk('high','At least one inventory option loses money in the modeled period','Purchase, shipping, storage and salvage assumptions produce a negative modeled result for at least one option.','Recheck landed unit cost, achievable selling price, and realistic demand before ordering.'));
  const better = bulk.profit === small.profit ? 'tie' : bulk.profit > small.profit ? 'bulk' : 'small';
  const bulkWinningDemand = inventoryBulkWinningDemand(v);
  const salvageNeedsVerification = v.salvageValuePerUnsoldUnit > Math.min(v.bulkUnitCost,v.smallUnitCost);
  const bestLabel = better === 'tie' ? 'Neither option has a modeled profit advantage' : better === 'bulk' ? 'Large batch has the higher modeled profit' : 'Small batch has the higher modeled profit';
  const flipExplanation = bulkWinningDemand===null ? 'No modeled demand up to the larger batch quantity makes bulk more profitable than small.' : bulkWinningDemand>v.expectedSalesUnits ? `Bulk first becomes more profitable than small at ${bulkWinningDemand} units of demand, not at its own break-even of ${bulk.breakEvenSales ?? 'unavailable'} units.` : '';
  return {kind:'inventory', cards:[card('Large-batch modeled profit',bulk.profit,'money',bulk.profit<0),card('Small-batch modeled profit',small.profit,'money',small.profit<0),card('Large-batch unsold-stock exposure',bulk.unsoldExposure,'money',bulk.unsoldExposure>0),card('Small-batch unserved demand',small.unserved,'number',small.unserved>0)],
    metrics:[metric('Large-batch break-even sales',bulk.breakEvenAchievable?bulk.breakEvenSales:null,'count',!bulk.breakEvenAchievable),metric('Small-batch break-even sales',small.breakEvenAchievable?small.breakEvenSales:null,'count',!small.breakEvenAchievable),metric('Large-batch unsold units',bulk.unsold,'count',bulk.unsold>0),metric('Small-batch unsold units',small.unsold,'count',small.unsold>0),metric('Potential contribution missed by small batch',small.missedContribution),metric('Demand where bulk first beats small',bulkWinningDemand,'count',bulkWinningDemand===null)],
    decisionGate:gate(salvageNeedsVerification?'review':better==='tie'?'review':(better==='bulk'?'verify':'pilot'),salvageNeedsVerification?'Verify unusually high salvage value before choosing':bestLabel,`Under expected demand of ${v.expectedSalesUnits} units, the large-batch modeled result is ${bulk.profit} and the small-batch result is ${small.profit}. This comparison assumes the entered demand and salvage values; it does not estimate market demand. ${flipExplanation}`),
    risks, comparison:{bulkWinningDemand}, assumptionAudit:auditDecisionAssumptions('inventory',input), explanation:'Modeled profit credits liquidation proceeds for all unsold units within the period; this is an assumption, not realized cash. Profit also includes purchased units, shipping, sales and storage costs. Potential missed contribution assumes small-batch demand cannot be replenished and excludes new reorder shipping.'
  };
}

function analyzeDiscount(input) {
  const fields=['currentPrice','unitCost','currentSalesUnits','discountPct','expectedSalesAfterDiscount']; ensure(input,fields);
  const v=Object.fromEntries(fields.map(k=>[k,num(input[k],k)]));
  positive(v.currentPrice,'currentPrice'); positive(v.currentSalesUnits,'currentSalesUnits');
  if(v.discountPct>=100) throw new Error('Discount must be less than 100%.');
  // The promotional scenario may have extra per-unit fulfillment costs that
  // must not silently be applied to the unchanged full-price comparator.
  const promoUnitCost=input.discountedUnitCost == null ? v.unitCost : num(input.discountedUnitCost,'discountedUnitCost');
  const discountedPrice=v.currentPrice*(1-v.discountPct/100);
  const baseContributionPerUnit=v.currentPrice-v.unitCost;
  const discountedContributionPerUnit=discountedPrice-promoUnitCost;
  const baseContribution=baseContributionPerUnit*v.currentSalesUnits;
  const requiredUnits=baseContribution>=0&&discountedContributionPerUnit>0?count(baseContribution/discountedContributionPerUnit):null;
  const expectedContribution=v.expectedSalesAfterDiscount*discountedContributionPerUnit;
  const extraUnits=requiredUnits===null?null:Math.max(0,requiredUnits-v.currentSalesUnits);
  const upliftPct=requiredUnits===null?null:money((requiredUnits/v.currentSalesUnits-1)*100);
  const difference=money(expectedContribution-baseContribution);
  const risks=[];
  if(discountedContributionPerUnit<=0) risks.push(risk('high','Discount eliminates unit contribution',`Discounted price is ${money(discountedPrice)} while promotional variable cost is ${money(promoUnitCost)} per unit. Each additional sale loses contribution before fixed costs.`, 'Do not use volume alone to justify the discount; reprice or reduce unit cost.'));
  else if(requiredUnits!==null&&v.expectedSalesAfterDiscount<requiredUnits) risks.push(risk('high','Expected volume does not recover the discount',`The plan expects ${v.expectedSalesAfterDiscount} units, but needs ${requiredUnits} units to match current contribution.`, 'Run a limited promotion and compare incremental units against the calculated threshold, using a control group if possible.'));
  else if(requiredUnits!==null&&v.expectedSalesAfterDiscount>=requiredUnits) risks.push(risk('review','Promotion depends on the sales uplift materializing',`The entered expected volume reaches the threshold, but that uplift has not been validated by this calculation.`, 'Compare with a prior comparable promotion or test the discount on a limited audience.'));
  return {kind:'discount',cards:[card('Current contribution profit',baseContribution,'money',baseContribution<0),card('Discounted price per unit',discountedPrice),card('Contribution per discounted unit',discountedContributionPerUnit,'money',discountedContributionPerUnit<=0),card('Expected contribution after discount',expectedContribution,'money',difference<0)],
    metrics:[metric('Units required to match current contribution',requiredUnits,'count',requiredUnits===null),metric('Additional units required',extraUnits,'count',extraUnits!==null&&extraUnits>0),metric('Required sales uplift',upliftPct,'percent',upliftPct!==null&&upliftPct>0),metric('Contribution change vs current',difference,'money',difference<0)],
    decisionGate:gate(discountedContributionPerUnit<=0?'rework':(requiredUnits===null?'review':(v.expectedSalesAfterDiscount>=requiredUnits?'pilot':'review')),discountedContributionPerUnit<=0?'Do not discount below variable cost':(requiredUnits!==null&&v.expectedSalesAfterDiscount>=requiredUnits?'Test the promotion on a limited scale':'Keep the current price unless the sales uplift is credible'),discountedContributionPerUnit<=0?'The discounted price does not cover variable cost, so more sales increase the contribution loss.':`The discount requires ${requiredUnits===null?'a valid positive contribution margin':`${requiredUnits} units`} to match the current contribution of ${money(baseContribution)}. Expected discounted sales are ${v.expectedSalesAfterDiscount}.`),
    risks,assumptionAudit:auditDecisionAssumptions('discount',input),explanation:`This compares contribution before fixed costs. Regular unit cost is ${money(v.unitCost)} and promotional unit cost is ${money(promoUnitCost)}. Fixed costs are assumed unchanged; customer response is not predicted.`};
}

function analyzeAds(input) {
  const fields=['adSpend','averageOrderRevenue','variableCostPerOrder','expectedOrdersFromAds','leadToCustomerConversionPct']; ensure(input,fields);
  const v=Object.fromEntries(fields.map(k=>[k,num(input[k],k)]));
  positive(v.adSpend,'adSpend'); positive(v.averageOrderRevenue,'averageOrderRevenue');
  if(v.leadToCustomerConversionPct>100) throw new Error('Lead-to-customer conversion cannot exceed 100%.');
  const contribution=v.averageOrderRevenue-v.variableCostPerOrder;
  const requiredOrders=contribution>0?count(v.adSpend/contribution):null;
  const requiredRevenue=requiredOrders===null?null:requiredOrders*v.averageOrderRevenue;
  const requiredLeads=requiredOrders===null||v.leadToCustomerConversionPct<=0?null:count(requiredOrders/(v.leadToCustomerConversionPct/100));
  const expectedLeads=v.leadToCustomerConversionPct<=0?null:count(v.expectedOrdersFromAds/(v.leadToCustomerConversionPct/100));
  const expectedRevenue=v.expectedOrdersFromAds*v.averageOrderRevenue;
  const expectedContribution=v.expectedOrdersFromAds*contribution;
  const netAfterAds=expectedContribution-v.adSpend;
  const requiredRoas=requiredRevenue===null?null:requiredRevenue/v.adSpend;
  const actualModeledRoas=expectedRevenue/v.adSpend;
  const expectedCAC=v.expectedOrdersFromAds>0?v.adSpend/v.expectedOrdersFromAds:null;
  const maxAffordableCAC=contribution>0?contribution:null;
  const conversionNeeded=expectedLeads>0&&requiredOrders!==null?100*requiredOrders/expectedLeads:null;
  const risks=[];
  if(contribution<=0) risks.push(risk('high','Each order fails to cover its variable cost',`Average order revenue is ${v.averageOrderRevenue} and variable cost is ${v.variableCostPerOrder}. Ad spend is not yet included.`, 'Fix order economics before buying traffic.'));
  else if(netAfterAds<0) risks.push(risk('high','Entered order volume does not repay the ad spend',`At ${v.expectedOrdersFromAds} orders, contribution after ad spend is ${money(netAfterAds)}.`, 'Use a small capped test; track attributable paid orders and contribution, not clicks or revenue alone.'));
  else risks.push(risk('review','Break-even depends on attributable paid orders',`The entered order count leaves ${money(netAfterAds)} after ad spend, assuming all orders are genuinely incremental and attributed to the campaign.`, 'Verify tracking, returns, refunds, agency fees, and whether the campaign creates incremental sales.'));
  return {kind:'ads',cards:[card('Contribution per order',contribution,'money',contribution<=0),card('Orders needed to recover ad spend',requiredOrders,'count',requiredOrders===null),card('Revenue needed at break-even',requiredRevenue),card('Expected profit after ad spend',netAfterAds,'money',netAfterAds<0)],
    metrics:[metric('Leads implied by expected orders',expectedLeads,'count',expectedLeads===null),metric('Break-even leads at entered conversion',requiredLeads,'count',requiredLeads===null),metric('Break-even revenue / ad spend (ROAS)',requiredRoas,'ratio'),metric('Modeled ROAS at expected orders',actualModeledRoas,'ratio'),metric('Expected orders below break-even',requiredOrders===null?null:Math.max(0,requiredOrders-v.expectedOrdersFromAds),'count',requiredOrders!==null&&v.expectedOrdersFromAds<requiredOrders),metric('Modeled ad cost per acquired order',expectedCAC,'money',expectedCAC!==null&&maxAffordableCAC!==null&&expectedCAC>maxAffordableCAC),metric('Maximum ad cost per order at break-even',maxAffordableCAC,'money',maxAffordableCAC===null),metric('Conversion required at implied lead volume',conversionNeeded,'percent',conversionNeeded!==null&&conversionNeeded>v.leadToCustomerConversionPct)],
    decisionGate:gate(contribution<=0?'rework':netAfterAds<0?'pilot':'verify',contribution<=0?'Fix order economics before advertising':netAfterAds<0?'Test with a capped budget before scaling':'Economics clear the entered break-even threshold; validate attribution',contribution<=0?'Revenue per order does not exceed variable cost, so no finite order count repays advertising in this model.':`The model requires ${requiredOrders} orders and ${requiredRevenue} revenue to cover ${v.adSpend} in ad spend. This is a break-even calculation, not a campaign performance prediction.`),
    risks,assumptionAudit:auditDecisionAssumptions('ads',input),explanation:'Contribution equals order revenue minus variable order cost. ROAS here is revenue divided by ad spend; the required ROAS accounts for variable costs and is usually higher than 1.0.'};
}

function analyzeService(input) {
  const fields=['setupInvestment','monthlyFixedCost','pricePerClient','variableCostPerClient','expectedClientsPerMonth','evaluationMonths']; ensure(input,fields);
  const v=Object.fromEntries(fields.map(k=>[k,num(input[k],k)])); positive(v.pricePerClient,'pricePerClient'); positive(v.evaluationMonths,'evaluationMonths');
  const contribution=v.pricePerClient-v.variableCostPerClient;
  const monthlyOperatingProfit=v.expectedClientsPerMonth*contribution-v.monthlyFixedCost;
  const periodProfit=monthlyOperatingProfit*v.evaluationMonths-v.setupInvestment;
  const breakEvenClients=contribution>0?count(v.monthlyFixedCost/contribution):null;
  const totalClientsToRecover=contribution>0?count((v.setupInvestment+v.monthlyFixedCost*v.evaluationMonths)/contribution):null;
  const paybackMonths=monthlyOperatingProfit>0?v.setupInvestment/monthlyOperatingProfit:null;
  const risks=[];
  if(contribution<=0) risks.push(risk('high','Service price does not cover delivery cost',`Each client contributes ${money(contribution)} before monthly fixed costs.`, 'Rebuild scope, delivery hours, and price before launching.'));
  else if(periodProfit<0) risks.push(risk('high','Setup investment is not recovered in the chosen period',`The model ends ${v.evaluationMonths} months at ${money(periodProfit)} after the setup investment.`, 'Validate demand with paid pilot clients and reduce setup spend or extend the payback period only if cash runway supports it.'));
  else risks.push(risk('review','Client volume remains an unverified assumption',`The entered volume of ${v.expectedClientsPerMonth} clients per month produces a modeled period result of ${money(periodProfit)}.`, 'Secure pilot customers or signed letters of intent before committing the full setup cost.'));
  return {kind:'service',cards:[card('Contribution per client',contribution,'money',contribution<=0),card('Monthly operating profit',monthlyOperatingProfit,'money',monthlyOperatingProfit<0),card('Profit after setup over chosen period',periodProfit,'money',periodProfit<0),card('Setup payback time',paybackMonths,'months',paybackMonths===null)],
    metrics:[metric('Break-even clients per month',breakEvenClients,'count',breakEvenClients===null),metric('Total clients needed to recover setup in period',totalClientsToRecover,'count',totalClientsToRecover===null),metric('Expected clients over period',v.expectedClientsPerMonth*v.evaluationMonths,'count'),metric('Client volume above / below total threshold',totalClientsToRecover===null?null:v.expectedClientsPerMonth*v.evaluationMonths-totalClientsToRecover,'count',totalClientsToRecover!==null&&v.expectedClientsPerMonth*v.evaluationMonths<totalClientsToRecover)],
    decisionGate:gate(contribution<=0?'rework':periodProfit<0?'pilot':'verify',contribution<=0?'Redesign service economics before launch':periodProfit<0?'Run a smaller paid pilot before investing fully':'The entered plan recovers setup within the modeled period',contribution<=0?'The service cannot cover variable delivery cost at the entered price.':`At ${v.expectedClientsPerMonth} clients per month, the modeled result after ${v.evaluationMonths} months and setup cost is ${money(periodProfit)}. Actual demand is not estimated.`),
    risks,assumptionAudit:auditDecisionAssumptions('service',input),explanation:'Each client is modeled as a one-time project sale. If clients pay monthly, renew, or create ongoing support costs, use a subscription model or revise the inputs accordingly.'};
}

function analyzeBranch(input) {
  const fields=['setupCost','monthlyRent','monthlyPayroll','monthlyUtilities','monthlyOtherFixedCost','averageSaleValue','variableCostPerSale','expectedSalesPerMonth','downsideSalesDropPct','evaluationMonths']; ensure(input,fields);
  const v=Object.fromEntries(fields.map(k=>[k,num(input[k],k)])); positive(v.averageSaleValue,'averageSaleValue'); positive(v.evaluationMonths,'evaluationMonths');
  if(v.downsideSalesDropPct>100) throw new Error('Downside sales decline cannot exceed 100%.');
  const fixed=v.monthlyRent+v.monthlyPayroll+v.monthlyUtilities+v.monthlyOtherFixedCost;
  const contribution=v.averageSaleValue-v.variableCostPerSale;
  const margin=v.averageSaleValue>0?contribution/v.averageSaleValue:0;
  const baseRevenue=v.expectedSalesPerMonth*v.averageSaleValue;
  const baseMonthlyProfit=v.expectedSalesPerMonth*contribution-fixed;
  const downsideSales=v.expectedSalesPerMonth*(1-v.downsideSalesDropPct/100);
  const downsideRevenue=downsideSales*v.averageSaleValue;
  const downsideMonthlyProfit=downsideSales*contribution-fixed;
  const periodDownsideResult=downsideMonthlyProfit*v.evaluationMonths-v.setupCost;
  const breakEvenSales=contribution>0?count(fixed/contribution):null;
  const breakEvenRevenue=margin>0?fixed/margin:null;
  const risks=[];
  if(contribution<=0) risks.push(risk('high','Unit economics cannot cover branch fixed costs',`Average sale value ${v.averageSaleValue} does not exceed variable cost ${v.variableCostPerSale}.`, 'Validate gross margin and supplier costs before considering rent or payroll commitments.'));
  else if(downsideMonthlyProfit<0) risks.push(risk('high','Downside sales do not cover monthly fixed costs',`A ${v.downsideSalesDropPct}% sales decline leaves ${money(downsideMonthlyProfit)} monthly operating loss, before the opening investment.`, 'Stress-test a longer ramp-up period, and secure evidence of demand before signing a long lease.'));
  else risks.push(risk('review','The downside case still depends on assumed transaction volume',`The entered downside scenario produces ${money(downsideMonthlyProfit)} monthly profit before setup cost.`, 'Validate foot traffic, conversion, average basket, and repeat purchases with evidence from a comparable location or a short pop-up test.'));
  if(baseMonthlyProfit<0) risks.push(risk('high','Base sales do not cover fixed costs',`The entered base case produces ${money(baseMonthlyProfit)} monthly operating profit before setup cost.`, 'Recalculate required transactions and turnover using the actual contribution per sale.'));
  return {kind:'branch',cards:[card('Monthly fixed costs',fixed),card('Break-even monthly turnover',breakEvenRevenue,'money',breakEvenRevenue===null),card('Base monthly operating profit',baseMonthlyProfit,'money',baseMonthlyProfit<0),card('Downside monthly operating profit',downsideMonthlyProfit,'money',downsideMonthlyProfit<0),card('Downside result after period + setup',periodDownsideResult,'money',periodDownsideResult<0)],
    metrics:[metric('Break-even transactions per month',breakEvenSales,'count',breakEvenSales===null),metric('Base monthly turnover',baseRevenue),metric('Downside monthly turnover',downsideRevenue),metric('Downside sales volume per month',downsideSales,'count'),metric('Modeled downside net loss incl. setup',Math.max(0,-periodDownsideResult))],
    decisionGate:gate(contribution<=0?'rework':downsideMonthlyProfit<0?'review':periodDownsideResult<0?'pilot':'verify',contribution<=0?'Fix per-sale margin before opening':downsideMonthlyProfit<0?'Do not commit to fixed costs without a credible ramp-up plan':periodDownsideResult<0?'Downside case does not recover setup investment':'Downside case covers modeled fixed costs and setup',`Break-even turnover is ${breakEvenRevenue===null?'not achievable at the entered unit economics':money(breakEvenRevenue)} per month. Under the entered ${v.downsideSalesDropPct}% decline scenario, the period result after setup is ${money(periodDownsideResult)}.`),
    risks,assumptionAudit:auditDecisionAssumptions('branch',input),explanation:'This is a simplified branch model. It excludes taxes, financing, working capital, opening delays, cannibalization, and any costs not entered above.'};
}

export function analyzeDecision(mode, input) {
  switch(mode) {
    case 'hire': return analyzeHire(input);
    case 'inventory': return analyzeInventory(input);
    case 'discount': return analyzeDiscount(input);
    case 'ads': return analyzeAds(input);
    case 'service': return analyzeService(input);
    case 'branch': return analyzeBranch(input);
    default: throw new Error(`Unsupported decision mode: ${mode}`);
  }
}
