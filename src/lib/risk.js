// Deterministic and auditable calculations. Meta is NOT used to invent financial metrics.
const money = (n) => Math.round(n * 100) / 100;
const n = (value) => {
  if (value === '' || value == null) return null;
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : null;
};
const ensure = (obj, fields) => {
  for (const field of fields) {
    if (n(obj[field]) === null) throw new Error(`Please enter a valid non-negative value for ${field}.`);
  }
};

function auditAssumptions(mode, input) {
  const details = typeof input.details === 'string' ? input.details.toLowerCase() : '';
  const flags = [];
  if (mode === 'quote') {
    if (/(shipping|delivery|freight|transport)/i.test(details) && n(input.shippingCost) === 0) {
      flags.push({severity:'high', title:'Shipping or delivery is mentioned but priced at $0', reason:'The context mentions shipping/delivery, but the dedicated shipping line is zero. This may be included elsewhere, so it is a reconciliation flag, not proof of an omitted cost.', test:'Get the supplier’s written delivered price and identify which line item includes freight to avoid omission or double-counting.'});
    }
    if (/(weekend|overtime|after-hours|inspection|rework|rush deadline|urgent deadline)/i.test(details)) {
      flags.push({severity:'medium', title:'Schedule or quality premium needs confirmation', reason:'The context mentions weekend work, overtime, inspection, rework, or urgency, but the calculator has no separate premium field.', test:'Confirm in writing whether the entered labor/subcontract costs cover the stated schedule, inspection, and rework obligations.'});
    }
  } else {
    if (mode === 'product' && n(input.activeCustomers) > 0) {
      flags.push({severity:'medium',title:'Launch starts with an existing active customer base',reason:`The model starts with ${n(input.activeCustomers)} paying customers, not zero. This can materially increase the six-month result for a genuinely new launch.`,test:'Confirm these are existing paying subscribers. If launching from zero, set Current active customers to 0.'});
    }
    if (n(input.newCustomers) > 0 && n(input.marketingSpend) === 0) {
      flags.push({severity:'medium', title:'Customer acquisition cost is not modeled separately', reason:'The plan adds new customers each month while marketing spend is $0. Organic acquisition may be possible, but the acquisition mechanism and its cost are not represented here.', test:'Run a small channel test and record actual spend, qualified leads, conversions, and time required.'});
    }
    if (/(onboarding|setup|customer support|support team|payment processing|transaction fee|refund|chargeback|customer service)/i.test(details)) {
      flags.push({severity:'medium', title:'Operational costs mentioned in context need mapping', reason:'The context mentions onboarding, support, payment fees, refunds, or service operations, but these do not have dedicated input fields.', test:'Confirm these costs are included in cost per customer or fixed costs; add them there if not.'});
    }
  }
  return flags;
}

