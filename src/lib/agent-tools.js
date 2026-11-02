import { analyzeProduct } from './risk.js';
import { analyzeDecision } from './decision-modes.js';

const num = (value, name) => {
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0) {
    throw new Error(`${name} must be a finite non-negative number.`);
  }
  return result;
};

const bounded = (value, name, min, max) => {
  const result = Number(value);
  if (!Number.isFinite(result) || result < min || result > max) {
    throw new Error(`${name} must be between ${min} and ${max}.`);
  }
  return result;
};

const labelOf = value => {
  if (typeof value !== 'string' || !value.trim()) return 'Agent stress scenario';
  return value.trim().slice(0, 90);
};

const money = value => Math.round(value * 100) / 100;
const pct = (profit, price) => price > 0 ? money((profit / price) * 100) : 0;

export function runQuoteStressScenario(input, args) {
  const label = labelOf(args.label);
  const quotePrice = num(input.quotePrice, 'quotePrice');
  const materialCost = num(input.materialCost, 'materialCost');
  const shippingCost = num(input.shippingCost, 'shippingCost');
  const laborCost = num(input.laborCost, 'laborCost');
  const subcontractCost = num(input.subcontractCost, 'subcontractCost');
  const overheadCost = num(input.overheadCost, 'overheadCost');
  const existingExtraHours = num(input.extraHours, 'extraHours');
  const hourlyRate = num(input.hourlyRate, 'hourlyRate');
  const existingInflationPct = num(input.materialInflationPct, 'materialInflationPct');
  const additionalLaborHours = bounded(args.additionalLaborHours, 'additionalLaborHours', 0, 80);
  const additionalMaterialInflationPct = bounded(args.additionalMaterialInflationPct, 'additionalMaterialInflationPct', 0, 100);
  const additionalShippingCost = bounded(args.additionalShippingCost ?? 0, 'additionalShippingCost', 0, 50000);
  const additionalFixedCost = bounded(args.additionalFixedCost, 'additionalFixedCost', 0, 50000);

  if (quotePrice <= 0) throw new Error('Quote price must be greater than zero.');

  const baseCost = materialCost + shippingCost + laborCost + subcontractCost + overheadCost;
  const baselineProfit = quotePrice - baseCost;
  const totalExtraHours = existingExtraHours + additionalLaborHours;
  const totalMaterialInflationPct = existingInflationPct + additionalMaterialInflationPct;
  const extraLaborCost = totalExtraHours * hourlyRate;
  const materialInflationCost = materialCost * totalMaterialInflationPct / 100;
  const totalDownsideCost = extraLaborCost + materialInflationCost + additionalShippingCost + additionalFixedCost;
  const stressedProfit = baselineProfit - totalDownsideCost;

  return {
    tool: 'run_quote_stress_scenario',
    label,
    assumptions: {
      additionalLaborHours,
      totalStressLaborHours: totalExtraHours,
      additionalMaterialInflationPct,
      totalMaterialInflationPct,
      additionalShippingCost,
      additionalFixedCost
    },
    results: {
      quotePrice: money(quotePrice),
      shippingCost: money(shippingCost),
      baselineCost: money(baseCost),
      baselineProfit: money(baselineProfit),
      baselineMarginPct: pct(baselineProfit, quotePrice),
      extraLaborCost: money(extraLaborCost),
      materialInflationCost: money(materialInflationCost),
      additionalShippingCost: money(additionalShippingCost),
      additionalFixedCost: money(additionalFixedCost),
      totalDownsideCost: money(totalDownsideCost),
      stressedProfit: money(stressedProfit),
      stressedMarginPct: pct(stressedProfit, quotePrice),
      breakEvenQuotePrice: money(baseCost + totalDownsideCost)
    },
    interpretation: 'Deterministic what-if calculation. Additional costs are scenario assumptions, not verified expenses or probability estimates.'
  };
}

