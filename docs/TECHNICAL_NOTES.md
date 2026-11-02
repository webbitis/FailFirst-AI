> **Current competition requirement:** Participant Guide specifies a public GitHub repo and 3-minute demo. Historical shorter demo suggestions below are superseded by `docs/DEMO_STORYBOARD_HY.md`.

# FailFirst AI · Meta Global AI Developer Hackathon

**Break the plan. Not the business.** FailFirst AI stress-tests business decisions before money is committed. It now contains eight decision modes:

1. **Quote / contract** — baseline and downside profit, shipping, stress margin, break-even quote, and remaining labor/material buffer.
2. **Subscription launch** — six-month subscription economics under acquisition, churn, price, and cost scenarios.
3. **Hire vs subcontract** — allocated project cost, full-period employee cash commitment, subcontractor total, and capacity fit.
4. **Bulk vs small batch** — modeled profit, unsold inventory exposure, break-even sales, and possible stockout / missed contribution.
5. **Discount test** — additional units and sales uplift required to preserve current contribution profit after a discount.
6. **Ad spend ROI** — orders, revenue, leads, and ROAS required to recover advertising spend after variable costs.
7. **New service** — contribution per client, monthly break-even clients, setup payback, and result over a chosen evaluation period.
8. **New branch** — fixed costs, required turnover, base and downside operating profit, and total downside result including setup costs.

## v0.10 · Demo-ready UX (October 31, 2026)

This update changes **presentation only**, not the financial formulas, scenario tools, or Meta API integration:

- The input form and deterministic baseline remain side by side. **After Meta**, baseline rescue options, and risk evidence are displayed in **full-width sections** below the initial comparison, eliminating the tall empty left column.
- Quote / contract has a **Before stress → Entered stress → After Meta stress** summary showing the most severe deterministic quote simulation returned by the agent, plus the corresponding 15%-margin repricing threshold. The most severe *modeled* scenario is not the most probable outcome.
- AI-generated risk hypotheses are now **collapsed by default**. Expand a risk to read the full rationale, proposed validation test, simulation reference, and evidence status. Deterministic audits and calculation-driven flags remain visible.
- Once the Meta request completes, the page **scrolls to the post-agent decision review**. If Meta returns hypotheses without a simulation, it scrolls to the AI risk heading instead. Reduced-motion preference is respected.
- The baseline Decision Rescue section is explicitly labeled **BASELINE** when Meta results exist, so it cannot be mistaken for a rescue already adjusted to the agent's downside.

**Validation:** 64/64 deterministic Node tests pass; the JSX compiles using a TypeScript transpilation check, CSS parsing reports no errors, and server-side static markup checks confirm the initial layout and post-agent summary. A full Next.js production build and a live Meta API call were **not** run in the packaging environment because dependencies were unavailable from the npm registry. Run `npm run build` and one live Meta analysis on your own machine before submitting.

**Upgrade:** extract this ZIP into a **new** folder. Copy only your own `.env.local` from the previous project. Do not upload that file to a repository or share it with anyone.

## v0.9 · Eight-mode review consolidation (October 31, 2026)

After live walkthroughs of all eight decision modes, this update focuses on **fair scenario comparisons** and **post-agent decision clarity**:

- **Cost-scope isolation:** Meta's bounded stress tool now accepts an explicit `costScope`. A branch fixed-cost overrun can change only rent/payroll/utilities/other fixed cost. A promotion-only fulfillment overrun changes only the discounted option's variable cost, preserving the original full-price comparator. `all` remains available for deliberately combined stresses; the exact changed inputs are visible.
- **After Meta · Verified Scenario Impact:** a separate panel interprets the *actual deterministic tool results*, not the AI prose. A loss-making quote gets a new 15%-margin repricing threshold; a subscription scenario with negative month-six profit is flagged even if six-month cumulative profit remains positive; branch compound demand stresses are explicitly explained.
- **Subscription launch reality check:** if the user starts with existing paying subscribers, the UI also shows a zero-start counterfactual and the early modeled operating deficit. A 12-month continuation of an AI subscription stress is displayed only when it shows a later cumulative loss and is explicitly labeled an extrapolation.
- **Clearer financial labels:** branch downside net loss is no longer called an opening cash investment requirement. Advertising displays modeled CAC per acquired order, maximum allowable CAC, and required conversion at the entered implied lead volume. Hire comparison shows the all-in subcontractor cost at which it equals employee cash commitment.
- **Updated Meta instructions:** no simulated customers should be described as signed; known input-audit flags should not be presented as novel evidence; scenario names should disclose every cost category changed.