export function analyzeQuote(input) {
  ensure(input, ['quotePrice', 'materialCost', 'shippingCost', 'laborCost', 'subcontractCost', 'overheadCost', 'extraHours', 'hourlyRate', 'materialInflationPct']);
  const price = n(input.quotePrice);
  if (price <= 0) throw new Error('Quote price must be greater than zero.');
  const materialCost = n(input.materialCost);
  const hourlyRate = n(input.hourlyRate);
  const baseCost = materialCost + n(input.shippingCost) + n(input.laborCost) + n(input.subcontractCost) + n(input.overheadCost);
  const addedCost = n(input.extraHours) * hourlyRate + materialCost * n(input.materialInflationPct) / 100;
  const stressedCost = baseCost + addedCost;
  const baseProfit = price - baseCost;
  const stressedProfit = price - stressedCost;
  const breakEvenPrice = stressedCost;
  const margin = (profit) => money(100 * profit / price);
  const stressMarginPct = margin(stressedProfit);
  const targetMarginPct = 15; // Illustrative review threshold, not a universal business rule.
  const targetQuotePrice = money(stressedCost / (1 - targetMarginPct / 100));
  const extraInflationPointsToBreakEven = stressedProfit > 0 && materialCost > 0
    ? money(stressedProfit / materialCost * 100)
    : null;
  const extraHoursToBreakEven = stressedProfit > 0 && hourlyRate > 0
    ? money(stressedProfit / hourlyRate)
    : null;
  const oneExtraLaborHourCost = money(hourlyRate);
  const oneMaterialInflationPointCost = money(materialCost / 100);
  const risks = [];
  if (baseProfit < 0) risks.push({severity:'high',title:'Unprofitable baseline',reason:'Current entered costs already exceed the quoted price.',basis:'Calculated from entered figures',test:'Recalculate scope, rates, and cost line items.'});
  if (stressedProfit < 0) risks.push({severity:'high',title:'Downside case becomes unprofitable',reason:`Entered stress assumptions add $${money(addedCost)} in costs.`,basis:'Calculated stress scenario, not a forecast',test:'Confirm supplier quotes and realistic extra hours before signing.'});
  if (stressedProfit >= 0 && stressMarginPct < targetMarginPct) risks.push({severity:'medium',title:'Stress margin below review threshold',reason:`The entered stress case leaves only $${money(stressedProfit)} profit at a ${stressMarginPct}% margin, below the illustrative ${targetMarginPct}% review threshold.`,basis:'Deterministic stress calculation + illustrative review threshold',test:'Verify the largest cost assumptions and compare the result with the business’s actual minimum acceptable margin before signing.'});
  if (margin(baseProfit) < targetMarginPct && baseProfit >= 0) risks.push({severity:'medium',title:'Thin baseline margin',reason:`Baseline margin is below the illustrative ${targetMarginPct}% review threshold.`,basis:'User inputs + configurable heuristic',test:'Compare with the business’s actual target margin.'});
  if (n(input.overheadCost) === 0) risks.push({severity:'review',title:'Overheads entered as zero',reason:'This may be correct, but insurance, transport or admin costs might have been omitted.',basis:'Missing-cost hypothesis; not a verified omission',test:'Confirm which indirect costs are included in other line items.'});

  let decisionGate;
  if (stressedProfit < 0) {
    decisionGate = {
      status: 'renegotiate',
      title: 'Do not sign at this price without a change',
      reason: `The entered stress case loses ${money(Math.abs(stressedProfit))}. Renegotiate price or scope, or reduce costs before committing.`,
      targetMarginPct
    };
  } else if (stressMarginPct < targetMarginPct) {
    decisionGate = {
      status: 'review',
      title: 'Review the quote before signing',
      reason: `The stress case leaves a ${stressMarginPct}% margin, below the illustrative ${targetMarginPct}% review threshold. Verify the biggest cost assumptions first.`,
      targetMarginPct
    };
  } else {
    decisionGate = {
      status: 'verify',
      title: 'Verify key assumptions before signing',
      reason: `The stress case leaves a ${stressMarginPct}% margin, but this is a what-if calculation, not proof that costs will match the assumptions.`,
      targetMarginPct
    };
  }

  const mostSensitive = stressedProfit <= 0
    ? 'already_loss_making'
    : oneExtraLaborHourCost === oneMaterialInflationPointCost
      ? 'equal'
      : oneExtraLaborHourCost > oneMaterialInflationPointCost
        ? 'labor'
        : 'materials';

  return {
    kind:'quote',
    baseCost:money(baseCost),
    baseProfit:money(baseProfit),
    baseMarginPct:margin(baseProfit),
    addedCost:money(addedCost),
    stressedCost:money(stressedCost),
    stressedProfit:money(stressedProfit),
    stressMarginPct,
    breakEvenPrice:money(breakEvenPrice),
    decisionGate: {
      ...decisionGate,
      targetQuotePrice,
      additionalPriceNeeded: money(Math.max(0, targetQuotePrice - price))
    },
    resilience: {
      remainingBuffer: money(stressedProfit),
      extraHoursToBreakEven,
      extraInflationPointsToBreakEven,
      oneExtraLaborHourCost,
      oneMaterialInflationPointCost,
      mostSensitive
    },
    risks,
    assumptionAudit: auditAssumptions('quote', input)
  };
}