export function runProductStressScenario(input, args) {
  const label = labelOf(args.label);
  const newCustomersMultiplier = bounded(args.newCustomersMultiplier, 'newCustomersMultiplier', 0, 1.5);
  const churnMultiplier = bounded(args.churnMultiplier, 'churnMultiplier', 1, 3);
  const variableCostMultiplier = bounded(args.variableCostMultiplier, 'variableCostMultiplier', 1, 3);
  const priceMultiplier = bounded(args.priceMultiplier, 'priceMultiplier', 0.5, 1.2);
  const fixedCostMultiplier = bounded(args.fixedCostMultiplier, 'fixedCostMultiplier', 1, 2);

  const adjusted = {
    ...input,
    newCustomers: num(input.newCustomers, 'newCustomers') * newCustomersMultiplier,
    churnPct: Math.min(100, num(input.churnPct, 'churnPct') * churnMultiplier),
    costPerCustomer: num(input.costPerCustomer, 'costPerCustomer') * variableCostMultiplier,
    monthlyPrice: num(input.monthlyPrice, 'monthlyPrice') * priceMultiplier,
    fixedCost: num(input.fixedCost, 'fixedCost') * fixedCostMultiplier
  };
  const analysis = analyzeProduct(adjusted);
  const scenario = analysis.scenarios[0];
  const monthSix = scenario.months[5];

  return {
    tool: 'run_product_stress_scenario',
    label,
    assumptions: {
      newCustomersMultiplier,
      churnMultiplier,
      variableCostMultiplier,
      priceMultiplier,
      fixedCostMultiplier,
      adjustedNewCustomersPerMonth: money(adjusted.newCustomers),
      adjustedMonthlyChurnPct: money(adjusted.churnPct),
      adjustedMonthlyPrice: money(adjusted.monthlyPrice),
      adjustedVariableCostPerCustomer: money(adjusted.costPerCustomer),
      adjustedFixedCost: money(adjusted.fixedCost)
    },
    results: {
      monthSixCustomers: monthSix.customers,
      monthSixRevenue: monthSix.revenue,
      monthSixExpenses: monthSix.expenses,
      monthSixProfit: monthSix.profit,
      sixMonthCumulativeProfit: scenario.profitSixMonths
    },
    interpretation: 'Deterministic six-month what-if simulation. It is not a demand forecast and does not assign probabilities to the scenario.'
  };
}


const DECISION_MODES = new Set(['hire', 'inventory', 'discount', 'ads', 'service', 'branch']);

