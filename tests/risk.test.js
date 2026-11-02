import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeQuote,analyzeProduct} from '../src/lib/risk.js';

test('quote known cost and stress scenario are computed, not invented',()=>{
 const x=analyzeQuote({quotePrice:8000,materialCost:3400,shippingCost:0,laborCost:1700,subcontractCost:500,overheadCost:400,extraHours:20,hourlyRate:75,materialInflationPct:10});
 assert.equal(x.baseCost,6000); assert.equal(x.baseProfit,2000);
 assert.equal(x.addedCost,1840);assert.equal(x.stressedProfit,160);
 assert.equal(x.breakEvenPrice,7840);
 assert.ok(x.risks.some(r=>r.title==='Stress margin below review threshold'));
});
test('underpriced quote triggers negative profit',()=>{
 const x=analyzeQuote({quotePrice:1000,materialCost:900,shippingCost:0,laborCost:100,subcontractCost:100,overheadCost:0,extraHours:2,hourlyRate:100,materialInflationPct:10});
 assert.ok(x.stressedProfit<0); assert.ok(x.risks.some(r=>r.severity==='high'));
});
test('product scenarios six months are not fixed LLM forecasts',()=>{
 const x=analyzeProduct({monthlyPrice:29,activeCustomers:120,newCustomers:30,churnPct:8,costPerCustomer:5,fixedCost:900,marketingSpend:700});
 assert.equal(x.scenarios.length,3);assert.equal(x.scenarios[0].months.length,6);
 assert.ok(x.scenarios.every(s=>Number.isFinite(s.monthSixProfit)));
});
test('does not assume unknown costs are zero',()=>{
 assert.throws(()=>analyzeQuote({quotePrice:1000,materialCost:'',shippingCost:0,laborCost:0,subcontractCost:0,overheadCost:0,extraHours:0,hourlyRate:0,materialInflationPct:0}),/materialCost/);
});
test('quote decision gate and break-even buffer are deterministic',()=>{
 const x=analyzeQuote({quotePrice:8000,materialCost:3400,shippingCost:0,laborCost:1700,subcontractCost:500,overheadCost:400,extraHours:20,hourlyRate:75,materialInflationPct:10});
 assert.equal(x.decisionGate.status,'review');
 assert.equal(x.decisionGate.targetQuotePrice,9223.53);
 assert.equal(x.decisionGate.additionalPriceNeeded,1223.53);
 assert.equal(x.resilience.extraHoursToBreakEven,2.13);
 assert.equal(x.resilience.extraInflationPointsToBreakEven,4.71);
 assert.equal(x.resilience.mostSensitive,'labor');
});
test('loss-making stress case triggers renegotiation gate',()=>{
 const x=analyzeQuote({quotePrice:7000,materialCost:3400,shippingCost:0,laborCost:1700,subcontractCost:500,overheadCost:400,extraHours:20,hourlyRate:75,materialInflationPct:10});
 assert.equal(x.decisionGate.status,'renegotiate');
 assert.equal(x.resilience.mostSensitive,'already_loss_making');
 assert.equal(x.resilience.extraHoursToBreakEven,null);
});
test('product analysis reports break-even customers and month-six price',()=>{
 const x=analyzeProduct({monthlyPrice:29,activeCustomers:120,newCustomers:30,churnPct:8,costPerCustomer:5,fixedCost:900,marketingSpend:700});
 assert.equal(x.resilience.breakEvenCustomers,66.67);
 assert.ok(x.resilience.breakEvenMonthlyPrice > 0);
 assert.ok(x.resilience.customersAboveBreakEven > 0);
 assert.equal(x.decisionGate.status,'pilot');
});

test('assumption audit flags shipping mentioned in notes but priced at zero',()=>{
 const x=analyzeQuote({quotePrice:8000,materialCost:3400,shippingCost:0,laborCost:1700,subcontractCost:500,overheadCost:400,extraHours:20,hourlyRate:75,materialInflationPct:10,details:'Supplier quote excludes shipping and delivery; customer requests weekend work.'});
 assert.ok(x.assumptionAudit.some(flag=>flag.title.includes('Shipping or delivery')));
 assert.ok(x.assumptionAudit.some(flag=>flag.title.includes('Schedule or quality')));
});
test('product assumption audit flags acquisition and operations not separately modeled',()=>{
 const x=analyzeProduct({monthlyPrice:29,activeCustomers:10,newCustomers:5,churnPct:5,costPerCustomer:5,fixedCost:100,marketingSpend:0,details:'Includes customer onboarding and payment processing.'});
 assert.equal(x.assumptionAudit.length,3);
 assert.ok(x.assumptionAudit.some(flag=>flag.title.includes('existing active customer base')));
});

test('product decision gate catches negative six-month payback even if month six turns positive',()=>{
 const x=analyzeProduct({monthlyPrice:100,activeCustomers:0,newCustomers:1,churnPct:0,costPerCustomer:1,fixedCost:400,marketingSpend:0,details:''});
 assert.ok(x.resilience.monthSixProfit > 0);
 assert.ok(x.resilience.sixMonthCumulativeProfit < 0);
 assert.equal(x.decisionGate.title,'Check payback before scaling');
});
