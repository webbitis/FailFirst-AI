import test from 'node:test';
import assert from 'node:assert/strict';
import {getRescueOptions} from '../src/lib/rescue.js';
import {analyzeDecision,decisionModeConfig} from '../src/lib/decision-modes.js';
import {analyzeQuote,analyzeProduct} from '../src/lib/risk.js';

const options = (mode, input) => getRescueOptions(mode,input);
const tryOption = (mode, input, option) => {
  const revised={...input,...option.changes};
  return mode==='quote'?analyzeQuote(revised):mode==='product'?analyzeProduct(revised):analyzeDecision(mode,revised);
};

test('ad rescue proposes three exact break-even alternatives',()=>{
  const input=decisionModeConfig.ads.example;
  const list=options('ads',input);
  assert.equal(list.length,3);
  assert.deepEqual(list.map(item=>item.id),['ads-orders','ads-cap','ads-value']);
  assert.equal(list[0].changes.expectedOrdersFromAds,25);
  assert.equal(list[1].changes.adSpend,800);
  assert.equal(list[2].changes.averageOrderRevenue,110);
  for(const option of list) assert.ok(tryOption('ads',input,option).cards[3].value>=0);
});

test('discount rescue preserves current contribution with volume or lower discount',()=>{
  const input=decisionModeConfig.discount.example;
  const list=options('discount',input);
  assert.equal(list.length,2);
  assert.equal(list[0].changes.expectedSalesAfterDiscount,150);
  assert.equal(list[1].changes.discountPct,9);
  for(const option of list) assert.ok(tryOption('discount',input,option).metrics[3].value>=0);
});

test('service rescue includes setup investment in its thresholds',()=>{
  const input={...decisionModeConfig.service.example,expectedClientsPerMonth:1};
  const list=options('service',input);
  assert.equal(list.length,2);
  for(const option of list) assert.ok(tryOption('service',input,option).cards[2].value>=0);
});

test('branch rescue targets downside including opening cost',()=>{
  const input=decisionModeConfig.branch.example;
  const list=options('branch',input);
  assert.equal(list.length,2);
  for(const option of list) assert.ok(tryOption('branch',input,option).cards[4].value>=0);
});

test('quote rescue meets illustrative stress margin target',()=>{
  const input={quotePrice:8000,materialCost:3400,shippingCost:0,laborCost:1700,subcontractCost:500,overheadCost:400,extraHours:20,hourlyRate:75,materialInflationPct:10};
  const list=options('quote',input);
  assert.equal(list.length,1);
  assert.ok(tryOption('quote',input,list[0]).stressMarginPct>=15);
});

test('subscription rescue makes six-month cumulative result nonnegative',()=>{
  const input={monthlyPrice:9,activeCustomers:10,newCustomers:2,churnPct:10,costPerCustomer:5,fixedCost:900,marketingSpend:700};
  const list=options('product',input);
  assert.equal(list.length,1);
  assert.ok(tryOption('product',input,list[0]).resilience.sixMonthCumulativeProfit>=0);
});

test('hire mode now compares revenue and warns when both options lose money',()=>{
  const input={...decisionModeConfig.hire.example,projectRevenue:2000};
  const result=analyzeDecision('hire',input);
  assert.ok(result.cards.some(c=>c.label.includes('profit')));
  assert.ok(result.risks.some(r=>r.title.includes('Neither delivery option')));
  const list=options('hire',input);
  assert.equal(list.length,1);
  assert.ok(list[0].after>=0);
});

test('hire missing revenue is flagged rather than treated as zero',()=>{
  const input={...decisionModeConfig.hire.example};
  delete input.projectRevenue;
  const result=analyzeDecision('hire',input);
  assert.ok(result.assumptionAudit.some(r=>r.title.includes('revenue')));
  assert.equal(result.cards.find(c=>c.label==='Employee cash-basis project profit').value,null);
  assert.equal(options('hire',input).length,0);
});

test('unusually high salvage value triggers explicit review even when profit is positive',()=>{
  const input={...decisionModeConfig.inventory.example,expectedSalesUnits:0,salvageValuePerUnsoldUnit:40};
  const result=analyzeDecision('inventory',input);
  assert.ok(result.cards[0].value>0);
  assert.equal(result.decisionGate.status,'review');
  assert.ok(result.assumptionAudit.some(r=>r.severity==='high'&&r.title.includes('Recoverable')));
});

test('no rescue is fabricated when entered economics are already sufficient',()=>{
  const input={...decisionModeConfig.ads.example,expectedOrdersFromAds:50};
  assert.deepEqual(options('ads',input),[]);
});

test('zero conversion is flagged without guessing lead requirements',()=>{
  const input={...decisionModeConfig.ads.example,leadToCustomerConversionPct:0};
  const result=analyzeDecision('ads',input);
  assert.ok(result.assumptionAudit.some(r=>r.title.includes('zero lead conversion')));
  assert.equal(result.metrics[0].value,null);
});

test('inventory rescue finds the demand at which bulk beats small, not merely break-even',()=>{
  const input=decisionModeConfig.inventory.example;
  const list=options('inventory',input);
  const flip=list.find(item=>item.id==='inventory-flip');
  assert.ok(flip);
  assert.equal(flip.changes.expectedSalesUnits,269);
  assert.equal(flip.before,-1040);
  assert.equal(flip.after,13.5);
  const revised=tryOption('inventory',input,flip);
  assert.ok(revised.cards[0].value>revised.cards[1].value);
});
