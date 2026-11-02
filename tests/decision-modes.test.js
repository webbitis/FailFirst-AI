import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDecision, decisionModeConfig } from '../src/lib/decision-modes.js';

for (const [mode, config] of Object.entries(decisionModeConfig)) {
  test(`${mode} decision module returns deterministic cards and a decision gate`, () => {
    const result = analyzeDecision(mode, config.example);
    assert.equal(result.kind, mode);
    assert.ok(Array.isArray(result.cards) && result.cards.length >= 3);
    assert.ok(Array.isArray(result.metrics) && result.metrics.length >= 2);
    assert.ok(result.decisionGate.title);
    assert.ok(Array.isArray(result.risks));
    assert.ok(result.cards.every(item => item.value === null || Number.isFinite(item.value)));
  });
}

test('hire vs subcontract compares allocated cost and flags insufficient capacity', () => {
  const result = analyzeDecision('hire', {
    ...decisionModeConfig.hire.example,
    productiveHoursPerMonth: 40,
    projectHoursNeeded: 80,
    periodMonths: 1
  });
  assert.equal(result.decisionGate.status, 'rework');
  assert.ok(result.risks.some(item => item.title.includes('capacity')));
});

test('inventory model includes unsold stock exposure and small-batch stockout risk', () => {
  const result = analyzeDecision('inventory', decisionModeConfig.inventory.example);
  assert.equal(result.cards[0].value, -220);
  assert.equal(result.cards[1].value, 820);
  assert.equal(result.cards[3].value, 120);
  assert.ok(result.risks.some(item => item.title.includes('unsold inventory')));
  assert.ok(result.risks.some(item => item.title.includes('stock out')));
});

test('discount calculator identifies impossible unit economics', () => {
  const result = analyzeDecision('discount', {
    ...decisionModeConfig.discount.example,
    currentPrice: 100,
    unitCost: 90,
    discountPct: 15,
    expectedSalesAfterDiscount: 300
  });
  assert.equal(result.cards[2].value, -5);
  assert.equal(result.metrics[0].value, null);
  assert.equal(result.decisionGate.status, 'rework');
});

test('ad calculator returns required orders and leads from contribution and conversion', () => {
  const result = analyzeDecision('ads', decisionModeConfig.ads.example);
  assert.equal(result.cards[1].value, 25);
  assert.equal(result.metrics[0].value, 400);
  assert.equal(result.metrics[1].value, 500);
  assert.equal(result.cards[3].value, -200);
});

test('new service calculator accounts for setup investment in period result', () => {
  const result = analyzeDecision('service', decisionModeConfig.service.example);
  assert.equal(result.cards[2].value, 1900);
  assert.equal(result.metrics[0].value, 2);
});

test('branch calculator reports required turnover and downside loss', () => {
  const result = analyzeDecision('branch', decisionModeConfig.branch.example);
  assert.equal(result.cards[1].value, 18000);
  assert.equal(result.cards[3].value, -250);
  assert.equal(result.cards[4].value, -21500);
});

test('invalid percent assumptions are rejected', () => {
  assert.throws(() => analyzeDecision('branch', { ...decisionModeConfig.branch.example, downsideSalesDropPct: 101 }), /cannot exceed 100/);
  assert.throws(() => analyzeDecision('discount', { ...decisionModeConfig.discount.example, discountPct: 100 }), /less than 100/);
});

test('inventory differentiates bulk break-even from the actual decision flip point', () => {
  const input=decisionModeConfig.inventory.example;
  const result=analyzeDecision('inventory',input);
  assert.equal(result.metrics.find(m=>m.label==='Large-batch break-even sales').value,231);
  assert.equal(result.comparison.bulkWinningDemand,269);
  assert.equal(result.metrics.find(m=>m.label==='Demand where bulk first beats small').value,269);
  assert.match(result.decisionGate.reason,/269 units of demand, not at its own break-even of 231/);
  const at268=analyzeDecision('inventory',{...input,expectedSalesUnits:268});
  const at269=analyzeDecision('inventory',{...input,expectedSalesUnits:269});
  assert.ok(at268.cards[0].value < at268.cards[1].value);
  assert.ok(at269.cards[0].value > at269.cards[1].value);
});

test('inventory never fabricates a bulk-win threshold if no demand can make bulk better', () => {
  const input={...decisionModeConfig.inventory.example,bulkShippingCost:10000};
  const result=analyzeDecision('inventory',input);
  assert.equal(result.comparison.bulkWinningDemand,null);
  assert.match(result.decisionGate.reason,/No modeled demand/);
});

test('inventory flags assumed salvage proceeds and rejects fractional demand', () => {
  const input=decisionModeConfig.inventory.example;
  const result=analyzeDecision('inventory',input);
  assert.ok(result.assumptionAudit.some(f=>f.title.includes('recovery is not confirmed')));
  assert.throws(()=>analyzeDecision('inventory',{...input,expectedSalesUnits:20.5}),/whole units/);
});
