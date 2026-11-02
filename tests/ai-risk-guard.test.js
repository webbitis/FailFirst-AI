import test from 'node:test';
import assert from 'node:assert/strict';
import { adMathReference, guardAiRisks } from '../src/lib/ai-risk-guard.js';
import { decisionModeConfig } from '../src/lib/decision-modes.js';

const example = decisionModeConfig.ads.example;

test('ad math separates expected leads from break-even leads', () => {
  const facts = adMathReference(example);
  assert.equal(facts.expectedLeads, 400);
  assert.equal(facts.breakEvenLeads, 500);
  assert.equal(facts.expectedOrders, 20);
  assert.equal(facts.breakEvenOrders, 25);
  assert.equal(facts.expectedCostPerAcquiredOrder, 50);
  assert.equal(facts.maxBreakEvenCostPerAcquiredOrder, 40);
});

test('observed Meta lead conversion mismatch is replaced by verified facts', () => {
  const risks = [{
    title: '500 leads at 5% may not convert to incremental paid orders',
    rationale: 'Model needs 500 leads at entered 5% conversion to get 20 orders, but these are not measured.',
    test: 'Track conversion from 500 leads to paid orders.',
    evidence_status: 'inference',
    simulation_reference: ''
  }];
  const { risks: cleaned, notes } = guardAiRisks('ads', example, risks);
  assert.equal(notes.length, 1);
  assert.match(cleaned[0].rationale, /20 expected orders imply 400 leads/);
  assert.match(cleaned[0].rationale, /25 break-even orders imply 500 leads/);
  assert.doesNotMatch(cleaned[0].rationale, /500 leads.*20 orders/);
});

test('pilot loss-case pacing is not presented as the break-even rule', () => {
  const risks = [{
    title: '30% order shortfall',
    rationale: 'A 30% shortfall would mean 14 orders and a loss.',
    test: 'Pre-commit kill-rule: if first $300 of spend paces below 4.2 attributable orders, pause before spending remaining.',
    evidence_status: 'calculated_scenario',
    simulation_reference: 'Demand shortfall'
  }];
  const { risks: cleaned, notes } = guardAiRisks('ads', example, risks);
  assert.equal(notes.length, 1);
  assert.match(cleaned[0].test, /at least 8 incremental paid orders/);
  assert.doesNotMatch(cleaned[0].test, /4\.2 attributable/);
  assert.equal(cleaned[0].simulation_reference, 'Demand shortfall');
});

test('guard scales to different ad economics', () => {
  const input = { ...example, adSpend: 600, averageOrderRevenue: 150, variableCostPerOrder: 100, expectedOrdersFromAds: 8, leadToCustomerConversionPct: 4 };
  const facts = adMathReference(input);
  assert.equal(facts.expectedLeads, 200);
  assert.equal(facts.breakEvenOrders, 12);
  assert.equal(facts.breakEvenLeads, 300);
  const { risks: cleaned } = guardAiRisks('ads', input, [{title: 'Conversion', rationale: 'We need 300 leads at 4% conversion to get 8 orders', test: 'Track leads and orders.'}]);
  assert.match(cleaned[0].rationale, /8 expected orders imply 200 leads/);
  assert.match(cleaned[0].rationale, /12 break-even orders imply 300 leads/);
});

test('guard leaves unrelated decision mode risks unchanged', () => {
  const original = [{title:'Quote needs rework', rationale:'Review delivery cost', test:'Ask supplier'}];
  const result = guardAiRisks('quote', {}, original);
  assert.equal(result.risks, original);
  assert.deepEqual(result.notes, []);
});

test('zero conversion is handled without claiming a finite lead count', () => {
  const input = { ...example, leadToCustomerConversionPct: 0 };
  const facts = adMathReference(input);
  assert.equal(facts.expectedLeads, null);
  assert.equal(facts.breakEvenLeads, null);
  const result = guardAiRisks('ads', input, [{title:'Leads and conversion', rationale:'500 leads at 0% conversion to get 20 orders', test:'Check leads and orders'}]);
  assert.match(result.risks[0].rationale, /does not support a finite/);
});


test('correct cost-stress scenario with 1340 leads for 67 orders is preserved', () => {
  const risks = [{
    title: 'Cost +20% and AOV -10% reduces contribution',
    rationale: 'The model needs 67 orders and 1340 leads at 5% conversion, while 20 orders yield a loss.',
    test: 'Validate cost and AOV using real orders.',
    evidence_status: 'calculated_scenario',
    simulation_reference: 'Margin squeeze'
  }];
  const result = guardAiRisks('ads', example, risks);
  assert.equal(result.notes.length, 0);
  assert.deepEqual(result.risks, risks);
});