function simulateProduct(input, scenario) {
  const months = [];
  let active = n(input.activeCustomers);
  let totalProfit = 0;
  const price = n(input.monthlyPrice);
  const costPerCustomer = n(input.costPerCustomer) * (scenario.costMultiplier || 1);
  const newCustomers = n(input.newCustomers) * (scenario.growthMultiplier || 1);
  const churn = Math.min(1, n(input.churnPct) / 100 * (scenario.churnMultiplier || 1));
  for (let month = 1; month <= 6; month++) {
    active = active * (1 - churn) + newCustomers;
    const revenue = active * price;
    const expenses = active * costPerCustomer + n(input.fixedCost) + n(input.marketingSpend);
    const profit = revenue - expenses;
    totalProfit += profit;
    months.push({month, customers:money(active), revenue:money(revenue), expenses:money(expenses), profit:money(profit)});
  }
  return {label:scenario.label,months,profitSixMonths:money(totalProfit),monthSixProfit:months[5].profit};
}
export function analyzeProduct(input) {
  ensure(input, ['monthlyPrice', 'activeCustomers', 'newCustomers', 'churnPct', 'costPerCustomer', 'fixedCost', 'marketingSpend']);
  if (n(input.monthlyPrice) === 0) throw new Error('Subscription price must exceed zero.');
  if (n(input.churnPct) > 100) throw new Error('Monthly churn cannot exceed 100%.');
  const scenarios = [
    simulateProduct(input,{label:'Your plan'}),
    simulateProduct(input,{label:'Half as many new customers',growthMultiplier:0.5}),
    simulateProduct(input,{label:'Double churn & 25% higher variable cost',churnMultiplier:2,costMultiplier:1.25})
  ];
  const risks = [];
  if (n(input.newCustomers) === 0) risks.push({severity:'high',title:'No new customer acquisition planned',reason:'The plan assumes no monthly new customers.',basis:'User-supplied assumption',test:'Validate an acquisition channel with actual visitors or leads.'});
  if (scenarios.some(s => s.monthSixProfit < 0)) risks.push({severity:'high',title:'Negative monthly profit in one or more scenarios',reason:'At least one entered or hypothetical downside scenario has negative profit in month six.',basis:'Deterministic calculation, not probability',test:'Adjust price, acquisition, churn or costs and rerun the model.'});
  if (n(input.churnPct) === 0) risks.push({severity:'review',title:'Zero churn assumption',reason:'Zero churn may be untested for a new subscription product.',basis:'Assumption requiring validation',test:'Run retention interviews or a short pilot; do not assume zero churn.'});
  if (n(input.newCustomers) > 0 && n(input.marketingSpend) > 0) {
    const impliedCAC = n(input.marketingSpend) / n(input.newCustomers);
    const contribution = n(input.monthlyPrice) - n(input.costPerCustomer);
    if (contribution <= 0) risks.push({severity:'high',title:'Negative contribution per customer',reason:'Per-customer monthly variable cost is equal to or higher than revenue.',basis:'Deterministic calculation',test:'Recheck unit economics before launch.'});
    else if (impliedCAC > contribution * 6) risks.push({severity:'medium',title:'Long simple acquisition payback',reason:'Entered monthly marketing spend divided by new customers exceeds six months of per-customer contribution.',basis:'Illustrative heuristic using user inputs',test:'Check whether marketing spend exclusively drives these acquisitions and validate actual CAC.'});
  }

  const planned = scenarios[0];
  const monthSix = planned.months[5];
  const contributionPerCustomer = n(input.monthlyPrice) - n(input.costPerCustomer);
  const breakEvenCustomers = contributionPerCustomer > 0
    ? money((n(input.fixedCost) + n(input.marketingSpend)) / contributionPerCustomer)
    : null;
  const breakEvenMonthlyPrice = monthSix.customers > 0
    ? money(monthSix.expenses / monthSix.customers)
    : null;
  const downsideTurnsNegative = scenarios.slice(1).some(s => s.monthSixProfit < 0);
  let decisionGate;
  if (planned.monthSixProfit < 0) {
    decisionGate = {
      status: 'rework',
      title: 'Rework unit economics before launch',
      reason: `The base plan reaches ${money(planned.monthSixProfit)} monthly profit in month six. Fix pricing, costs, or acquisition assumptions before scaling.`
    };
  } else if (planned.profitSixMonths < 0) {
    decisionGate = {
      status: 'pilot',
      title: 'Check payback before scaling',
      reason: `Month-six profit is positive, but cumulative six-month profit is ${money(planned.profitSixMonths)}. Confirm you have enough runway to cover earlier losses before scaling.`
    };
  } else if (downsideTurnsNegative) {
    decisionGate = {
      status: 'pilot',
      title: 'Run a small pilot before scaling',
      reason: 'The base plan is positive in month six, but at least one downside scenario turns negative. Validate acquisition, churn, and service costs with real customers.'
    };
  } else {
    decisionGate = {
      status: 'pilot',
      title: 'Validate with a controlled pilot',
      reason: 'The modeled scenarios stay positive in month six, but customer acquisition and churn are assumptions, not observed demand. Track real conversion and retention before scaling.'
    };
  }

  return {
    kind:'product',
    scenarios,
    decisionGate,
    resilience: {
      monthSixCustomers: monthSix.customers,
      monthSixProfit: monthSix.profit,
      sixMonthCumulativeProfit: planned.profitSixMonths,
      breakEvenCustomers,
      customersAboveBreakEven: breakEvenCustomers === null ? null : money(monthSix.customers - breakEvenCustomers),
      breakEvenMonthlyPrice,
      priceHeadroom: breakEvenMonthlyPrice === null ? null : money(n(input.monthlyPrice) - breakEvenMonthlyPrice),
      contributionPerCustomer: money(contributionPerCustomer)
    },
    risks,
    assumptionAudit: auditAssumptions('product', input),
    disclaimer:'These are deterministic what-if calculations. Customer demand and churn are unverified assumptions, not forecasts.'
  };
}
