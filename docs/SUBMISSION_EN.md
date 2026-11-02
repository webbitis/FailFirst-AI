# FailFirst AI — submission text (English)

**Project title:** FailFirst AI

**Tagline:** Break the plan. Not the business.

**Suggested track:** Indie Developer

**Suggested theme:** Build for Your World

**One-line pitch:** FailFirst AI helps small businesses stress-test
eight high-stakes decisions by combining Meta-generated risk scenarios
with deterministic, auditable financial calculations.

## Short project description

FailFirst AI is a business decision stress-testing prototype. Users
choose from eight scenarios, such as quoting a contract, launching a
subscription, buying inventory, or opening a new branch, and enter their
own assumptions. Deterministic code calculates profit, break-even
thresholds, and sensitivity. Meta Muse Spark 1.3 reviews contextual
details, proposes risk hypotheses, and can call bounded simulation tools
to test how a decision changes. The interface separates user
assumptions, AI hypotheses, and calculated financial results. Instead of
predicting demand or inventing supplier prices, it shows what might
break, how much it could cost under a stated scenario, and what to
verify before committing money.

## What makes it different

- **AI for hypothesis generation and tool selection; code for
  arithmetic.** Financial numbers are calculated outside the model.
- **Before/after decision impact.** The user sees a baseline, entered
  stress, AI-tested downside, and revised decision thresholds.
- **Eight business decisions.** Quotes, subscriptions, hiring,
  inventory, discounts, advertising, new services, and new branches.
- **Evidence labels.** Hypothetical scenarios are explicitly
  distinguished from observed facts and forecasts.

## Technical implementation

- Next.js 15 / React 19 application.
- Meta Model API using `muse-spark-1.3`.
- Bounded agent tool-calling loop with deterministic JavaScript
  simulation functions.
- Server-side API route `/api/analyze`.
- 64 deterministic Node tests passed in packaging; **v0.10 production
  build and live API call should be checked on the recording computer**.

## Honest limitations

Hackathon MVP. Inputs are manual; no database, user accounts, PDF
extraction, production multi-user deployment, or real-world market
forecasting. Risks are hypotheses, not verified supplier costs or
predicted probabilities. Some scenarios simplify cash flow, inventory
salvage, or recurring revenue.

## Demo video title

FailFirst AI — Meta Muse Spark Business Decision Stress Tester \|
Hackathon Demo

## Demo video description

FailFirst AI helps businesses test decisions before committing money. In
this demo: a client quote is stress-tested with Meta Muse Spark, and
deterministic code recalculates the downside and pricing threshold. We
also show subscription and inventory decision modes. Built for the Meta
Global AI Developer Hackathon, Indie track.

**Video URL:** \[add after uploading\]

**GitHub URL:** \[add after publishing\]

**Live demo URL:** \[add only if deployed and accessible\]

**Participant Guide requirements:** public GitHub repository, publicly accessible 3-minute demo, one submission through Cerebral Valley by Nov 4, 2026 at 9 PM ET. Only show hackathon-built work and clearly identify original contributions. Check the participant portal for exact link/hosting fields and any later updates.
