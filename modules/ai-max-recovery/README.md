# AI Max Recovery Audit — Technical Reference Manual

Welcome to the **AI Max Recovery Audit** module. This is a standalone, highly modular Node.js utility for identifying "AI Max matching hangover" in Google Ads search terms. It programmatically filters wastage, performs campaign-specific negative keyword diagnostics, classifies junk terms using a hybrid rule-based and LLM classification architecture, and generates a structured, schema-compliant recovery payload.

---

## 📖 Onboarding Documentation Series

For beginners and developers joining the team, we have split the product documentation into five detailed, easy-to-read guides:

* **[Part 1: Domain Guide](file:///c:/programs/search-saviour/task-1%20AI%20hangover/Mugesh%20Task%20Folder/01%20TASK%20-%20AI%20Max%20Guardrails/docs/01_domain_guide.md)**: Introduction to Google Ads, search terms, keywords, match types (Broad, Phrase, Exact), and Smart Bidding.
* **[Part 2: The Problem Guide](file:///c:/programs/search-saviour/task-1%20AI%20hangover/Mugesh%20Task%20Folder/01%20TASK%20-%20AI%20Max%20Guardrails/docs/02_problem_statement.md)**: Deep dive into the "AI Max matching hangover" problem, semantic expansion drift, and automated bidding feedback loops.
* **[Part 3: Data Specification Guide](file:///c:/programs/search-saviour/task-1%20AI%20hangover/Mugesh%20Task%20Folder/01%20TASK%20-%20AI%20Max%20Guardrails/docs/03_data_specification.md)**: Details on search terms CSV reports, campaign config JSON layouts, and the output JSON schema validation rules.
* **[Part 4: Solution Architecture & Roadmap](file:///c:/programs/search-saviour/task-1%20AI%20hangover/Mugesh%20Task%20Folder/01%20TASK%20-%20AI%20Max%20Guardrails/docs/04_solution_architecture.md)**: Details of the Stage 1 (Heuristics) and Stage 2 (Gemini LLM) processing engines, scoring algorithms, verification filters, and the technical enhancement roadmap.
* **[Part 5: Quickstart & Integration Guide](file:///c:/programs/search-saviour/task-1%20AI%20hangover/Mugesh%20Task%20Folder/01%20TASK%20-%20AI%20Max%20Guardrails/docs/05_onboarding_guide.md)**: Setting up your environment, running audits, running unit tests, and importing modules.

---

## ⚡ How the Module Calls Gemini (Fail-Fast & Test Mocking)

> [!IMPORTANT]
> **"Is the Gemini API Key required?"**
> 
> * **Production Mode**: **Yes**. In production, `GEMINI_API_KEY` must be configured in your environment variables or `.env` file. If the key is missing or the API call fails, the module will **fail fast and throw an error** to prevent serving low-quality mock data to customers.
> * **Test Mode (NODE_ENV=test)**: **Optional**. During automated testing (e.g., running `npm test`), if the API key is missing or the API call experiences errors/throttling, the module automatically activates an offline local mock classifier (`runMockClassifier`).
> 
> This is why all unit tests (`npm test`) run and pass successfully in local/CI environments even without an active key, while production deployments are safeguarded against missing keys or silent network failures.

---

## 🔄 System Flow Architecture

The audit engine processes data in a clear, linear pipeline divided into two stages:

```
[INPUT FILES] 
  ├── search_terms.csv
  ├── campaign_config.json
  └── business_context.txt
        │
        ▼
[INGESTION & PARSING] ────► Reads files, normalizes numbers, maps keys (src/parser.js)
        │
        ▼
[STAGE 1: LOCAL DIAGNOSTICS] 
  ├── Filter zero-conversion waste terms (cost > 0, conversions === 0)
  ├── Campaign Safety Engine: Prunes candidates conflicting with positive converting terms (per campaign)
  ├── Match-Type Leakage Diagnostics (Broad AND traps, Phrase order flips, Campaign gaps)
  └── Hybrid Layer Rule Classifier: Matches obvious patterns locally (free, cheap, jobs, salary)
        │
        ├── [Obvious Junk] ───────────────────────► Categorized directly as Price/Info
        └── [Tricky Fallback Candidates] 
              │
              ▼
[STAGE 2: SEMANTIC AI CLASSIFICATION] (src/gemini.js)
  ├── Live Mode: Calls Gemini 2.5 Flash using @google/genai SDK (temperature: 0.0)
  ├── Production Error Guard: Throws error and fails fast if API fails or key is missing
  └── Test Mode Fallback: Automatically falls back to mock classifier during test runs
        │
        ▼
[POST-PROCESSING VALIDATION OVERRIDES] (Layer 3 programmatic safety override engine)
        │
        ▼
[DIAGNOSTICS & SCORE ENGINE] ────► Computes CPC shift, temporal decay, Hangover Score & Timeline (src/diagnostics.js)
        │
        ▼
[SCHEMA VALIDATION] ─────────────► Validates final payload against output_schema.json using AJV (src/schemaValidator.js)
        │
        ▼
[OUTPUT JSON] ───────────────────► Returned as object or saved as audit_output.json
```

---

## 📂 Module-by-Module Directory Breakdown

Every file is fully modular, insulated, and well-documented so that Michael can easily import individual components into SearchSavior:

### 1. `src/parser.js` (Ingestion & Normalization)
* **What it does**: Reads the raw inputs from disk. Normalizes header casings, trims whitespaces, and converts metrics (e.g. click counts, spend values) into standard numbers.

### 2. `src/diagnostics.js` (Stage 1 Calculations, Leakages & Score Engine)
* **What it does**: The math and heuristics powerhouse. 
  - Separates converting and wasted spend.
  - Houses the **Campaign-Specific Safety Filter** (isConflictingWithConverting) and account-level check.
  - Houses the **Negative Leakage Analyzers** (Broad AND traps, Phrase word order flips, campaign gaps).
  - Implements the local **Rule-Based Hybrid Classifier** (for free, cheap, jobs, salary, etc.).
  - Houses the **Hangover Score Formula** (rebalanced weights, CPA multiplier, and reference-date temporal decay).

### 3. `src/gemini.js` (Stage 2 AI Classifier Wrapper)
* **What it does**: Interacts with Gemini. Consumes the business context text and fallback candidate terms, prompting Gemini to semantically classify them with structured JSON output rules. Houses the **Offline Mock Classifier Fallback** and the **Programmatic Post-Processing Validation Override**.

### 4. `src/schemaValidator.js` (Validation Compliance)
* **What it does**: Compiles the strict `output_schema.json` using the high-performance AJV validator library. Ensures any audit output generated is 100% compliant before writing or returning.

### 5. `src/index.js` (Main Orchestrator)
* **What it does**: Exposes the primary `runRecoveryAudit()` export. Sequentially coordinates the parser, Stage 1 heuristics, Stage 2 AI/Mock fallback, diagnostic aggregations, post-processing validation, and validation checks. Also houses CLI argument handlers and `--run-fixtures` automation helper.
