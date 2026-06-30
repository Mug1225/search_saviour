# Part 4: Solution Architecture & Roadmap

This document outlines the design patterns, processing stages, mathematical calculations, and future enhancements of the AI Max Recovery Audit module.

---

## 1. System Architecture Diagram

```
                  ┌────────────────────────────────────────┐
                  │              INPUT DATA                │
                  │   Search Terms, Config, Context        │
                  └───────────────────┬────────────────────┘
                                      │
                                      ▼
                  ┌────────────────────────────────────────┐
                  │       STAGE 1: LOCAL DIAGNOSTICS       │
                  │  * Wasted Spend Filtering             │
                  │  * Match-Type Leakage Checks           │
                  │  * Pre-filtering (free, cheap, jobs)   │
                  │                                        │
                  └──────┬──────────────────────────┬──────┘
                         │                          │
           [Matches Heuristics]              [No Direct Matches]
                         │                          │
                         ▼                          ▼
                  ┌──────────────┐          ┌──────────────────────┐
                  │ Local Recs   │          │ Gemini / Mock AI     │
                  │ (Stage 1)    │          │ Semantic Classifier  │
                  └──────┬───────┘          └───────┬──────────────┘
                         │                          │
                         └────────────┬─────────────┘
                                      │
                                      ▼
                  ┌────────────────────────────────────────┐
                  │    POST-PROCESSING SAFETY FILTERS      │
                  │  * Clean & override (Layer 3)          │
                  │  * Redundant Negative check            │
                  │  * Cross-Campaign Conflict check       │
                  │  * De-duplicated Waste Allocation      │
                  └───────────────────┬────────────────────┘
                                      │
                                      ▼
                  ┌────────────────────────────────────────┐
                  │     DIAGNOSTICS & SCORE ENGINE         │
                  │  * Rebalanced Weights & CPA Multiplier  │
                  │  * Reference-Date Temporal Decay       │
                  └───────────────────┬────────────────────┘
                                      │
                                      ▼
                  ┌────────────────────────────────────────┐
                  │       JSON VALIDATION & HANDOFF        │
                  │  * AJV output_schema validation        │
                  │  * Healthy campaigns check             │
                  └────────────────────────────────────────┘
```

---

## 2. Detailed Technical Breakdown

### A. Stage 1: Deterministic Heuristics (Local Node.js)
Stage 1 executes entirely on the local system with zero external API calls:
1. **Wasted Spend Filtering**: Isolates all search queries where `conversions === 0` and `cost > 0`.
2. **Negative Keyword Leakage Checks**: Runs four checks to flag match-type gaps:
   - **Broad AND Trap**: Detects if multi-word broad negatives failed because the query only matched some of the words.
   - **Phrase Order Flip**: Checks if words in a phrase negative triggered in a different order, letting the query trigger.
   - **Campaign Gap**: Detects when Campaign A has a negative but Campaign B leaked it because it lacks the negative.
3. **Local Pre-Filtering**: Categorizes obvious pricing queries (`free`, `cheap`, etc.) and career queries (`salary`, `jobs`, `intern`, `master`, `manager`, `scrum`, etc.) programmatically. This prevents roles from reaching the LLM and being hallucinated as brand-competitors.
4. **NHS Safety Override**: Rather than using static Stage 1 hardcoding, NHS queries are routed through the context-aware Stage 2 classification layer (with a programmatic post-processing override) to guarantee accurate, vertical-safe categorization as tangential-vertical.