export function runDecisionStressScenario(mode, input, args) {
  if (!DECISION_MODES.has(mode)) throw new Error(`Unsupported decision stress mode: ${mode}`);
  const label = labelOf(args.label);
  const demandMultiplier = bounded(args.demandMultiplier, 'demandMultiplier', 0, 1.5);
  const costMultiplier = bounded(args.costMultiplier, 'costMultiplier', 1, 2);
  const priceMultiplier = bounded(args.priceMultiplier, 'priceMultiplier', 0.5, 1.2);
  const alternativeCostMultiplier = bounded(args.alternativeCostMultiplier, 'alternativeCostMultiplier', 0.5, 1.5);
  const salvageMultiplier = bounded(args.salvageMultiplier ?? 1, 'salvageMultiplier', 0, 1);
  const costScope = args.costScope ?? 'all';
  const allowedCostScopes = {
    hire: ['all'], inventory: ['all'],
    discount: ['all','promotion_only'], ads: ['all','ad_spend','variable'],
    service: ['all','setup','fixed','variable'],
    branch: ['all','setup','fixed','variable']
  };
  if (!allowedCostScopes[mode].includes(costScope)) throw new Error(`costScope ${costScope} is not valid for ${mode}.`);
  const adjusted = { ...input };
  const multiply = (keys, factor) => keys.forEach(key => { adjusted[key] = num(adjusted[key], key) * factor; });

  if (mode === 'hire') {
    multiply(['projectHoursNeeded'], demandMultiplier);
    adjusted.projectHoursNeeded = Math.max(0.5, adjusted.projectHoursNeeded);
    multiply(['monthlySalary','monthlyToolsCost','hiringSetupCost','employeeReworkCost'], costMultiplier);
    multiply(['subcontractorQuote','subcontractorManagementCost','subcontractorReworkCost'], alternativeCostMultiplier);
  } else if (mode === 'inventory') {
    multiply(['expectedSalesUnits'], demandMultiplier);
    adjusted.expectedSalesUnits = Math.floor(adjusted.expectedSalesUnits + 1e-9);
    multiply(['salvageValuePerUnsoldUnit'], salvageMultiplier);
    multiply(['bulkUnitCost','bulkShippingCost','holdingCostPerUnsoldUnit'], costMultiplier);
    multiply(['smallUnitCost','smallShippingCost'], alternativeCostMultiplier);
    multiply(['sellingPrice'], priceMultiplier);
  } else if (mode === 'discount') {
    multiply(['expectedSalesAfterDiscount'], demandMultiplier);
    if (costScope === 'promotion_only') adjusted.discountedUnitCost = num(input.unitCost, 'unitCost') * costMultiplier;
    else multiply(['unitCost'], costMultiplier);
    multiply(['currentPrice'], priceMultiplier);
  } else if (mode === 'ads') {
    multiply(['expectedOrdersFromAds'], demandMultiplier);
    if (costScope === 'all' || costScope === 'ad_spend') multiply(['adSpend'], costMultiplier);
    if (costScope === 'all' || costScope === 'variable') multiply(['variableCostPerOrder'], costMultiplier);
    multiply(['averageOrderRevenue'], priceMultiplier);
  } else if (mode === 'service') {
    multiply(['expectedClientsPerMonth'], demandMultiplier);
    if (costScope === 'all' || costScope === 'setup') multiply(['setupInvestment'], costMultiplier);
    if (costScope === 'all' || costScope === 'fixed') multiply(['monthlyFixedCost'], costMultiplier);
    if (costScope === 'all' || costScope === 'variable') multiply(['variableCostPerClient'], costMultiplier);
    multiply(['pricePerClient'], priceMultiplier);
  } else if (mode === 'branch') {
    multiply(['expectedSalesPerMonth'], demandMultiplier);
    if (costScope === 'all' || costScope === 'setup') multiply(['setupCost'], costMultiplier);
    if (costScope === 'all' || costScope === 'fixed') multiply(['monthlyRent','monthlyPayroll','monthlyUtilities','monthlyOtherFixedCost'], costMultiplier);
    if (costScope === 'all' || costScope === 'variable') multiply(['variableCostPerSale'], costMultiplier);
    multiply(['averageSaleValue'], priceMultiplier);
  }

  const analysis = analyzeDecision(mode, adjusted);
  return {
    tool: 'run_decision_stress_scenario',
    label,
    assumptions: { mode, demandMultiplier, costMultiplier, costScope, priceMultiplier, alternativeCostMultiplier, salvageMultiplier, adjustedInputs: adjusted },
    results: {
      cards: analysis.cards,
      metrics: analysis.metrics,
      decisionGate: analysis.decisionGate,
      risks: analysis.risks
    },
    interpretation: `Deterministic what-if using explicitly adjusted inputs. Cost scope: ${costScope}. This is hypothetical, not observed data or a probability estimate.`
  };
}

