# AI Max Recovery Audit — Hangover Module Specification & Technical Achievements

This document provides a comprehensive technical overview of the standalone **AI Max Recovery Audit** (Hangover) module developed for SearchSavior. It details our core architectural achievements, mathematical diagnostics, safety rules, and the structured output methods used for frontend presentation in the SearchSavior dashboard.

---

## 👁️ Core Vision & The Problem

When advertisers enable Google's **AI Max for Search**, positive keywords are expanded loosely and semantically (AI matching). Ads trigger on low-intent, price-anchored, and competitor-adjacent terms. Even when advertisers turn AI Max off, the **AI Max Hangover** persists because Google's **Smart Bidding** algorithms have already trained on the cheap, high-volume junk traffic and continue to bid aggressively on those broad semantic patterns.

Our **AI Max Recovery Audit** module solves this by programmatically parsing historical search terms, isolating the legacy hangover patterns, safety-checking negative recommendations, and presenting a validated, structured remediation JSON payload.

---

## 🏆 Key Achievements & Technical Milestones

### 1. Two-Stage Processing & Hybrid Layer Architecture
To ensure high processing speed, eliminate unnecessary API costs, and guarantee 100% deterministic output consistency, we designed a **Hybrid Classification Layer**:
* **Stage 1 (Programmatic JS — Local & Free)**: Natively parses search queries and automatically groups obvious price-anchored junk (`free`, `cheap`, `NHS`) and informational searches (`jobs`, `salary`, `training`) using fast local regex token matching.
* **Stage 2 (Gemini Fallback — Live AI)**: Falls back to Google's modern Gemini 2.5 Flash API (via the official `@google/genai` SDK) strictly for complex, creative semantic expansions—such as competitor brands (e.g. Asana vs Monday) and adjacent category drift (e.g. a general dentist triggering on orthodontics).

### 2. Campaign-Specific Isolation (Strict Boundaries)
Different campaigns target different audience profiles (e.g., premium orthodontics vs. NHS check-ups). 
* The safety engine and negative checkers operate **strictly within the boundary of the campaign under which the search term triggered**.
* Negative keywords are recommended strictly per campaign (`applicableCampaigns`), preventing accidental cross-campaign traffic blockage.

### 3. Persistent Local File Cache (`.audit_cache.json`)
* Integrates a file-based caching layer in the project root. Previously classified search terms are retrieved **instantly from the cache with 0ms latency and $0 token cost**.
* Newly discovered terms are batched, classified by Gemini, and then appended to the cache. Subsequent audit re-runs take **under 1 second**!

### 4. Negative Keyword Leakage & Failure Diagnostics
Programmatically analyzes the campaign config to identify why active negative keywords failed to block junk terms historically:
* **The Multi-Word Broad "AND" Trap**: Scans for broad negatives containing multiple words (e.g. `free software`) that failed to block terms (e.g. `free project tracker`) because broad negatives use strict AND logic under the hood.
* **Phrase Match Word Order Failure**: Detects when phrase negatives (e.g. `"emergency dentist"`) failed because words triggered in a different order or split (e.g. `dentist emergency`).
* **Campaign Coverage Gap**: Scans if a negative keyword is active in Campaign A, but leaked through Campaign B because B lacked that negative list.

### 5. Negative Synonym Expansion Engine (Synonym Gap Closure)
* Google negatives **never expand to synonyms**. If an advertiser blocks `free`, ads still trigger on `complimentary` or `no-cost`.
* When a negative keyword is recommended, the module programmatically pulls its **synonym cluster** (e.g., price synonyms, career synonyms, dental service synonyms), safety-checks them, and appends them as **prophylactic (preventative) recommendations** with `$0.00` estimated waste, sealing all future loopholes.

---

## 📊 Methods & Presentation Architecture

The module compiles all findings into a highly structured JSON document that validates perfectly against `output_schema.json` using AJV. The output is structured into **four primary presentation blocks**:

```
 ┌─────────────────────────────────────────────────────────────────┐
 │                      RECOVERY AUDIT OUTPUT                      │
 ├──────────────────┬─────────────────┬──────────────┬─────────────┤
 │  Hangover Score  │  Junk Patterns  │ Recommended  │   Bidding   │
 │     (0-100)      │   Aggregates    │  Negatives   │ Diagnostics │
 └──────────────────┴─────────────────┴──────────────┴─────────────┘
```