### B. Stage 2: Fallback Semantic AI Classification
Queries that do not trigger obvious Stage 1 patterns are sent to Stage 2:
1. **Caching**: Reads [.audit_cache.json](file:///c:/programs/search-saviour/task-1%20AI%20hangover/Mugesh%20Task%20Folder/01%20TASK%20-%20AI%20Max%20Guardrails/.audit_cache.json). If a query is already cached, it bypasses network calls entirely, yielding `0ms` latency.
2. **Gemini Live Client**: In production, `GEMINI_API_KEY` is required. The client calls the `gemini-2.5-flash` model with `temperature: 0.0` and structured JSON schemas to perform deterministic competitor and semantic classification.
3. **Fail-Fast & Test Mocking**: If the API key is missing or the live network request fails in production, the module immediately throws an error. If in a test environment (`NODE_ENV === 'test'`), it falls back to the local procedural mock classifier to ensure unit test execution remains stable.

### C. Post-Processing & Validation Filters
Before formatting the final payload, the orchestrator applies strict quality checks:
1. **Layer 3 Programmatic Sanitizer**:
   - Programmatically overrides any misclassified role keywords (e.g. "scrum master") to `informational` / `BROAD`.
   - Softens reasons (rewriting `"does not offer"` to `"Zero conversions suggest ... is not a service you offer. Confirm before blocking."`).
   - Programmatically extracts the first sentence of the reason to guarantee natural grammatical sense, relying on prompt engineering to enforce the length limit.
   - Distributes confidence scores dynamically to range from `0.50` to `0.99` (e.g., exact blocks at `0.70`, competitors at `0.92`).
2. **Redundant Negative Filtering**: Checks existing campaign negatives. If the keyword is already blocked by a broader match type (e.g. existing `BROAD` matches proposed `PHRASE` negative), it skips the recommendation.
3. **Cross-Campaign Safety Conflict Checks**: Validates keywords against converting positive terms. If it's an account-level negative, it checks across *all* campaigns. If a conflict occurs, it prunes the campaign or drops the recommendation.
4. **Cost-Allocation Waste Reconciliation**: Prevents double-counting by allocating each zero-conversion query's cost to the highest-priority matching recommendation.

### D. The Score & Timeline Engine
1. **Score Formula**:
   $$\text{Raw Score} = \text{Waste Points (Max 40)} + \text{CPA Points (Max 40)} + \text{Leakage Points (Max 20)}$$
   - Waste Points: proportional to wasted spend ratio ($\frac{\text{wasted spend}}{\text{total spend}} \times 100$).
   - CPA Points: CPA inflation percentage multiplied by `1.25` ($\text{inflation} \times 1.25$).
   - Leakage Points: $5$ points per leakage instance.
2. **Temporal Decay**:
   - If AI Max was turned off, the hangover naturally decays by `1.5%` per day after 30 days of switch-off.
   - Defaults to the current date or calculates deterministically using `campaignConfig.referenceDate`.
3. **Timeline Projection**: Estimates weeks needed to re-train Smart Bidding based on the hangover score and whether it is actively `chasing-cheap-clicks`.

---

## 3. Future Roadmap & Technical Improvements

To evolve the recovery module, several improvements are planned:

### A. Dynamic AI Synonym Expansion
* **Limitation**: Currently, synonym expansion is bound to a static local dictionary (`SYNONYM_DICTIONARY`).
* **Evolutive Plan**: Build a dynamic Stage 2 expansion request. When Gemini classifies a query, it will dynamically return the semantic synonym cluster for that vertical (e.g. "veneers" expands to "laminates", "porcelain teeth").

### B. Shared Negative Lists Integration
* **Limitation**: Negatives are currently mapped individually campaign-by-campaign.
* **Evolutive Plan**: Support Account-Level Negative Lists. If a recommendation applies to all campaigns, format it into a single Shared Negative List object structure, compatible with Google Ads Shared negative libraries.

### C. Automated Bid Caps
* **Limitation**: Bidding status flags identify anomalies, but don't provide programmatic bidding controls.
* **Evolutive Plan**: Suggest max CPC bid limits. When smart bidding is flagged as `chasing-cheap-clicks`, the module will calculate a safety bid cap (e.g. $1.5 \times \text{median converting CPC}$) to restrict the algorithm from overpaying for junk.

### D. API Webhook Ingestor
* **Limitation**: The script operates as a manual file-based CLI.
* **Evolutive Plan**: Wrap the main orchestrator in a lightweight Express.js endpoint, accepting webhook payloads directly from Google Ads API daily synchronizations.
