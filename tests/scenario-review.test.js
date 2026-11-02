import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDecision, decisionModeConfig } from '../src/lib/decision-modes.js';
import { runDecisionStressScenario, runQuoteStressScenario, runProductStressScenario } from '../src/lib/agent-tools.js';
import { launchFromZero, extendSubscription, reviewAgentScenarios } from '../src/lib/scenario-review.js';

const product = {monthlyPrice:29,activeCustomers:120,newCustomers:30,churnPct:8,costPerCustomer:5,fixedCost:900,marketingSpend:700};
const quote = {quotePrice:8000,materialCost:3400,shippingCost:0,laborCost:1700,subcontractCost:500,overheadCost:400,extraHours:20,hourlyRate:75,materialInflationPct:10};

const traceOf = result => ({label:result.label,assumptions:result.assumptions,results:result.results});

test('promotion-only fulfillment increase preserves the current-price baseline', () => {
 const input = decisionModeConfig.discount.example;
 const run = runDecisionStressScenario('discount',input,{label:'Promo fulfillment',demandMultiplier:1,costMultiplier:1.15,costScope:'promotion_only',priceMultiplier:1,alternativeCostMultiplier:1});
 assert.equal(run.results.cards[0].value,4500);
 assert.equal(run.results.cards[2].value,21.75);
 assert.equal(run.results.cards[3].value,2718.75);
 assert.equal(run.results.metrics[0].value,207);
 assert.equal(run.results.metrics[3].value,-1781.25);
 assert.equal(run.assumptions.adjustedInputs.unitCost,55);
 assert.equal(run.assumptions.adjustedInputs.discountedUnitCost,63.24999999999999);
});

test('old all-cost discount behavior remains available and explicitly labeled', () => {
 const input=decisionModeConfig.discount.example;
 const run=runDecisionStressScenario('discount',input,{label:'All costs',demandMultiplier:1,costMultiplier:1.15,priceMultiplier:1,alternativeCostMultiplier:1});
 assert.equal(run.assumptions.costScope,'all');
 assert.equal(run.results.cards[0].value,3675);
 assert.equal(run.results.metrics[0].value,169);
});

test('branch fixed-only overrun does not silently increase setup and variable cost',()=>{
 const input=decisionModeConfig.branch.example;
 const run=runDecisionStressScenario('branch',input,{label:'Fixed cost overrun',demandMultiplier:1,costMultiplier:1.2,costScope:'fixed',priceMultiplier:1,alternativeCostMultiplier:1});
 assert.equal(run.results.cards[1].value,21600);
 assert.equal(run.results.cards[4].value,-32300);
 assert.equal(run.assumptions.adjustedInputs.setupCost,input.setupCost);
 assert.equal(run.assumptions.adjustedInputs.variableCostPerSale,input.variableCostPerSale);
});

test('unsupported cost scopes are rejected rather than ignored',()=>{
 assert.throws(()=>runDecisionStressScenario('inventory',decisionModeConfig.inventory.example,{label:'Invalid scope',demandMultiplier:1,costMultiplier:1.2,costScope:'fixed',priceMultiplier:1,alternativeCostMultiplier:1}),/not valid/);
});

test('product starting with zero customers has a different six-month result and early deficit',()=>{
 const zero=launchFromZero(product);
 assert.equal(zero.existingCustomers,120);
 assert.equal(zero.monthSixProfit,1942.8);
 assert.equal(zero.sixMonthCumulativeProfit,3657.74);
 assert.equal(zero.maxOperatingGap,1097.6);
 assert.equal(zero.monthsWithOperatingLoss,2);
 assert.equal(launchFromZero({...product,activeCustomers:0}),null);
});

test('product agent downside can turn monthly negative before cumulative turns negative',()=>{
 const run=runProductStressScenario(product,{label:'Weak pull + onboarding burden',newCustomersMultiplier:0.4,churnMultiplier:2,variableCostMultiplier:2,priceMultiplier:1,fixedCostMultiplier:1.3});
 const review=reviewAgentScenarios('product',product,[traceOf(run)])[0];
 assert.equal(review.status,'critical');
 assert.equal(review.metrics[0].value,-144.64);
 assert.equal(review.metrics[1].value,241.86);
 assert.equal(review.metrics[2].value,8);
 const extended=extendSubscription(product,{newCustomers:12,churnPct:16,costPerCustomer:10,fixedCost:1170});
 assert.equal(extended.firstNegativeMonthly,4);
 assert.equal(extended.firstNegativeCumulativeAfterSix,8);
});

test('quote agent scenario reprices 15% target from the simulated break-even cost',()=>{
 const run=runQuoteStressScenario(quote,{label:'Unpriced delivery + inspection',additionalLaborHours:0,additionalMaterialInflationPct:0,additionalShippingCost:450,additionalFixedCost:250});
 const review=reviewAgentScenarios('quote',quote,[traceOf(run)])[0];
 assert.equal(review.status,'critical');
 assert.equal(review.metrics[0].value,-540);
 assert.equal(review.metrics[1].value,8540);
 assert.equal(review.metrics[2].value,10047.06);
 assert.equal(review.metrics[3].value,2047.06);
});

test('branch scenario review flags compounding of demand and downside drop',()=>{
 const input=decisionModeConfig.branch.example;
 const run=runDecisionStressScenario('branch',input,{label:'Slow ramp',demandMultiplier:0.7,costMultiplier:1,priceMultiplier:1,alternativeCostMultiplier:1});
 const review=reviewAgentScenarios('branch',input,[traceOf(run)])[0];
 assert.equal(review.metrics[0].value,-37250);
 assert.ok(review.warnings.some(x=>x.includes('compound stress')));
 assert.ok(review.changes.some(x=>x.field==='expectedSalesPerMonth'));
});

test('branch labels net downside loss rather than calling it cash investment at risk',()=>{
 const result=analyzeDecision('branch',decisionModeConfig.branch.example);
 assert.equal(result.metrics[4].label,'Modeled downside net loss incl. setup');
 assert.equal(result.metrics[4].value,21500);
});


test('ad ROI exposes cost per acquired order and needed conversion',()=>{
 const result=analyzeDecision('ads',decisionModeConfig.ads.example);
 const get=label=>result.metrics.find(m=>m.label===label)?.value;
 assert.equal(get('Modeled ad cost per acquired order'),50);
 assert.equal(get('Maximum ad cost per order at break-even'),40);
 assert.equal(get('Conversion required at implied lead volume'),6.25);
});