**Limits:** this does not yet model branch working-capital reserves, phased opening ramps, full customer cohorts, or the distinction between an existing employee's sunk salary and a new hire's incremental commitment. The scenario-scope safeguard is strongest for the deterministic results and trace; free-form Meta prose is still a hypothesis, not independently verified in full. No live Meta call is included in unit tests. The local Node test suite does not replace a production Next.js build.

## v0.8 inventory decision flip point + salvage stress

The inventory mode now distinguishes two separate thresholds: **large-batch break-even demand** (231 units in the example) and **demand where bulk first beats the small-batch alternative** (269 units). The latter is the actual decision-switch threshold under unchanged unit economics. Decision Rescue offers a reversible 269-unit what-if scenario, never a claim that demand will materialize.

Modeled inventory profit assumes **all unsold units are liquidated at the entered salvage value within the evaluation period**. This is not realized cash. The assumption audit flags unverified liquidation, and the Meta agent can run bounded salvage stress scenarios (`salvageMultiplier`, default 1; 0 removes all salvage proceeds). Inventory demand must be a whole number of units, including in AI-run simulations. Tests cover crossovers, no-crossover cases, salvage downside, and scenario replay.

## v0.7 arithmetic consistency guard

In advertising mode, the server separately computes the leads implied by expected orders and the leads required at break-even. If an AI-generated risk mixes up those two relationships, its conversion narrative is replaced with server-verified arithmetic. A pilot loss-case order pace is also distinguished from a break-even pace. The UI discloses when this narrow guard changed AI prose. This guard is intentionally limited: it does **not** prove that every free-form AI number is correct. All decision-critical figures should be read from the deterministic calculator and tool trace.

## What makes this more than a risk-report chatbot

Meta Muse Spark can choose a bounded simulation tool, execute it, inspect the deterministic result, and then synthesize risk hypotheses tied to the completed scenario. Financial arithmetic runs in JavaScript functions, not in the language model. Every scenario is labeled as hypothetical; it is not a forecast or a probability estimate.

The six added decision modules use explicit, user-entered assumptions. They do not infer actual market demand, supplier prices, conversion rates, employee productivity, or customer behavior. A Decision Gate is a review aid, not an instruction to automatically commit money.

## Run locally

Requires Node.js 20.6+ (Node 22 recommended).

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Deterministic calculations work without an API key.

Run the test suite:

```bash
npm test
```

## Connect Meta Model API

1. Confirm the $150 credit appears under **Free Credits** in Meta Billing.
2. Copy `.env.example` to `.env.local`.
3. Put your own API key in `.env.local`:

```env
MODEL_API_KEY=your_real_key_here
META_MODEL=muse-spark-1.3
```

4. Restart the dev server after changing environment variables.
5. Click **Find hidden risks with Meta**. Each analysis uses a bounded tool loop and a final structured synthesis call, so one click may make up to three Meta API requests. Monitor Billing while testing.

Never paste the API key into chat, client-side code, screenshots, or GitHub. `.env.local` is excluded by `.gitignore`. A spend notification is not necessarily a hard spending cap.

Official references:
- Meta Model API quickstart: https://dev.meta.ai/docs/cookbook/quickstart-chat-completions
- Structured output: https://dev.meta.ai/docs/cookbook/structured-output
- Tool calling: https://dev.meta.ai/docs/cookbook/tool-function-calling

## Important modeling limits

