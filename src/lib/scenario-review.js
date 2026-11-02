// Post-agent decision review. All numbers are derived from the deterministic
// tool trace, not from the LLM's unverified narrative.
import { analyzeProduct } from './risk.js';

const money = x => Math.round(x * 100) / 100;
const centsUp = x => Math.ceil((x - 1e-9) * 100) / 100;
const wholeUp = x => Math.ceil(x - 1e-9);

export function launchFromZero(input) {
  const active = Number(input.activeCustomers);
  if (!Number.isFinite(active) || active <= 0) return null;
  const model = analyzeProduct({ ...input, activeCustomers: 0 });
  const months = model.scenarios[0].months;
  let cumulative = 0;
  let maxOperatingGap = 0;
  for (const month of months) {
    cumulative += month.profit;
    maxOperatingGap = Math.max(maxOperatingGap, -cumulative);
  }
  return {
    existingCustomers: active,
    monthSixProfit: model.scenarios[0].monthSixProfit,
    sixMonthCumulativeProfit: model.scenarios[0].profitSixMonths,
    maxOperatingGap: money(maxOperatingGap),
    monthsWithOperatingLoss: months.filter(month => month.profit < 0).length
  };
}

// A continuation of the exact subscription assumptions. This is not a
// prediction or a claim about cash balance, and it excludes startup costs.
export function extendSubscription(input, adjusted, horizon = 12) {
  const data = { ...input, ...adjusted };
  let active = Number(data.activeCustomers);
  let cumulative = 0;
  let firstNegativeMonthly = null;
  let firstNegativeCumulativeAfterSix = null;
  const monthly = [];
  for (let month = 1; month <= horizon; month++) {
    active = active * (1 - Number(data.churnPct) / 100) + Number(data.newCustomers);
    const profit = active * (Number(data.monthlyPrice) - Number(data.costPerCustomer)) - Number(data.fixedCost) - Number(data.marketingSpend);
    cumulative += profit;
    if (profit < 0 && firstNegativeMonthly === null) firstNegativeMonthly = month;
    if (month > 6 && cumulative < 0 && firstNegativeCumulativeAfterSix === null) firstNegativeCumulativeAfterSix = month;
    monthly.push({ month, active: money(active), profit: money(profit), cumulative: money(cumulative) });
  }
  return { monthly, firstNegativeMonthly, firstNegativeCumulativeAfterSix };
}

export function changedScenarioInputs(input, adjusted) {
  if (!adjusted || typeof adjusted !== 'object') return [];
  return Object.keys(adjusted)
    .filter(key => Number.isFinite(Number(adjusted[key])) && Number.isFinite(Number(input[key])) && input[key] !== '' && input[key] != null && Math.abs(Number(adjusted[key]) - Number(input[key])) > 1e-8)
    .map(key => ({ field: key, before: Number(input[key]), after: money(Number(adjusted[key])) }));
}

