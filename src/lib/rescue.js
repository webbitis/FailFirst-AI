// Decision Rescue Engine: reversible, deterministic what-if edits.
// These are numerical thresholds, not promises that the business can achieve them.
import { analyzeDecision } from './decision-modes.js';
import { analyzeProduct, analyzeQuote } from './risk.js';

const number = (input, key) => Number(input[key] ?? 0);
const centsUp = value => Math.ceil((value - 1e-9) * 100) / 100;
const centsDown = value => Math.floor((value + 1e-9) * 100) / 100;
const wholeUp = value => Math.ceil(value - 1e-9);
const money = value => Math.round(value * 100) / 100;
const calc = (mode, input) => mode === 'quote' ? analyzeQuote(input) : mode === 'product' ? analyzeProduct(input) : analyzeDecision(mode, input);

function score(mode, input, result) {
  if (mode === 'quote') return { label:'Stressed profit', value:result.stressedProfit };
  if (mode === 'product') return { label:'Six-month cumulative profit', value:result.resilience.sixMonthCumulativeProfit };
  if (mode === 'ads') return { label:'Contribution after ad spend', value:result.cards[3].value };
  if (mode === 'discount') return { label:'Contribution change vs current price', value:result.metrics[3].value };
  if (mode === 'service') return { label:'Profit after setup in evaluation period', value:result.cards[2].value };
  if (mode === 'branch') return { label:'Downside result after setup', value:result.cards[4].value };
  if (mode === 'inventory') return { label:'Best modeled batch profit', value:Math.max(result.cards[0].value,result.cards[1].value) };
  if (mode === 'hire') {
    const revenue = input.projectRevenue === '' || input.projectRevenue == null ? null : number(input,'projectRevenue');
    return { label:'Profit using lower full-period delivery cost', value:revenue===null?null:money(revenue-Math.min(result.cards[1].value,result.cards[2].value)) };
  }
  return {label:'Modeled outcome',value:null};
}

