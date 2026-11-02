import test from 'node:test';
import assert from 'node:assert/strict';
import { executeAgentTool, runProductStressScenario, runQuoteStressScenario } from '../src/lib/agent-tools.js';

const quote = {
  quotePrice: 8000,
  materialCost: 3400,
  shippingCost: 0,
  laborCost: 1700,
  subcontractCost: 500,
  overheadCost: 400,
  extraHours: 20,
  hourlyRate: 75,
  materialInflationPct: 10
};

const product = {
  monthlyPrice: 29,
  activeCustomers: 120,
  newCustomers: 30,
  churnPct: 8,
  costPerCustomer: 5,
  fixedCost: 900,
  marketingSpend: 700
};

test('quote agent tool returns auditable downside math', () => {
  const result = runQuoteStressScenario(quote, {
    label: 'Shipping and overtime',
    additionalLaborHours: 8,
    additionalMaterialInflationPct: 5,
    additionalShippingCost: 0,
    additionalFixedCost: 300
  });
  assert.equal(result.results.baselineProfit, 2000);
  assert.equal(result.results.extraLaborCost, 2100);
  assert.equal(result.results.materialInflationCost, 510);
  assert.equal(result.results.totalDownsideCost, 2910);
  assert.equal(result.results.stressedProfit, -910);
  assert.match(result.interpretation, /not verified expenses/);
});

test('product agent tool changes assumptions and calculates a six-month scenario', () => {
  const result = runProductStressScenario(product, {
    label: 'Acquisition slowdown',
    newCustomersMultiplier: 0.5,
    churnMultiplier: 2,
    variableCostMultiplier: 1.25,
    priceMultiplier: 1,
    fixedCostMultiplier: 1.1
  });
  assert.equal(result.assumptions.adjustedNewCustomersPerMonth, 15);
  assert.equal(result.assumptions.adjustedMonthlyChurnPct, 16);
  assert.ok(Number.isFinite(result.results.monthSixProfit));
  assert.ok(Number.isFinite(result.results.sixMonthCumulativeProfit));
});

test('agent tools reject out-of-range scenarios', () => {
  assert.throws(() => runQuoteStressScenario(quote, {
    label: 'Invalid', additionalLaborHours: 999, additionalMaterialInflationPct: 0, additionalShippingCost: 0, additionalFixedCost: 0
  }), /between 0 and 80/);
  assert.throws(() => runProductStressScenario(product, {
    label: 'Invalid', newCustomersMultiplier: 0.5, churnMultiplier: 8, variableCostMultiplier: 1,
    priceMultiplier: 1, fixedCostMultiplier: 1
  }), /between 1 and 3/);
});

test('a tool cannot be invoked in the wrong mode', () => {
  assert.throws(() => executeAgentTool('product', product, 'run_quote_stress_scenario', {}), /not allowed/);
});
test('explicit shipping is included in the baseline and break-even quote', () => {
  const result = runQuoteStressScenario({ ...quote, shippingCost: 300, extraHours: 0, materialInflationPct: 0 }, {
    label: 'Shipping included',
    additionalLaborHours: 0,
    additionalMaterialInflationPct: 0,
    additionalShippingCost: 0,
    additionalFixedCost: 0
  });
  assert.equal(result.results.baselineCost, 6300);
  assert.equal(result.results.breakEvenQuotePrice, 6300);
  assert.equal(result.results.shippingCost, 300);
});

test('agent models excluded shipping as a separate downside cost', () => {
  const result = runQuoteStressScenario({ ...quote, extraHours: 0, materialInflationPct: 0 }, {
    label: 'Freight excluded',
    additionalLaborHours: 0,
    additionalMaterialInflationPct: 0,
    additionalShippingCost: 450,
    additionalFixedCost: 0
  });
  assert.equal(result.assumptions.additionalShippingCost, 450);
  assert.equal(result.results.totalDownsideCost, 450);
  assert.equal(result.results.stressedProfit, 1550);
});

import { runDecisionStressScenario, getAgentTools } from '../src/lib/agent-tools.js';
import { decisionModeConfig } from '../src/lib/decision-modes.js';

test('new decision modes expose a bounded deterministic simulation tool', () => {
  for (const mode of Object.keys(decisionModeConfig)) {
    assert.equal(getAgentTools(mode)[0].function.name, 'run_decision_stress_scenario');
    const result = runDecisionStressScenario(mode, decisionModeConfig[mode].example, {
      label: 'Demand down and costs up', demandMultiplier: 0.7, costMultiplier: 1.2,
      priceMultiplier: 1, alternativeCostMultiplier: 1.1
    });
    assert.ok(result.results.decisionGate.title);
    assert.ok(Array.isArray(result.results.cards));
    assert.equal(result.assumptions.demandMultiplier, 0.7);
  }
});

test('decision stress tool rejects an unbounded multiplier', () => {
  assert.throws(() => runDecisionStressScenario('ads', decisionModeConfig.ads.example, {
    label: 'Bad scenario', demandMultiplier: 3, costMultiplier: 1, priceMultiplier: 1, alternativeCostMultiplier: 1
  }), /between 0 and 1.5/);
});

test('inventory agent can remove assumed salvage recovery and keeps demand integer',()=>{
  const input=decisionModeConfig.inventory.example;
  const result=runDecisionStressScenario('inventory',input,{
    label:'No salvage buyer and weaker demand',demandMultiplier:0.73,costMultiplier:1,
    priceMultiplier:1,alternativeCostMultiplier:1,salvageMultiplier:0
  });
  assert.equal(result.assumptions.adjustedInputs.expectedSalesUnits,160);
  assert.equal(result.assumptions.adjustedInputs.salvageValuePerUnsoldUnit,0);
  assert.equal(result.results.cards[0].value,-3210);
  assert.equal(result.results.cards[1].value,820);
  assert.equal(result.assumptions.salvageMultiplier,0);
});