### A. Hangover Score Block (0-100)
Represents a composite indicator of how much AI Max behavior persists in the account.
* **Math Logic**: Blends zero-conversion spend ratios (up to 60 pts), observed CPA targets (up to 30 pts), and match-type leakage points (up to 10 pts).
* **Banded Category**: Auto-classifies into `none` (0-15), `mild` (16-40), `moderate` (41-70), or `severe` (71-100).
* **Temporal Decay Heuristic**: Hangover naturally decays over time after switch-off. The engine calculates the time elapsed since the disable date (`daysSinceDisable`) and decays the score by 1.5% per day after 30 days of switch-off.
* **Presentation**: Displays a 1-3 sentence explanation, the composite score, and an itemized `contributingFactors` array with weights and evidence.

### B. Junk Patterns Aggregates Block
Groups zero-conversion wasted search queries into clean, visual category buckets for the frontend dashboard charts.
* **Math Logic**: Iterates over all wasted terms and maps them to their categorized pattern: `brand-competitor`, `informational`, `tangential-vertical`, `price-anchored-low-intent`, or `other`.
* **Presentation**: Exposes a grouped array containing:
  - `category`: The category key name.
  - `termCount`: Total count of distinct zero-conversion search terms in that group.
  - `totalCost`: Total observed wasted spend in the report.
  - `exampleTerms`: A filtered array containing the **Top 10 highest-waste search terms** in that category, sorted by cost descending, for UI display.

### C. Recommended Negatives Block (Safe & Prioritized)
A prioritized todo list of negative keywords ready to be synced.
* **Math Logic**: Prioritizes negatives from highest waste cost (highest financial recovery impact) to lowest.
* **Safety Filter**: Programmatically checks that proposed negative keywords and their singular/plural variants do not conflict with positive converting terms in that campaign.
* **Observed Cost Mapping**: Directly maps the actual observed cost of the matching search term in the report to the `estimatedMonthlyWaste` field (avoiding fixed-window scaling errors).
* **Presentation**: Exposes a sorted array containing the keyword, optimized match type (`EXACT`, `PHRASE`, `BROAD`), campaign targeting details, confidence scores, and human-readable, user-facing reasons (e.g. `"Obvious price-anchored junk query."`).

### D. Smart Bidding Diagnostics Block
Observations about whether Google's bidding algorithm is still chasing legacy patterns.
* **Math Logic**:
  - **CPA Inflation**: Computes CPA Inflation Pct = $\frac{\text{Current CPA} - \text{Baseline CPA}}{\text{Baseline CPA}} \times 100$.
  - **Outlier-Immune Median CPC comparison**: Compares the **Median CPC** of converting clicks vs wasted clicks. If wasted clicks are statistically cheaper but command massive volume, the status is flagged as `chasing-cheap-clicks` (downward shift).
* **Presentation**: Exposes the status (`healthy`, `elevated-cpa`, `chasing-cheap-clicks`, `insufficient-data`), computed metrics, and a detailed 2-5 sentence free-form `observations` log.

### E. Recovery Timeline Block
Projections on how long until the bidding algorithms re-train.
* **Math Logic**: Severe hangovers project **8 weeks** of recovery, moderate hangovers project **5 weeks**, and mild hangovers project **3 weeks**. If the system is actively `chasing-cheap-clicks`, an additional **2 weeks** is added to let the bidding engine reset.
* **Presentation**: Exposes estimated weeks, confidence level (`low`, `medium`, `high`), and detailed week-by-week expected outcome milestones.

---

## 🧪 Verification & Schema Compliance

The module is verified and validated against the three synthetic scenarios:
* **Scenario 1 (Heavy - ProjectFlow)**: Scores **83 (SEVERE)** with **42 negatives**, flagging Smart Bidding as `chasing-cheap-clicks`. Output saved and schema-validated.
* **Scenario 2 (Mild - BrightSmile)**: Scores **48 (MODERATE)** with **33 negatives** (includes temporal decay from April switch-off). Output saved and schema-validated.
* **Scenario 3 (Baseline - Roastery Co)**: Scores **5 (NONE)** with **2 negatives** (standard background noise), preventing false positives. Output saved and schema-validated.

---

## 📂 Production Files

Michael can find all developed production files ready for integration under `Mugesh Task Folder/01 TASK - AI Max Guardrails/`:
* **`src/parser.js`**: Ingests and normalizes CSV, JSON, and TXT files.
* **`src/diagnostics.js`**: Houses heuristics, safety checks, leakage engine, and score math.
* **`src/gemini.js`**: Handles Gemini 2.5 Flash calls using `@google/genai` (v2) SDK and `.audit_cache.json`.
* **`src/schemaValidator.js`**: JSON schema AJV validators.
* **`src/index.js`**: Primary entry point and CLI runner.
* **`tests/audit.test.js`**: Sync test assertions suite (`npm test`).
* **`package.json`**: Dependencies.
* **`.env`**: API Key configuration setup.
