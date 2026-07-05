# Code Inspection Playbook

This guide outlines how to manually navigate, inspect, and verify the **AI Max Recovery Audit** codebase. Use this as a map to understand the flow and verify logic correctness step-by-step.

---

## 🗺️ Step 1: Start at the Orchestrator (`src/index.js`)
The logical entry point is the `runRecoveryAudit` function in [src/index.js](file:///c:/programs/search-saviour/task-1%20AI%20hangover/search_saviour/modules/ai-max-recovery/src/index.js#L21). It controls the execution sequence:

1. **Ingestion (L24-34)**: Converts inputs (paths or objects) into standard JavaScript structures using `parser.js`.
2. **Stage 1 (L36-37)**: Evaluates deterministic heuristics, calculations, and local rule matching using `diagnostics.js`.
3. **Stage 2 (L39-44)**: Passes fallback terms to `gemini.js` for semantic classification.
4. **Post-Processing (L46-95)**: Combines recommendations, applies formatting filters, and strips duplicates.
5. **Validation (L97-128)**: Runs campaign-level and account-level safety checks to prevent converting-traffic conflicts.
6. **Cost Reconciliation (L130-167)**: Allocates wasted costs to prevent double-counting.
7. **JSON Schema Check (L230-235)**: Confirms the output structure complies with the AJV schema before returning.

---

## 🛠️ Step 2: Inspect Specific Logic Areas

### 1. Ingestion & Input Normalization 
* **File**: [src/parser.js](file:///c:/programs/search-saviour/task-1%20AI%20hangover/search_saviour/modules/ai-max-recovery/src/parser.js)
* **What to inspect**: 
  - `cleanNumber()`: Strips currency symbols (`$, £, €, %`) and commas to prevent `NaN` conversion issues.
  - Header mapping loop in `parseSearchTerms()`: Converts arbitrary capitalizations (e.g. `"Search term"`) to snake_case (`search_term`).

### 2. Whole-Word Negative Match Logic
* **File**: [src/diagnostics.js](file:///c:/programs/search-saviour/task-1%20AI%20hangover/search_saviour/modules/ai-max-recovery/src/diagnostics.js#L31-L57)
* **What to inspect**:
  - `isNegativeKeywordMatch()`: Strips punctuation, tokenizes query strings, and evaluates broad, phrase, and exact matches. 
  - Verify that it prevents letter-substring matches (e.g., negative `"art"` does not block query `"smart"`).

### 3. Local Junk Filters (No AI)
* **File**: [src/diagnostics.js](file:///c:/programs/search-saviour/task-1%20AI%20hangover/search_saviour/modules/ai-max-recovery/src/diagnostics.js#L95-L110)
* **What to inspect**:
  - Verification that obvious pricing words (`PRICE_WORDS`) and informational keywords (`INFO_WORDS`) are matched as whole-word tokens (`queryTokens.includes(word)`) to prevent false positive matches on words like `"managerial"`.

### 4. Cache Eviction & Production Fail-Fast Guards
* **File**: [src/gemini.js](file:///c:/programs/search-saviour/task-1%20AI%20hangover/search_saviour/modules/ai-max-recovery/src/gemini.js#L92-L100)
* **What to inspect**:
  - The `apiKey` check: verify it throws a strict error in production instead of silently using the local mock fallback.
  - The `useCache` check: verify it evaluates to `false` in production, bypassing local disk reads/writes.

---

## 📊 Step 3: Run Manual Audits and Inspect Outputs

To manually execute and inspect the outputs on the three sample scenarios:

1. **Navigate to the module folder**:
   ```bash
   cd modules/ai-max-recovery
   ```
2. **Execute the Scenario Runner**:
   ```bash
   node src/index.js --run-fixtures
   ```
3. **Inspect the Output JSON files**:
   Open the scenario folders inside `Task Briefs/searchsavior_input_fixtures/` (e.g., [scenario-1-heavy-hangover/audit_output.json](file:///c:/programs/search-saviour/task-1%20AI%20hangover/search_saviour/modules/ai-max-recovery/Task%20Briefs/searchsavior_input_fixtures/scenario-1-heavy-hangover/audit_output.json)).
   * Check the `hangoverScore` object for score, category, and contributing factors.
   * Verify the `recommendedNegatives` list has single-sentence professional justifications under 15 words.
   * Verify the `junkPatterns` aggregation has zero double-counting.