export function getRescueOptions(mode, input, result=calc(mode,input)) {
  const options=[];
  const original = score(mode,input,result);
  function offer(id,title,description,changes,evidence,comparison=null) {
    if (!changes || Object.keys(changes).length===0) return;
    if (Object.entries(changes).every(([k,v])=>Math.abs(Number(input[k])-v)<1e-8)) return;
    if (Object.values(changes).some(v=>!Number.isFinite(v)||v<0)) return;
    try {
      const next = {...input,...changes};
      const revised=calc(mode,next);
      const after=score(mode,next,revised);
      if (original.value!==null && after.value!==null && after.value<original.value-0.005) return;
      const compared=comparison?.(result,revised);
      options.push({id,title,description,changes,metricLabel:compared?.label??original.label,before:compared?.before??original.value,after:compared?.after??after.value,evidence});
    } catch { /* Omit a proposed scenario if its edited inputs do not validate. */ }
  }

  if (mode==='ads') {
    const spend=number(input,'adSpend'), orders=number(input,'expectedOrdersFromAds');
    const cost=number(input,'variableCostPerOrder'), revenue=number(input,'averageOrderRevenue');
    const contribution=revenue-cost;
    if (contribution>0 && orders*contribution<spend) {
      offer('ads-orders','Win enough additional orders',`Reach ${wholeUp(spend/contribution)} incremental paid orders at the entered contribution per order.`,{expectedOrdersFromAds:wholeUp(spend/contribution)},'Validate order attribution and conversion with a capped campaign test.');
      if (orders>0) {
        const cap=centsDown(orders*contribution);
        if(cap>0) offer('ads-cap','Cap the ad budget',`Spend no more than $${cap.toFixed(2)} if the expected ${orders} incremental orders are realistic.`,{adSpend:cap},'Check whether a smaller budget can still deliver the same order volume; it may not.');
        const target=centsUp(cost+spend/orders);
        offer('ads-value','Increase contribution per order',`Raise average order revenue to at least $${target.toFixed(2)} without increasing variable cost.`,{averageOrderRevenue:target},'Test a bundle or upsell; higher prices may reduce orders.');
      }
    } else if (contribution<=0 && orders>0) {
      const target=centsUp(cost+spend/orders);
      offer('ads-margin','Fix unit economics first',`At ${orders} orders, average order revenue must reach at least $${target.toFixed(2)}.`,{averageOrderRevenue:target},'Check achievable price and fully loaded variable cost.');
    }
  }

  if (mode==='discount') {
    const price=number(input,'currentPrice'), cost=number(input,'unitCost'), units=number(input,'currentSalesUnits');
    const disc=number(input,'discountPct'), expected=number(input,'expectedSalesAfterDiscount');
    const baseline=units*(price-cost), afterMargin=price*(1-disc/100)-cost;
    if (baseline>=0 && expected*afterMargin<baseline) {
      if (afterMargin>0) offer('discount-volume','Prove a larger sales uplift',`To preserve current contribution, sell at least ${wholeUp(baseline/afterMargin)} units after discount.`,{expectedSalesAfterDiscount:wholeUp(baseline/afterMargin)},'This is a demand scenario, not a forecast. Test with a limited audience.');
      if (expected>0 && price>0) {
        const requiredPrice=cost+baseline/expected;
        const maxDiscount=100*(1-requiredPrice/price);
        if (maxDiscount>=0 && maxDiscount<disc) offer('discount-rate','Reduce the discount',`At ${expected} sales, discount must be no more than ${centsDown(maxDiscount).toFixed(2)}%.`,{discountPct:centsDown(maxDiscount)},'Verify whether the smaller discount can produce the entered volume.');
      }
    }
  }

  if (mode==='service') {
    const months=number(input,'evaluationMonths'), fixed=number(input,'monthlyFixedCost');
    const setup=number(input,'setupInvestment'), clients=number(input,'expectedClientsPerMonth');
    const price=number(input,'pricePerClient'), cost=number(input,'variableCostPerClient');
    const contribution=price-cost;
    if (months>0 && clients*contribution*months-fixed*months-setup<0) {
      if (contribution>0) offer('service-clients','Reach the break-even client volume',`At least ${wholeUp((setup/months+fixed)/contribution)} clients per month are needed to recover setup within ${months} months.`,{expectedClientsPerMonth:wholeUp((setup/months+fixed)/contribution)},'Validate with paid pilots or signed commitments, not assumed demand.');
      if (clients>0) {
        const target=centsUp(cost+(fixed+setup/months)/clients);
        offer('service-price','Reprice the service',`At ${clients} clients per month, charge at least $${target.toFixed(2)} per client.`,{pricePerClient:target},'Check market willingness to pay and full delivery scope.');
      }
    }
  }

  if (mode==='branch') {
    const months=number(input,'evaluationMonths'), setup=number(input,'setupCost');
    const fixed=['monthlyRent','monthlyPayroll','monthlyUtilities','monthlyOtherFixedCost'].reduce((s,k)=>s+number(input,k),0);
    const sales=number(input,'expectedSalesPerMonth'), retained=1-number(input,'downsideSalesDropPct')/100;
    const price=number(input,'averageSaleValue'), cost=number(input,'variableCostPerSale');
    const contribution=price-cost;
    if (months>0 && (sales*retained*contribution-fixed)*months-setup<0) {
      if (retained>0 && contribution>0) offer('branch-volume','Prove enough monthly transactions',`To cover fixed costs and opening investment even in the entered downside, target ${wholeUp((fixed+setup/months)/(retained*contribution))} base-case transactions per month.`,{expectedSalesPerMonth:wholeUp((fixed+setup/months)/(retained*contribution))},'Validate foot traffic, transaction volume and ramp-up before signing a lease.');
      if (retained>0 && sales>0) {
        const target=centsUp(cost+(fixed+setup/months)/(retained*sales));
        offer('branch-basket','Increase contribution per sale',`At ${sales} base-case sales, average basket must reach $${target.toFixed(2)} with the entered variable cost.`,{averageSaleValue:target},'Higher basket value may reduce transactions. Test with comparable stores.');
      }
    }
  }

  if (mode==='quote') {
    const price=number(input,'quotePrice'), target=result.decisionGate.targetQuotePrice;
    if (result.stressMarginPct<15 && target>price) offer('quote-price','Renegotiate the quoted price',`To reach the illustrative 15% stress margin, quote at least $${centsUp(target).toFixed(2)}.`,{quotePrice:centsUp(target)},'Confirm the buyer accepts the price; the 15% target is illustrative, not a universal rule.');
  }

  if (mode==='product') {
    if (result.resilience.sixMonthCumulativeProfit<0) {
      const current=number(input,'monthlyPrice');
      let low=current,high=Math.max(1,current);
      for(let i=0;i<40&&calc(mode,{...input,monthlyPrice:high}).resilience.sixMonthCumulativeProfit<0;i++) high*=2;
      if (high<1e8) {
        for(let i=0;i<50;i++) {
          const mid=(low+high)/2;
          if(calc(mode,{...input,monthlyPrice:mid}).resilience.sixMonthCumulativeProfit>=0) high=mid;
          else low=mid;
        }
        offer('product-price','Test a subscription price that recovers six-month losses',`Price must be approximately $${centsUp(high).toFixed(2)} per month under the entered customer and churn assumptions.`,{monthlyPrice:centsUp(high+0.0001)},'Validate willingness to pay, acquisition and retention with real customers.');
      }
    }
  }

  if (mode==='hire') {
    const revenue=input.projectRevenue==null||input.projectRevenue===''?null:number(input,'projectRevenue');
    const fullEmployee=result.cards[2].value,subcontract=result.cards[1].value;
    const cheapest=Math.min(fullEmployee,subcontract);
    if (revenue!==null && revenue<cheapest) offer('hire-reprice','Reprice the client project',`Project revenue must be at least $${centsUp(cheapest).toFixed(2)} to cover the cheaper full-period delivery option.`,{projectRevenue:centsUp(cheapest)},'Confirm the scope and whether employee capacity can be used for other paid work.');
  }

  if (mode==='inventory') {
    const bulk=result.cards[0].value,small=result.cards[1].value;
    const flip=result.comparison?.bulkWinningDemand;
    if (flip!==null && Number.isInteger(flip) && flip>number(input,'expectedSalesUnits') && small>=bulk) {
      offer('inventory-flip','Find the demand that changes the winner',`At ${flip} units of demand, the large batch first outperforms the small batch under unchanged selling price, costs and salvage assumptions. This is different from bulk merely breaking even.`,{expectedSalesUnits:flip},'Prove the higher demand with paid pre-orders or credible sell-through evidence; do not raise a forecast to justify a larger order.',(before,after)=>({label:'Bulk profit minus small-batch profit',before:money(before.cards[0].value-before.cards[1].value),after:money(after.cards[0].value-after.cards[1].value)}));
    }
    if (Math.max(bulk,small)<0) {
      const q=number(input,'smallQuantity'),cost=number(input,'smallUnitCost'),ship=number(input,'smallShippingCost');
      const price=number(input,'sellingPrice'),salvage=number(input,'salvageValuePerUnsoldUnit'),hold=number(input,'holdingCostPerUnsoldUnit');
      const denominator=price-salvage+hold;
      if (denominator>0) {
        const threshold=wholeUp((q*cost+ship+q*hold-q*salvage)/denominator);
        if (threshold<=q && threshold>number(input,'expectedSalesUnits')) offer('inventory-demand','Validate enough sales before ordering',`Small batch requires at least ${threshold} paid sales in the period to break even under the entered salvage assumptions.`,{expectedSalesUnits:threshold},'Do not change a demand estimate without pre-orders or sales evidence.');
      }
    }
  }
  return options.slice(0,3);
}
