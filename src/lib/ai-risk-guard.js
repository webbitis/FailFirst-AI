// A narrow deterministic guard for numerical language in AI-generated advertising risks.
// It does not claim to verify every number in free-form AI prose. Calculator and tool
// outputs remain the only authoritative financial arithmetic in FailFirst AI.
const round = (value, places = 2) => Number(value.toFixed(places));
const ceil = value => Math.ceil(value - 1e-9);
const fmt = value => Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });

export function adMathReference(input) {
  const spend = Number(input.adSpend);
  const revenue = Number(input.averageOrderRevenue);
  const variable = Number(input.variableCostPerOrder);
  const orders = Number(input.expectedOrdersFromAds);
  const conversionPct = Number(input.leadToCustomerConversionPct);
  const contribution = revenue - variable;
  const breakEvenOrders = contribution > 0 ? ceil(spend / contribution) : null;
  const expectedLeads = conversionPct > 0 ? ceil(orders / (conversionPct / 100)) : null;
  const breakEvenLeads = conversionPct > 0 && breakEvenOrders !== null ? ceil(breakEvenOrders / (conversionPct / 100)) : null;
  return {
    expectedOrders: orders,
    expectedLeads,
    conversionPct,
    breakEvenOrders,
    breakEvenLeads,
    contributionPerOrder: round(contribution),
    maxBreakEvenCostPerAcquiredOrder: contribution > 0 ? round(contribution) : null,
    expectedCostPerAcquiredOrder: orders > 0 ? round(spend / orders) : null
  };
}

export function guardAiRisks(mode, input, risks) {
  if (mode !== 'ads') return { risks, notes: [] };
  const math = adMathReference(input);
  const notes = [];
  const guarded = risks.map((original, index) => {
    const risk = { ...original };
    const text = `${risk.title || ''} ${risk.rationale || ''} ${risk.test || ''}`;
    // Replace an explicit lead-to-order arithmetic claim only when it is inconsistent.
    // Correct scenario-specific relationships (e.g. 1,340 leads -> 67 orders at 5%)
    // must remain intact. A generic keyword match would erase useful AI stress tests.
    const leadOrderPattern = /([\d,]+(?:\.\d+)?)\s+leads?\s+at\s+(?:the\s+)?(?:entered\s+)?(\d+(?:\.\d+)?)\s*%\s*(?:conversion\s+)?(?:rate\s+)?(?:to\s+get|to\s+yield|to\s+generate|for|yields?|produces?|implies?)\s+([\d,]+(?:\.\d+)?)\s+(?:incremental\s+|paid\s+)?orders?/ig;
    const mismatchedLeadOrderClaim = [...text.matchAll(leadOrderPattern)].some(match => {
      const leads = Number(match[1].replaceAll(',', ''));
      const conversion = Number(match[2]);
      const statedOrders = Number(match[3].replaceAll(',', ''));
      return Number.isFinite(leads) && Number.isFinite(conversion) && Number.isFinite(statedOrders)
        && Math.abs(leads * conversion / 100 - statedOrders) > 0.1;
    });
    if (mismatchedLeadOrderClaim) {
      risk.title = 'Conversion and attribution assumptions need evidence';
      if (math.expectedLeads !== null && math.breakEvenLeads !== null) {
        risk.rationale = `At the entered ${fmt(math.conversionPct)}% conversion, ${fmt(math.expectedOrders)} expected orders imply ${fmt(math.expectedLeads)} leads; ${fmt(math.breakEvenOrders)} break-even orders imply ${fmt(math.breakEvenLeads)} leads. These are calculated relationships, not observed campaign performance.`;
      } else {
        risk.rationale = 'The entered conversion does not support a finite, verifiable lead requirement for the planned orders and break-even target. Actual attribution and conversion still need evidence.';
      }
      risk.test = 'Run a capped, source-tagged pilot. Measure incremental paid orders, lead-to-customer conversion, refunds, and cancellations; compare observed results with the entered assumptions.';
      risk.evidence_status = 'inference';
      risk.simulation_reference = '';
      notes.push(`Risk ${index + 1}: lead/order conversion narrative replaced with verified calculator relationships.`);
      return risk;
    }
    // If the model describes a loss-scenario pace as a pilot stop rule, replace it
    // with the actual break-even threshold. A loss-case pace is not a profit target.
    const pilotMatch = String(risk.test || '').match(/first\s+\$?([\d,]+(?:\.\d+)?)\s+of\s+spend\s+paces?\s+below\s+([\d.]+)\s+(?:attributable\s+|incremental\s+|paid\s+)?orders?/i);
    if (pilotMatch && math.contributionPerOrder > 0) {
      const pilotSpend = Number(pilotMatch[1].replaceAll(',', ''));
      const proposedOrders = Number(pilotMatch[2]);
      if (Number.isFinite(pilotSpend) && pilotSpend > 0 && Number.isFinite(proposedOrders)) {
        const breakEvenPilotOrders = ceil(pilotSpend / math.contributionPerOrder);
        if (proposedOrders < breakEvenPilotOrders) {
          risk.test = `At $${fmt(pilotSpend)} of pilot spend, at least ${fmt(breakEvenPilotOrders)} incremental paid orders are needed to cover that spend at $${fmt(math.contributionPerOrder)} contribution per order. A lower order pace is loss-making; track attribution and refunds, and do not assume early pacing will continue.`;
          notes.push(`Risk ${index + 1}: pilot stop rule clarified using break-even contribution rather than a loss-scenario pace.`);
        }
      }
    }
    return risk;
  });
  return { risks: guarded, notes };
}