export function reviewAgentScenarios(mode, input, traces = []) {
  return traces.map(trace => {
    const r = trace.results || {};
    const a = trace.assumptions || {};
    const output = {
      label: trace.label,
      status: 'review',
      headline: 'Check the simulated assumptions before committing',
      detail: '',
      metrics: [],
      changes: [],
      costScope: a.costScope || null,
      warnings: []
    };

    if (mode === 'quote') {
      const price = Number(input.quotePrice);
      const stressedProfit = Number(r.stressedProfit);
      const breakEven = Number(r.breakEvenQuotePrice);
      if (Number.isFinite(stressedProfit) && Number.isFinite(breakEven)) {
        const target = centsUp(breakEven / 0.85);
        output.status = stressedProfit < 0 ? 'critical' : 'review';
        output.headline = stressedProfit < 0 ? 'The AI-tested scenario turns this quote into a loss' : 'The quote needs a new margin check under this scenario';
        output.metrics = [
          { label: 'Stressed profit', value: money(stressedProfit), unit: 'money' },
          { label: 'New break-even quote', value: money(breakEven), unit: 'money' },
          { label: 'Quote for illustrative 15% margin', value: target, unit: 'money' },
          { label: 'Increase vs original quote', value: money(Math.max(0, target - price)), unit: 'money' }
        ];
        output.detail = 'Repriced from the deterministic agent scenario, not the original stress case. Buyer acceptance and cost evidence are unverified.';
      }
    } else if (mode === 'product') {
      const monthProfit = Number(r.monthSixProfit);
      const cumulative = Number(r.sixMonthCumulativeProfit);
      const adjusted = {
        newCustomers: a.adjustedNewCustomersPerMonth,
        churnPct: a.adjustedMonthlyChurnPct,
        monthlyPrice: a.adjustedMonthlyPrice,
        costPerCustomer: a.adjustedVariableCostPerCustomer,
        fixedCost: a.adjustedFixedCost
      };
      const extended = extendSubscription(input, adjusted);
      output.status = monthProfit < 0 ? 'critical' : 'review';
      output.headline = monthProfit < 0 ? 'Monthly operations are losing money by month six' : 'Check retention and acquisition before scaling';
      output.metrics = [
        { label: 'Month-six operating profit', value: money(monthProfit), unit: 'money' },
        { label: 'Six-month cumulative operating profit', value: money(cumulative), unit: 'money' }
      ];
      if (extended.firstNegativeCumulativeAfterSix !== null) {
        output.metrics.push({ label: 'Cumulative result turns negative if assumptions persist', value: extended.firstNegativeCumulativeAfterSix, unit: 'month' });
      }
      output.detail = 'A positive six-month total does not make a negative month-six run rate sustainable. Month 7–12 is an extrapolation using unchanged assumptions, not a forecast.';
      output.changes = Object.entries(adjusted)
        .filter(([k,v])=>Number.isFinite(Number(v)) && Math.abs(Number(v)-Number(input[k]))>1e-8)
        .map(([k,v])=>({field:k,before:Number(input[k]),after:money(Number(v))}));
    } else if (mode !== 'quote') {
      const cards = r.cards || [];
      const gate = r.decisionGate || {};
      const metric = (index) => Number(cards[index]?.value);
      output.changes = changedScenarioInputs(input, a.adjustedInputs);
      if (mode === 'discount' && a.costScope === 'promotion_only' && a.adjustedInputs?.discountedUnitCost != null) {
        output.changes.push({field:'discountedUnitCost (promotion only)',before:Number(input.unitCost),after:money(Number(a.adjustedInputs.discountedUnitCost))});
      }
      if (mode === 'discount') {
        const change = Number(r.metrics?.[3]?.value);
        output.status = change < 0 ? 'critical' : 'review';
        output.headline = change < 0 ? 'The promotion reduces contribution in this scenario' : 'The promotion needs a demand check';
        output.metrics = [
          {label:'Contribution change vs current price',value:change,unit:'money'},
          {label:'Units needed to preserve contribution',value:r.metrics?.[0]?.value,unit:'count'}
        ];
        if (a.costScope === 'promotion_only') output.warnings.push('Promotional unit cost changed; full-price unit cost remains unchanged.');
      } else if (mode === 'branch') {
        const loss = metric(4);
        output.status = loss < 0 ? 'critical' : 'review';
        output.headline = loss < 0 ? 'The branch fails the downside period test' : 'Verify branch sales and opening costs';
        output.metrics = [
          {label:'Downside result including setup',value:loss,unit:'money'},
          {label:'Monthly operating result in downside',value:metric(3),unit:'money'}
        ];
        if (Number(a.demandMultiplier) < 1 && Number(input.downsideSalesDropPct) > 0) {
          output.warnings.push(`The ${money((1-Number(a.demandMultiplier))*100)}% reduction in base transactions is followed by the already-entered ${input.downsideSalesDropPct}% downside decline. Both apply; this is a compound stress, not just one drop.`);
        }
        output.warnings.push('The modeled net loss is not the same as required cash reserves. Opening delays, working capital and financing are not modeled.');
      } else if (mode === 'service') {
        const period = metric(2);
        output.status = period < 0 ? 'critical' : 'review';
        output.headline = period < 0 ? 'The setup investment is not recovered in this scenario' : 'Check customer volume before committing setup';
        output.metrics = [{label:'Profit after setup over evaluation period',value:period,unit:'money'}];
        const v = a.adjustedInputs || input;
        const contribution = Number(v.pricePerClient)-Number(v.variableCostPerClient);
        if (contribution > 0 && Number(v.evaluationMonths)>0) {
          output.metrics.push({label:'Clients/month to recover setup in period',value:wholeUp((Number(v.monthlyFixedCost)+Number(v.setupInvestment)/Number(v.evaluationMonths))/contribution),unit:'count'});
        }
      } else if (mode === 'ads') {
        const profit = metric(3);
        output.status = profit < 0 ? 'critical' : 'review';
        output.headline = profit < 0 ? 'Campaign contribution remains negative' : 'Check incremental orders and attribution';
        output.metrics = [{label:'Contribution after ad spend',value:profit,unit:'money'}];
      } else if (mode === 'inventory') {
        const bulk = metric(0), small = metric(1);
        output.status = Math.max(bulk,small) < 0 ? 'critical' : 'review';
        output.headline = bulk > small ? 'Large batch wins in this scenario' : 'Small batch wins in this scenario';
        output.metrics = [
          {label:'Large-batch modeled profit',value:bulk,unit:'money'},
          {label:'Small-batch modeled profit',value:small,unit:'money'},
          {label:'Demand where large batch first beats small',value:r.metrics?.find(m=>m.label==='Demand where bulk first beats small')?.value,unit:'count'}
        ];
      } else if (mode === 'hire') {
        output.headline = gate.title || 'Compare the same scope and full-period cash';
        output.metrics = [
          {label:'Employee full-period cash cost',value:metric(2),unit:'money'},
          {label:'Subcontractor total cost',value:metric(1),unit:'money'}
        ];
        output.metrics.push({label:'Subcontractor all-in cost that matches employee cash',value:metric(2),unit:'money'});
        output.warnings.push('Compare avoidable employee cash commitment with equivalent subcontract scope; allocated cost alone is not the cash decision.');
      }
      if (a.costScope === 'all' && Number(a.costMultiplier)>1 && ['branch','service','discount','ads'].includes(mode)) {
        output.warnings.push('The cost multiplier changes multiple cost lines. Check the exact changed inputs below.');
        if (/fixed[- ]cost|fixed cost/i.test(trace.label)) output.warnings.push('Scenario name says fixed costs, but the actual simulation also changes other costs. Treat the full changed-input list as authoritative.');
        if (mode==='discount' && /fulfillment|promo cost/i.test(trace.label)) output.warnings.push('The scenario name suggests promotion-only costs, but the full-price comparator also changed. Use promotion_only cost scope for a fair comparison.');
      }
    }
    return output;
  });
}