export function getAgentTools(mode) {
  if (mode === 'quote') {
    return [{
      type: 'function',
      function: {
        name: 'run_quote_stress_scenario',
        description: 'Run an auditable quote downside simulation. Test a plausible combination of additional labor hours, material inflation, explicitly omitted shipping/delivery cost, and other omitted fixed costs. If the context says shipping/delivery is excluded, model it as additionalShippingCost rather than hiding it in additionalFixedCost. Any added amount is a hypothetical assumption, not a fact. The original quote price and entered baseline costs cannot be changed.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            label: { type: 'string', description: 'Short human-readable name for the scenario', maxLength: 90 },
            additionalLaborHours: { type: 'number', minimum: 0, maximum: 80, description: 'Extra labor hours beyond the user-entered stress case' },
            additionalMaterialInflationPct: { type: 'number', minimum: 0, maximum: 100, description: 'Additional percentage points of material price increase beyond the user-entered assumption' },
            additionalShippingCost: { type: 'number', minimum: 0, maximum: 50000, description: 'Hypothetical shipping/delivery cost not already included in the entered shipping, material, or subcontract line items; use when context says delivery is excluded' },
            additionalFixedCost: { type: 'number', minimum: 0, maximum: 50000, description: 'Illustrative additional fixed cost, only if a plausible omitted cost is suggested by the case context' }
          },
          required: ['label', 'additionalLaborHours', 'additionalMaterialInflationPct', 'additionalShippingCost', 'additionalFixedCost']
        }
      }
    }];
  }

  if (mode === 'product') {
    return [{
      type: 'function',
      function: {
        name: 'run_product_stress_scenario',
        description: 'Run an auditable six-month product-launch downside simulation. Challenge the user assumptions by changing customer acquisition, churn, variable cost, price, and fixed costs within bounded ranges. Do not present the chosen scenario as a forecast or claim its parameters are observed facts.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            label: { type: 'string', description: 'Short human-readable name for the scenario', maxLength: 90 },
            newCustomersMultiplier: { type: 'number', minimum: 0, maximum: 1.5, description: 'Multiplier applied to planned new customers per month; 0.5 means half the plan' },
            churnMultiplier: { type: 'number', minimum: 1, maximum: 3, description: 'Multiplier applied to monthly churn; 2 means double the user-entered churn' },
            variableCostMultiplier: { type: 'number', minimum: 1, maximum: 3, description: 'Multiplier applied to variable cost per customer' },
            priceMultiplier: { type: 'number', minimum: 0.5, maximum: 1.2, description: 'Multiplier applied to monthly price; 0.9 means a 10 percent lower price' },
            fixedCostMultiplier: { type: 'number', minimum: 1, maximum: 2, description: 'Multiplier applied to fixed monthly costs' }
          },
          required: ['label', 'newCustomersMultiplier', 'churnMultiplier', 'variableCostMultiplier', 'priceMultiplier', 'fixedCostMultiplier']
        }
      }
    }];
  }
  if (DECISION_MODES.has(mode)) {
    return [{
      type: 'function',
      function: {
        name: 'run_decision_stress_scenario',
        description: `Run a deterministic downside simulation for ${mode}. demandMultiplier changes expected demand/workload, priceMultiplier changes selling price, alternativeCostMultiplier changes the alternative where applicable. costMultiplier uses costScope: all (default) changes every relevant cost; branch/service accept setup, fixed, variable; discount accepts promotion_only to increase ONLY promotional variable cost while preserving regular-price costs; ads accepts ad_spend or variable. If the scenario says fixed-cost overrun, set costScope=fixed. If promotion fulfillment rises, set costScope=promotion_only. For inventory, salvageMultiplier tests unverified liquidation proceeds. Always disclose ALL changed assumptions; hypothetical, not forecasts.`,
        parameters: {
          type: 'object', additionalProperties: false,
          properties: {
            label: { type: 'string', description: 'Short name for the scenario', maxLength: 90 },
            demandMultiplier: { type: 'number', minimum: 0, maximum: 1.5, description: '0.7 means 30% less expected demand or workload' },
            costMultiplier: { type: 'number', minimum: 1, maximum: 2, description: '1.2 means 20% higher main costs' },
            priceMultiplier: { type: 'number', minimum: 0.5, maximum: 1.2, description: '0.9 means 10% lower selling price or average order value' },
            alternativeCostMultiplier: { type: 'number', minimum: 0.5, maximum: 1.5, description: 'Changes the comparison option cost for hire and inventory decisions; otherwise has no effect' },
            salvageMultiplier: { type: 'number', minimum: 0, maximum: 1, description: 'Inventory only: 0 removes assumed unsold-unit salvage recovery, 0.5 halves it; other modes ignore this factor. Default 1.' },
            costScope: { type: 'string', enum: ['all','setup','fixed','variable','promotion_only','ad_spend'], description: 'Optional, defaults to all. For branch/service: setup, fixed or variable. For discount: promotion_only isolates added promotional unit cost. For ads: ad_spend or variable. For hire/inventory: all only.' }
          },
          required: ['label','demandMultiplier','costMultiplier','priceMultiplier','alternativeCostMultiplier']
        }
      }
    }];
  }
  return [];
}

export function executeAgentTool(mode, input, name, args) {
  if (mode === 'quote' && name === 'run_quote_stress_scenario') return runQuoteStressScenario(input, args);
  if (mode === 'product' && name === 'run_product_stress_scenario') return runProductStressScenario(input, args);
  if (DECISION_MODES.has(mode) && name === 'run_decision_stress_scenario') return runDecisionStressScenario(mode, input, args);
  throw new Error(`Tool ${name} is not allowed for mode ${mode}.`);
}
