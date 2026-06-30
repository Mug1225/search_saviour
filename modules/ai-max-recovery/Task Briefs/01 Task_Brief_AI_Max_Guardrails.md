# AI Max Guardrails — First Task Brief

**For:** Mugesh
**From:** © Michael Hulsmann, SearchSavior
**Date:** 16 May 2026

---

## Background

SearchSavior is a Google Ads tool focused on negative keyword management. Three core capabilities:

1. **Match type intelligence** — for each negative keyword, recommends Exact, Phrase, or Broad match with reasoning
2. **Confidence Engine** — before any negative is added, checks every active positive keyword in the account to prevent a negative blocking profitable traffic in another campaign
3. **Hidden waste estimation** — surfaces the spend lost to queries Google redacts (27-73% of search term data). 
(This feature is currently only for situational awareness, but will be actionable in upcoming updates. But already, the existing match-type intelligence closes the loop. When SearchSavior recommends a Broad or Phrase negative (e.g., free as Broad, competitor-brand as Phrase), that negative also blocks redacted variations you can't see. So the hidden waste isn't directly attacked, but the right match type aggression catches a meaningful chunk of it anyway.


The product philosophy: **SearchSavior recommends, the user decides.** Nothing touches the Google Ads account without explicit approval. Every action is reversible.

---
#Your Task: Implementing AI MAX Guardrails

## What is AI Max?

AI Max for Search is Google's AI feature suite that does three things to Search campaigns. The mechanics are best understood through what they do in real accounts.

### 1. Expanded matching

With AI MAX enabled, Keyword matching becomes even more loose and semantic, well beyond strict match types.

**Example.** A B2B SaaS advertiser bids on the keyword `project management software for agencies` (Phrase match). With AI Max enabled, ads start triggering on searches like:

- `how to organise freelance work` (low-intent informational)
- `Asana vs Monday.com review` (research stage, mid intent, competitor-adjacent)
- `client management tools` (different category entirely)

None of these were actually bid on. The advertiser sees clicks coming in from queries they never targeted. A small fraction convert; most do not. Cost climbs.

### 2. Generated ad variations

Google creates and rotates headlines and descriptions dynamically, using your existing assets as a starting point.

**Example.** The advertiser writes a single headline: `Track Your Agency's Projects in One Place`. AI Max generates and rotates variations the advertiser never wrote:

- `The Project Tool Built for Agencies`
- `Stop Switching Between 5 Apps`
- `Agency Owners: Reclaim Your Mondays`

Performance reporting is by ad group only; the AI-generated variants are not individually reported. The advertiser cannot always tell which variation drove which click, which makes ad copy testing much harder.

### 3. Search query interpretation

Google decides what the user "really meant" and serves your ad accordingly. As of May 2026, the search terms shown in your account report may be Google's interpretation of **intent** rather than the literal query (according to a recent Google documentation update).

**Example.** A user types `is dental insurance worth it if i have good teeth?`. Google interprets this as `dental insurance` intent. A dental insurance ad triggers. The search term shown in the advertiser's report may simply read `dental insurance` rather than the full ambivalent query. The advertiser has no way to tell that the actual searcher was weighing whether to bother with insurance at all.

### The combined effect

For advertisers this means broader reach with less control. A pattern keeps emerging: users turn AI Max on, see CPA (Cost per Acquisition) spike, so they turn it off. But they often forget, or realise too late, that the Smart Bidding feature has already learned to chase the cheap, high-volume traffic AI Max attracted. Thus is where the **AI Max hangover** comes in.

**A Concrete hangover scenario.** A B2B SaaS advertiser running for 6 months at $3,000/month. Turned AI Max on in March. CPA climbed from $80 to $185 over 8 weeks. Turned AI Max off in May. Expected CPA to recover by mid-May. By June, CPA still at $145. Why? Smart Bidding learned to bid aggressively on broad, cheap clicks because AI Max was feeding it that traffic mix. The model favours that pattern even without AI Max actively expanding queries. The hangover persists for weeks or months!

This is the problem SearchSavior's **AI Max Guardrails** feature will attempt to solve. The first deliverable focuses on the recovery side.

---

## The Task

Build a standalone module called **AI Max Recovery Audit**.

For input, it takes a Google Ads search term report (CSV) plus campaign metadata for an account that has had AI Max enabled at some point, identifies the "hangover" patterns, and outputs a structured remediation plan.

### Inputs

You will receive sample input fixtures (synthetic data) covering:

1. **Search terms CSV** — This will be in standard Google Ads export format. Columns: search term, campaign, ad group, match type, impressions, clicks, cost, conversions, conversion value, CTR, CPC.

2. **Campaign config JSON** — The current campaign settings, including:
   - AI Max status (currently on, currently off, never enabled)
   - If off: estimated date AI Max was disabled
   - Negative keyword lists already in place
   - Match types in use
   - Smart Bidding strategy (target CPA, target ROAS, etc.)

3. **Business context (optional, but helpful for context)** — text description of the business and ICP

### Outputs

A structured JSON file containing:

1. **Hangover Score (0-100)** — composite indicator of how much AI Max behaviour persists after AI switch-off
2. **Junk traffic patterns** — search term clusters suggesting AI Max expansion (semantic drift, brand competitor expansion, intent mismatch, price-anchored low intent)
3. **Recommended negatives** — each with:
   - The negative keyword
   - Recommended match type (Exact, Phrase, or Broad)
   - Reason (one-sentence explanation)
   - Estimated wasted spend per month
4. **Smart Bidding diagnostics** — observations about whether Smart Bidding is still chasing AI Max-trained patterns (CPC distribution shifts, match type composition of converting queries, CPA reversion check)
5. **Recovery timeline estimate** — typical weeks to CPA recovery given the audit findings

### Success Criteria

A successful module:

1. Produces deterministic output for the same input (same fixtures yield same recommendations)
2. Recommends 10-25 negatives per audit on typical input
3. Flags at least 3 distinct junk traffic pattern categories
4. Output JSON validates against the output_schema (to be provided separately)
5. Runs in under 60 seconds on standard input
6. Handles edge cases gracefully (no AI Max history, no negatives configured, empty search term report)

---

## Tech Stack

- **Language:** Node.js (matches SearchSavior backend; eases later integration)
- **AI calls:** Google Gemini 2.5 Flash via the official API. API key will be provided separately.
- **Dependencies:** Keep minimal. CSV parser and schema validator are fine. Avoid framework-level dependencies (no Express, no NestJS for this module).
- **Output format:** JSON validating against the provided schema

---

## Heuristic Starting Points (not prescriptive)

These are starting points to consider. You may discover better approaches.

### Detecting AI Max-trained Smart Bidding

- Compare CPC distribution before and after AI Max was disabled (if applicable)
- Look for sudden shifts in match type composition of converting queries
- Check whether CPA has reverted to pre-AI Max levels (usually it has not)

### Junk traffic pattern categories to look for

- **Brand competitor queries.** Your ad triggered by a competitor's brand. Example: the dental practice (BrightSmile) ad triggered by `Smile Direct Club reviews`, or the project management (ProjectFlow) tool ad triggered by `Asana pricing`.
- **Informational queries.** Job seekers, students, DIY enthusiasts. Example: `dental hygienist salary`, `how to whiten teeth at home`, `is project management hard to learn`.
- **Tangential vertical queries.** Semantic drift into adjacent industries. Example: a general dentist's (who do not offer orthodontics) ad triggered by `orthodontist near me`, or a SaaS tool ad triggered by queries about a competing category.
- **Price-anchored queries with low intent.** Words like "cheap", "free", "discount" attached to your category. Example: `cheapest emergency dentist`, `free project management software`, `discount Invisalign`.

### Match type recommendations

- For intent categories (e.g., job-seeker queries), prefer Broad match negatives to catch all variations
- For competitor brands, prefer Phrase match to allow brand-adjacent legitimate queries through
- For one-off junk queries, Exact match is sufficient

### AI calls

- Use Gemini to classify each search term by intent (high, medium, low, wrong)
- Use Gemini to suggest match type for each candidate negative based on the term and business context
- Cache results to minimise API calls

---

## Boundaries

- This module is **standalone**. For now, no SearchSavior code dependencies. No assumptions about SearchSavior's database, auth, or UI.
- The module receives input via function parameters, stdin, or file path. It returns output via function return, stdout, or file path.
- Do not hit production Google Ads APIs. Work entirely on the provided fixtures.
- Do not store user data, log API responses to external services, or transmit anything beyond the Gemini API.
- If you encounter ambiguity in the spec, ask Michael before assuming.

---

## Resources Provided

- This brief, 01 Task_Brief_AI_Max_Guardrails
- Sample input fixtures (3 scenarios: heavy hangover, mild hangover, no hangover baseline)
- Output JSON schema (output_schema.json)
- The "AI Max Hangover" blog post (for narrative framing of the problem)
- Gemini 2.5 Flash API key (separately, encrypted channel)
- ReadMe
Ancillary Files
- Match Types Cheat Sheet
- Google Ads Deep Dive


---

## Communication

- Weekly check-in call, or anytime you need
- Ad-hoc questions via [WhatsApp, or email]
- Code reviews on completed milestones

---

## Timeline

To be agreed during initial call. Suggested rough shape:

- Week 1: spec review, environment setup, prototype against one scenario
- Week 2: full coverage of all three scenarios, initial output structure
- Week 3: refinement, edge case handling, README
- Week 4: handoff, walk-through of code with Michael

---

## Deliverable

A Node.js module (single file or small directory) that:

- Has a clear entry point function
- Includes a README explaining how to run it locally
- Includes the test fixtures used during development
- Demonstrates working output against all three scenarios
- Includes basic test coverage for the main functions

Michael will handle integration into SearchSavior's main codebase. Your deliverable is the working standalone module plus documentation.

---

## NDA and IP Note
To formalise this process and new relationship, please sign the included NDA document.
Per the Contributor Agreement signed [date], this work is assigned to Polyglot Creative Ltd. on delivery. Confidentiality applies per the NDA. Do not share fixtures, schemas, or any element of this brief outside of the project.

---
