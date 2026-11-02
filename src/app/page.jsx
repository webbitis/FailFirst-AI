'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {analyzeProduct,analyzeQuote} from '../lib/risk.js';
import {analyzeDecision,decisionModeConfig} from '../lib/decision-modes.js';
import {getRescueOptions} from '../lib/rescue.js';
import {launchFromZero,reviewAgentScenarios} from '../lib/scenario-review.js';

const quoteExample = {business:'AC installation quote for a small office',quotePrice:8000,materialCost:3400,shippingCost:0,laborCost:1700,subcontractCost:500,overheadCost:400,extraHours:20,hourlyRate:75,materialInflationPct:10,details:'Two HVAC units, install and basic inspection. Customer requests work finished over a weekend. Supplier quote excludes shipping and delivery.'};
const productExample = {business:'AI menu SaaS for independent restaurants',monthlyPrice:29,activeCustomers:120,newCustomers:30,churnPct:8,costPerCustomer:5,fixedCost:900,marketingSpend:700,details:'Targets US restaurant owners. Assumes monthly customer acquisition through Instagram ads and zero cost for merchant onboarding.'};
const quoteFields = [
 ['quotePrice','Quoted price ($)'],['materialCost','Materials ($)'],['shippingCost','Shipping / delivery ($)'],['laborCost','Labor ($)'],['subcontractCost','Subcontractors ($)'],['overheadCost','Overhead ($)'],['extraHours','Extra labor hours (stress)'],['hourlyRate','Hourly cost ($)'],['materialInflationPct','Material price increase (%)']
];
const productFields = [
 ['monthlyPrice','Subscription / customer / month ($)'],['activeCustomers','Current active customers'],['newCustomers','New customers / month'],['churnPct','Monthly churn (%)'],['costPerCustomer','Monthly variable cost / customer ($)'],['fixedCost','Monthly fixed cost ($)'],['marketingSpend','Marketing spend / month ($)']
];
const modeList = [
 {id:'quote',number:'01',label:'Quote / contract'},
 {id:'product',number:'02',label:'Subscription launch'},
 {id:'hire',number:'03',label:decisionModeConfig.hire.short},
 {id:'inventory',number:'04',label:decisionModeConfig.inventory.short},
 {id:'discount',number:'05',label:decisionModeConfig.discount.short},
 {id:'ads',number:'06',label:decisionModeConfig.ads.short},
 {id:'service',number:'07',label:decisionModeConfig.service.short},
 {id:'branch',number:'08',label:decisionModeConfig.branch.short}
];
const initialForms = {
 quote:quoteExample,
 product:productExample,
 ...Object.fromEntries(Object.entries(decisionModeConfig).map(([mode,config])=>[mode,{...config.example}]))
};
const fmt = x => x==null?'Not available':Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(x);
const fmtDecimal = x => x==null?'Not available':Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(x);
const fmtCount = x => x==null?'Not achievable at current unit economics':Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(x);
const colorFor = severity => severity==='high'?'critical':severity==='medium'?'moderate':'review';
function Field({name,label,value,update}) {return <label className="field"><span>{label}</span><input inputMode="decimal" type="number" min="0" step="any" value={value ?? ''} onChange={e=>update(name,e.target.value)}/></label>}
function Stat({label,value,warning}) {return <div className={`stat ${warning?'warning':''}`}><span>{label}</span><strong>{value}</strong></div>}
function DecisionGate({gate,afterMeta=false,children}) {return <div className={`decisionGate ${gate.status}`}><div className="decisionKicker">{afterMeta?'BASELINE DECISION GATE · BEFORE META':'DECISION GATE'}</div><strong className="decisionTitle">{gate.title}</strong><p>{gate.reason}</p>{children}</div>}
function displayMetric(item) {
 if(item.value==null) return 'Not available / not achievable';
 if(item.format==='money') return fmt(item.value);
 if(item.format==='percent') return `${fmtDecimal(item.value)}%`;
 if(item.format==='count') return fmtCount(item.value);
 if(item.format==='months') return `${fmtDecimal(item.value)} months`;
 if(item.format==='ratio') return `${fmtDecimal(item.value)}x`;
 return fmtDecimal(item.value);
}
function RescuePanel({options,apply,afterMeta=false}) {
 if (!options.length) return null;
 const flip=options.some(option=>option.id==='inventory-flip');
 return <section className="rescuePanel" aria-label="Decision Rescue scenarios">
  <div className="rescueKicker">{afterMeta?'BASELINE · ':''}{flip?'DECISION FLIP · DETERMINISTIC':'DECISION RESCUE · DETERMINISTIC'}</div>
  <h3>{flip?'What would change the better option?':'What would make this decision work?'}</h3>
  <p>{afterMeta?'These options recalculate the entered baseline, not the AI-tested downside. ':''}These are calculated what-if thresholds, not predicted sales or guaranteed fixes. Apply a scenario to recalculate every result.</p>
  <div className="rescueList">{options.map(option=><div className="rescueOption" key={option.id}>
   <div className="rescueTop"><strong>{option.title}</strong><span>{option.metricLabel}</span></div>
   <p>{option.description}</p>
   {option.before!==null&&option.after!==null&&<div className="rescueImpact"><span className={option.before<0?'negative':''}>{fmt(option.before)}</span><span aria-hidden="true">→</span><b className={option.after<0?'negative':'positive'}>{fmt(option.after)}</b></div>}
   <small><b>Reality check:</b> {option.evidence}</small>
   <button type="button" className="rescueApply" onClick={()=>apply(option)}>Try this scenario</button>
  </div>)}</div>
 </section>;
}
function QuoteImpactHero({reviews,baselineProfit,stressedProfit}) {
 // The highlighted scenario is the worst modeled stressed profit, not the most likely outcome.
 const candidates=reviews.filter(review=>review.metrics[0]?.label==='Stressed profit'&&Number.isFinite(review.metrics[0]?.value));
 if(!candidates.length)return null;
 const worst=candidates.reduce((a,b)=>b.metrics[0].value<a.metrics[0].value?b:a);
 const stress=worst.metrics[0].value;
 const target=worst.metrics.find(metric=>metric.label==='Quote for illustrative 15% margin')?.value;
 return <div className={`impactHero ${stress<0?'impactCritical':'impactReview'}`} aria-label="Before and after Meta stress test">
  <div className="impactEyebrow"><span>DECISION IMPACT · QUOTE / CONTRACT</span><span className="impactState">{stress<0?'ACTION NEEDED':'REVIEW SCENARIO'}</span></div>
  <h4>{stress<0?'A profitable-looking quote could become a loss.':'The quote changes under the AI-tested assumptions.'}</h4>
  <div className="impactSteps">
   <div className="impactStep"><span>Before stress</span><strong className={baselineProfit<0?'negative':'positive'}>{fmt(baselineProfit)}</strong><small>Original estimated profit</small></div>
   <div className="impactStep"><span>Entered stress</span><strong className={stressedProfit<0?'negative':'positive'}>{fmt(stressedProfit)}</strong><small>Your assumptions</small></div>
   <div className="impactStep impactFinal"><span>After Meta stress</span><strong className={stress<0?'negative':'positive'}>{fmt(stress)}</strong><small>Hypothetical scenario</small></div>
  </div>
  <div className="impactBottom"><div><span className="impactTargetLabel">Revised quote for illustrative 15% stress margin</span><strong>{target==null?'Not available':fmt(target)}</strong></div><div className="impactScenario"><span>Scenario tested</span><b>{worst.label}</b></div></div>
  <p className="impactDisclaimer">AI proposes a hypothetical risk. Deterministic code calculates its impact. This is not a prediction or a verified supplier cost.</p>
 </div>;
}
function ScenarioReviewPanel({reviews,mode,baselineProfit,stressedProfit}) {
 if(!reviews?.length)return null;
 const metricValue=(item)=>item.value==null?'Not achievable':item.unit==='money'?fmt(item.value):item.unit==='month'?`Month ${item.value}`:fmtDecimal(item.value);
 return <section className="scenarioReview" aria-label="Post-agent scenario decision review">
  <div className="rescueKicker">AFTER META · VERIFIED SCENARIO IMPACT</div>
  <h3>What changes after the stress test?</h3>
  <p>These decisions are based on the agent's deterministic what-if results. The assumptions are hypothetical, not observed costs, customers, or probabilities.</p>
  {mode==='quote'&&<QuoteImpactHero reviews={reviews} baselineProfit={baselineProfit} stressedProfit={stressedProfit}/>}
  <div className="scenarioReviewList">{reviews.map((review,i)=><article className={`scenarioReviewItem ${review.status}`} key={`${review.label}-${i}`}>
   <div className="scenarioReviewTop"><strong>{review.label}</strong><span>{review.status==='critical'?'NEEDS ACTION':'REVIEW'}</span></div>
   <h4>{review.headline}</h4>
   {review.metrics.length>0&&<div className="scenarioReviewMetrics">{review.metrics.map((metric,j)=><div key={`${metric.label}-${j}`}><span>{metric.label}</span><strong className={typeof metric.value==='number'&&metric.value<0?'negative':''}>{metricValue(metric)}</strong></div>)}</div>}
   {review.detail&&<p>{review.detail}</p>}
   {review.warnings.map((warning,j)=><p className="scenarioWarning" key={j}>{warning}</p>)}
   {review.changes.length>0&&<details><summary>Exactly what changed ({review.changes.length} inputs)</summary><ul>{review.changes.map((change,j)=><li key={`${change.field}-${j}`}>{change.field}: {fmtDecimal(change.before)} → {fmtDecimal(change.after)}</li>)}</ul></details>}
   {review.costScope&&<small>Cost scope: {review.costScope}</small>}
  </article>)}</div>
 </section>;
}
function LaunchZeroCheck({input}) {
 const zero=launchFromZero(input);
 if(!zero)return null;
 return <section className="launchZeroCheck" aria-label="Zero-customer launch comparison">
  <strong>Starting-customer check</strong>
  <p>The plan begins with <b>{fmtDecimal(zero.existingCustomers)} existing active customers</b>. A genuinely new product may start with zero. Keeping every other assumption unchanged:</p>
  <div className="thresholdGrid"><div className="threshold"><span>Six-month cumulative profit starting at 0</span><strong className={zero.sixMonthCumulativeProfit<0?'negative':'positive'}>{fmt(zero.sixMonthCumulativeProfit)}</strong></div><div className="threshold"><span>Maximum modeled operating deficit in first 6 months</span><strong>{fmt(zero.maxOperatingGap)}</strong></div></div>
  <small>Zero-start what-if only. Deficit excludes setup investment, taxes, financing and working capital. Set Current active customers to 0 to make it the actual baseline.</small>
 </section>;
}
function RiskSections({value,ai,aiHeadingRef}) {
 return <>
  <div className="minorHeading">Assumption audit <span>{value.assumptionAudit?.length||0}</span></div>
  {value.assumptionAudit?.length?value.assumptionAudit.map((flag,i)=><div className="risk" key={`audit-${i}`}><span className={`severity ${colorFor(flag.severity)}`}>{flag.severity}</span><div><strong>{flag.title}</strong><p>{flag.reason}</p><p className="test"><b>Check:</b> {flag.test}</p><small>Input review flag · not proof of an omitted cost or unverified demand</small></div></div>):<div className="aiEmpty">No built-in input-review flags. This does not mean all assumptions have been verified.</div>}
  <div className="minorHeading">Calculation-driven flags <span>{value.risks?.length||0}</span></div>
  {value.risks?.length?value.risks.map((r,i)=><div className="risk" key={`risk-${i}`}><span className={`severity ${colorFor(r.severity)}`}>{r.severity}</span><div><strong>{r.title}</strong><p>{r.reason}</p><p className="test"><b>Validate:</b> {r.test}</p><small>{r.basis}</small></div></div>):<p className="explain">No built-in rules triggered. This does not establish that the decision is risk-free.</p>}
  <div className="minorHeading" ref={aiHeadingRef}>Meta-discovered risk hypotheses {ai&&<span>{ai.risks.length}</span>}</div>
  {ai?.arithmeticGuardNotes?.length>0&&<p className="small"><b>Arithmetic consistency guard:</b> {ai.arithmeticGuardNotes.length} AI narrative item(s) clarified using deterministic financial calculations. Free-form AI prose is not independently verified in full.</p>}
  {ai?<div className="riskCards">{ai.risks.map((r,i)=><details className="aiRiskDisclosure" key={`ai-${i}`}>
   <summary><span className={`severity ${colorFor(r.priority)}`}>{r.priority}</span><span className="aiRiskSummary"><strong>{r.title}</strong><span className="riskPreview">{r.rationale}</span></span><span className="riskExpand" aria-hidden="true">+</span></summary>
   <div className="aiRiskBody"><p>{r.rationale}</p><p className="test"><b>Test:</b> {r.test}</p>{r.simulation_reference&&<p><b>Simulation:</b> {r.simulation_reference}</p>}<small>Evidence status: {r.evidence_status} · AI-generated hypothesis</small></div>
  </details>)}</div>:<div className="aiEmpty">AI suggestions have not been generated. Numeric scenarios above work without API access.</div>}
  {ai&&<><div className="minorHeading">Agent-run simulations <span>{ai.agentTrace?.length||0}</span></div>{ai.agentTrace?.length?ai.agentTrace.map((run,i)=><div className="simulationTrace" key={`${run.tool}-${i}`}><div className="traceTop"><strong>{run.label}</strong><span>Verified calculation</span></div><p>{run.summary}</p><details><summary>Assumptions and numbers</summary><pre>{JSON.stringify({assumptions:run.assumptions,results:run.results},null,2)}</pre></details></div>):<div className="aiEmpty">No deterministic simulation was run by the agent.</div>}<p className="small">Model: {ai.model}. Financial figures come from deterministic code; AI-generated risk hypotheses are not verified facts.</p></>}
 </>;
}
export default function Home(){
 const [mode,setMode]=useState('quote');
 const [forms,setForms]=useState(initialForms);
 const [ai,setAi]=useState(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const requestId=useRef(0);
 const pendingRequest=useRef(null);
 const postMetaRef=useRef(null);
 const aiHeadingRef=useRef(null);
 const cancelPending=()=>{
  requestId.current+=1;
  pendingRequest.current?.abort();
  pendingRequest.current=null;
  setLoading(false);
 };
 const input=forms[mode];
 const update=(k,v)=>{cancelPending();setForms(s=>({...s,[mode]:{...s[mode],[k]:v}}));setAi(null);setError('');};
 const result=useMemo(()=>{try {return {value:mode==='quote'?analyzeQuote(input):mode==='product'?analyzeProduct(input):analyzeDecision(mode,input)};}catch(e){return {error:e.message}}},[mode,input]);
 const rescueOptions=useMemo(()=>result.error?[]:getRescueOptions(mode,input,result.value),[mode,input,result]);
 const agentReviews=useMemo(()=>ai?.agentTrace?reviewAgentScenarios(mode,input,ai.agentTrace):[],[ai,mode,input]);
 useEffect(()=>{
  if(!ai)return;
  const target=agentReviews.length?postMetaRef.current:aiHeadingRef.current;
  const reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  target?.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'start'});
 },[ai,agentReviews]);
 const applyRescue=option=>{
  cancelPending();
  setForms(s=>({...s,[mode]:{...s[mode],...option.changes}}));
  setAi(null);setError('');
 };
 const evaluateAI=async()=>{
  if(result.error)return;
  cancelPending();
  const currentId=requestId.current;
  const controller=new AbortController();
  pendingRequest.current=controller;
  setLoading(true);setError('');setAi(null);
  try{
   const res=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,input}),signal:controller.signal});
   const data=await res.json();
   if(!res.ok)throw new Error(data.error||'Analysis failed');
   if(currentId===requestId.current)setAi(data);
  }catch(e){if(currentId===requestId.current&&e.name!=='AbortError')setError(e.message)}finally{if(currentId===requestId.current){setLoading(false);pendingRequest.current=null;}}
 };
 const reset=()=>{cancelPending();setForms(s=>({...s,[mode]:{...initialForms[mode]}}));setAi(null);setError('')};
 const fieldList=mode==='quote'?quoteFields:mode==='product'?productFields:decisionModeConfig[mode].fields;
 const title=mode==='quote'?'Proposed client quote':mode==='product'?'New product economics':decisionModeConfig[mode].title;
 const nameLabel=mode==='quote'?'Quote / contract name':mode==='product'?'Product idea':decisionModeConfig[mode].nameLabel;
 return <main>
  <header className="top"><div className="brand"><span className="brandMark">F</span><span>FailFirst <em>AI</em></span></div><span className="subhead">META AI HACKATHON · WORKING PROTOTYPE</span></header>
  <section className="hero heroPitch" aria-labelledby="hero-title">
   <div className="heroPitchCopy">
    <div className="eyebrow">DECISION INTELLIGENCE FOR THE AI ERA</div>
    <h1 id="hero-title">AI helps us <span>build faster.</span><br/>Let's decide <span>more wisely.</span></h1>
    <p className="heroLead">AI makes it easier than ever to solve problems, automate work, and create new businesses. But more opportunities mean more decisions, and more ways to waste time, money, and resources.</p>
    <p className="heroPromise"><strong>What if we could test a decision before paying for the mistake?</strong> FailFirst AI challenges assumptions, calculates possible financial outcomes, and helps you explore alternatives before you commit.</p>
    <div className="heroActions"><a className="heroPrimary" href="#decision-workspace">Stress-test a decision <span aria-hidden="true">→</span></a><span className="heroMicro">8 decision types · Transparent calculations · Meta AI risk hypotheses</span></div>
   </div>
   <aside className="heroPitchSide" aria-label="How FailFirst AI works">
    <div className="pitchSideEyebrow">FROM OPPORTUNITY TO INFORMED ACTION</div>
    <div className="pitchStep"><span className="pitchNumber">01</span><div><strong>Challenge the plan</strong><p>Reveal assumptions and plausible hidden risks.</p></div></div>
    <div className="pitchStep"><span className="pitchNumber">02</span><div><strong>Calculate the downside</strong><p>See stress-tested profit, break-even points, and sensitivity.</p></div></div>
    <div className="pitchStep"><span className="pitchNumber">03</span><div><strong>Explore a better path</strong><p>Test changes before committing real resources.</p></div></div>
    <div className="pitchTruth">AI proposes hypotheses. Deterministic code calculates the impact. <strong>Scenarios, not predictions.</strong></div>
   </aside>
  </section>
  <div className="workspaceIntro" id="decision-workspace"><div><div className="eyebrow">TRY IT WITH YOUR NUMBERS</div><h2>Break the plan. <span>Not the business.</span></h2></div><p>Choose a decision, adjust the assumptions, and explore what could go wrong.</p></div>
  <div className="tabs">{modeList.map(item=><button key={item.id} className={mode===item.id?'active':''} onClick={()=>{cancelPending();setMode(item.id);setAi(null);setError('')}}><span className="tabNumber">{item.number}</span>{item.label}</button>)}</div>
  <div className="layout"><section className="panel inputs"><div className="sectionHeading"><div><div className="eyebrow">INPUT ASSUMPTIONS</div><h2>{title}</h2></div><button className="minimal" onClick={reset}>Reset example</button></div>
   <label className="field"><span>{nameLabel}</span><input value={input.business||''} onChange={e=>update('business',e.target.value)}/></label>
   <div className="fields">{fieldList.map(([k,label])=><Field key={k} name={k} label={label} value={input[k]} update={update}/>)}</div>
   <label className="field"><span>Context and assumptions (optional)</span><textarea rows={4} value={input.details||''} onChange={e=>update('details',e.target.value)}/></label>
   <div className="actions"><button className="action" onClick={evaluateAI} disabled={loading||!!result.error}>{loading?'Meta is evaluating...':'Find hidden risks with Meta →'}</button><span className="small">Deterministic calculations work without Meta. The AI review uses your configured API key and may use credits.</span></div>
   {error&&<div className="notice">{error}</div>}
  </section>
  <section className="panel results"><div className="sectionHeading"><div><div className="eyebrow">DETERMINISTIC RESULTS</div><h2>Decision stress test</h2></div><span className="pill">Calculated, not predicted</span></div>
   {result.error?<div className="notice">{result.error}</div>:<>
    {mode==='quote'?<>
     <div className="stats"><Stat label="Baseline profit" value={fmt(result.value.baseProfit)} warning={result.value.baseProfit<0}/><Stat label="Stressed profit" value={fmt(result.value.stressedProfit)} warning={result.value.stressedProfit<0}/><Stat label="Stress margin" value={`${result.value.stressMarginPct}%`} warning={result.value.stressMarginPct<15}/><Stat label="Break-even quote" value={fmt(result.value.breakEvenPrice)}/></div>
     <p className="explain">Entered extra labor and materials inflation add <b>{fmt(result.value.addedCost)}</b> in potential costs. This is a user-defined scenario, not an estimated likelihood.</p>
     <DecisionGate gate={result.value.decisionGate} afterMeta={!!ai}><div className="gateMetrics"><div><span>Quote for illustrative 15% stress margin</span><strong>{fmt(result.value.decisionGate.targetQuotePrice)}</strong></div><div><span>Additional price needed</span><strong>{fmt(result.value.decisionGate.additionalPriceNeeded)}</strong></div></div></DecisionGate>
     <div className="minorHeading">What breaks first? <span>threshold analysis</span></div><div className="thresholdGrid"><div className="threshold"><span>Remaining profit buffer</span><strong className={result.value.resilience.remainingBuffer<0?'negative':'positive'}>{fmt(result.value.resilience.remainingBuffer)}</strong></div><div className="threshold"><span>Extra labor hours to break-even</span><strong>{result.value.resilience.extraHoursToBreakEven===null?(result.value.stressedProfit<=0?'Already loss-making':'N/A'):`${fmtDecimal(result.value.resilience.extraHoursToBreakEven)} h`}</strong></div><div className="threshold"><span>Extra material inflation to break-even</span><strong>{result.value.resilience.extraInflationPointsToBreakEven===null?(result.value.stressedProfit<=0?'Already loss-making':'N/A'):`${fmtDecimal(result.value.resilience.extraInflationPointsToBreakEven)} percentage points`}</strong></div><div className="threshold"><span>Cost of +1 labor hour / +1 inflation point</span><strong>{fmt(result.value.resilience.oneExtraLaborHourCost)} / {fmt(result.value.resilience.oneMaterialInflationPointCost)}</strong></div></div>
     <p className="small">Sensitivity uses one additional labor hour versus one additional percentage point of material inflation. Thresholds are based on the current entered stress case, not a forecast.</p>
     <p className="explain">{result.value.resilience.mostSensitive==='already_loss_making'?'The entered stress case already crosses break-even.':result.value.resilience.mostSensitive==='equal'?'One extra labor hour and one extra material-inflation point have equal dollar impact at the entered rates.':`At the entered rates, one extra ${result.value.resilience.mostSensitive==='labor'?'labor hour':'material-inflation point'} has the larger single-step dollar impact.`}</p>
    </>:mode==='product'?<>
     <div className="scenarios">{result.value.scenarios.map(s=><div className="scenario" key={s.label}><div className="scenarioLabel"><span>{s.label}</span><b className={s.monthSixProfit<0?'negative':'positive'}>{fmt(s.monthSixProfit)} / mo</b></div><div className="bar"><div style={{width:`${Math.min(100,Math.max(3,Math.abs(s.monthSixProfit)/Math.max(1,...result.value.scenarios.map(t=>Math.abs(t.monthSixProfit)))*100))}%`}} className={s.monthSixProfit<0?'bad':'good'}/></div><small>Month 6 · Six-month cumulative profit {fmt(s.profitSixMonths)}</small></div>)}</div>
     <p className="explain">Projection models repeat the specified monthly new-customer and churn assumptions. It does not estimate actual market demand.</p>
     <DecisionGate gate={result.value.decisionGate} afterMeta={!!ai}><div className="gateMetrics"><div><span>Break-even active customers in month 6</span><strong>{fmtCount(result.value.resilience.breakEvenCustomers)}</strong></div><div><span>Break-even monthly price in month 6</span><strong>{result.value.resilience.breakEvenMonthlyPrice===null?'Not available':fmt(result.value.resilience.breakEvenMonthlyPrice)}</strong></div></div></DecisionGate>
     <div className="minorHeading">Launch resilience <span>month 6</span></div><div className="thresholdGrid"><div className="threshold"><span>Modeled active customers</span><strong>{fmtDecimal(result.value.resilience.monthSixCustomers)}</strong></div><div className="threshold"><span>Customers above break-even</span><strong className={(result.value.resilience.customersAboveBreakEven??-1)<0?'negative':'positive'}>{fmtDecimal(result.value.resilience.customersAboveBreakEven)}</strong></div><div className="threshold"><span>Contribution per customer / month</span><strong>{fmt(result.value.resilience.contributionPerCustomer)}</strong></div><div className="threshold"><span>Price above / below break-even</span><strong className={(result.value.resilience.priceHeadroom??-1)<0?'negative':'positive'}>{result.value.resilience.priceHeadroom===null?'Not available':fmt(result.value.resilience.priceHeadroom)}</strong></div></div>
     <p className="small">Six-month cumulative profit: <b className={result.value.resilience.sixMonthCumulativeProfit<0?'negative':'positive'}>{fmt(result.value.resilience.sixMonthCumulativeProfit)}</b>. Break-even customers cover entered fixed costs and marketing after variable cost per customer. These are mathematical thresholds, not a customer-acquisition forecast.</p>
     <LaunchZeroCheck input={input}/>
    </>:<>
     <div className="stats">{result.value.cards.map((item,i)=><Stat key={`${item.label}-${i}`} label={item.label} value={displayMetric(item)} warning={item.warning}/>)}</div>
     <p className="explain">{result.value.explanation}</p>
     <DecisionGate gate={result.value.decisionGate}/>
     <div className="minorHeading">Break-even & sensitivity <span>calculated thresholds</span></div>
     <div className="thresholdGrid">{result.value.metrics.map((item,i)=><div className="threshold" key={`${item.label}-${i}`}><span>{item.label}</span><strong className={item.warning?'negative':''}>{displayMetric(item)}</strong></div>)}</div>
     <p className="small">Numbers are based only on the assumptions entered above. Missing market demand, supplier quotes, or customer conversion evidence is not guessed by the calculator.</p>
    </>}
   </>}
  </section></div>
  {!result.error&&<div className="analysisFull">
   {agentReviews.length>0&&<div ref={postMetaRef} className="postMetaAnchor"><ScenarioReviewPanel reviews={agentReviews} mode={mode} baselineProfit={mode==='quote'?result.value.baseProfit:null} stressedProfit={mode==='quote'?result.value.stressedProfit:null}/></div>}
   <RescuePanel options={rescueOptions} apply={applyRescue} afterMeta={!!ai}/>
   <section className="panel evidencePanel" aria-label="Risk evidence and validation"><div className="eyebrow">EVIDENCE & NEXT CHECKS</div><h2>Risks to validate</h2><RiskSections value={result.value} ai={ai} aiHeadingRef={aiHeadingRef}/></section>
  </div>}
  <footer>FailFirst AI • Hackathon prototype • Not accounting, investment, legal, or market forecasting advice.</footer>
 </main>
}