- Hire vs subcontract compares allocated project labor cost with the subcontractor total. The full-period employee cash commitment is shown separately because unused capacity may still be paid. The comparison is valid only if both options cover the same scope and quality.
- Inventory profit assumes the entered demand, shipping, holding cost, and recoverable value of unsold units. It flags stockout opportunity but does not model reorder lead time or demand distributions.
- Discount analysis compares contribution before fixed costs and does not predict customer response.
- Advertising analysis calculates break-even economics; it does not predict CPC, conversion, attribution, or campaign performance.
- New service treats each client as a one-time project. Recurring subscriptions need a subscription model.
- New branch excludes taxes, financing, working capital, opening delays, cannibalization, and costs not entered by the user.
- The MVP uses manual inputs; PDF extraction is not implemented. Data stays in browser state; there is no authentication, database, or production multi-user support.
- AI-generated risks are hypotheses, not verified facts. The application is a hackathon prototype, not accounting, investment, legal, or market forecasting advice.

## Current validation

The local deterministic test suite covers all eight decision modes, break-even math, risk flags, bounded agent simulations, and existing quote/product behavior. A Next.js production build and live Meta API request should still be run locally with dependencies installed and the user's API key configured.

## v0.6.0: Decision Rescue + input audit (October 31, 2026)

This update keeps all eight decision modes and the original Meta Muse Spark tool-calling agent. It adds:

- **Decision Rescue Engine** (`src/lib/rescue.js`): deterministic what-if options to close a negative economics gap. The UI shows the original and recalculated outcome and a **Try this scenario** button. Options are **hypothetical**, not predictions or evidence that a price increase, order uplift, or lower budget is achievable.
- **Independent assumption audit** for the six new modes, even when the Meta API is not configured. For example, implausibly high inventory salvage value is flagged and prevents a confident batch recommendation.
- **Hire vs subcontract project revenue** (optional for older saved scenarios), with profit comparison based on the employee's full-period cash commitment versus subcontractor cost. Allocated labor cost is still displayed separately.
- **Stale AI response protection**: when the user edits inputs, resets, changes mode, or tries a rescue scenario, the previous AI request is aborted and cannot overwrite the current decision.
- Additional regression tests covering rescue thresholds and suspect inputs.

### Recommended 90-second demo

1. Select **06 · Ad spend ROI** and keep the example values: $1,000 ad spend, $100 order revenue, $60 variable cost, 20 expected orders. Calculated result is **−$200**.
2. Show **Decision Rescue**: 25 paid orders, $800 capped budget, or $110 average order revenue are three *separate* numerical ways to reach break-even, if achievable.
3. Click **Try this scenario** on one option and show the entire analysis recalculating to zero. Click **Reset example** to return.
4. Click **Find hidden risks with Meta** only after `.env.local` is configured and Meta API credits are available. Show tool-run assumptions and distinguish hypotheses from deterministic math.
5. Optionally show **04 · Bulk vs small batch**, set demand to 0 and salvage value to $40. The result warns about unrealistic recoverable value even if the model reports profit from salvage.

### Local test and run

```bash
npm install
npm test
npm run dev
```

Open http://localhost:3000. Preserve your own `.env.local`; never commit or share it. This package contains no API key. Unit tests do **not** prove a production Next.js build or a live Meta API response. Those require separate checks in the target environment.

## v0.9 suggested 2-minute demo (after configuring your own Meta key)

1. Open **01 · Quote / contract** and Reset example. Show the deterministic $2,000 baseline profit and $160 stressed profit at an $8,000 quote.
2. Click **Find hidden risks with Meta**. The agent may choose different hypothetical amounts each time. If it simulates excluded delivery/inspection fees, open **After Meta · Verified Scenario Impact** to show how the *actual tool result* changes the required quote. Do not promise a fixed AI output.
3. Open **05 · Discount test**. Explain why promotional fulfillment costs should be applied to the discounted option only. Agent stress tool now supports `costScope: promotion_only`.
4. Open **02 · Subscription launch**. Explain why starting with 120 paying subscribers is different from starting at zero, and why a positive six-month cumulative profit can coexist with a loss-making month six.
5. Close with: **"AI discovers the assumptions. Deterministic code tests them. The user decides with clearer evidence."**
