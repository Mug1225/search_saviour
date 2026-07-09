# SearchSavior Monorepo — Technical Knowledge Base & Playbook

This document serves as a repository-wide reference detailing the core design choices, architectural optimizations, lessons learned, and integration paths established during the development of the **AI Max Recovery Audit** module.

---

## 🧠 Core Architectural Playbook

### 1. Hybrid Analytical Pipeline (Stage 1 & Stage 2)
To balance speed, operational cost, and intelligence, the audit engine is split into two sequential phases:
* **Stage 1 (Deterministic Heuristics - Local Node.js)**: Runs high-speed local processing. Obvious price-anchored (`free`, `cheap`, `coupon`) and informational/career terms (`job`, `resume`, `hiring`) are filtered and categorized locally. This eliminates redundant LLM calls and shields the LLM from misclassifying professional roles as brand-competitors.
* **Stage 2 (Semantic AI Classification - Gemini 2.5 Flash)**: Complex semantic queries (like adjacent service expansion or competitor brand names) are routed to Gemini only if they pass Stage 1 safety checks.

### 2. The Production "Fail-Fast" & Cache Bypass Rule
* **The Rule**: In production, the system must **fail fast** and throw an error if the Gemini API key is missing or if the API request fails, rather than falling back to simulated mock recommendations.
* **Cache Bypassing**: To eliminate cross-account data leakage and context staleness in multi-tenant environments, the local file cache (`.audit_cache.json`) is **completely bypassed** in production.
* **Test Isolation**: A mock fallback classifier and the local file cache remain active **only** during automated unit testing (activated when `process.env.NODE_ENV === 'test'`) to ensure developer and CI workflows remain green and run offline.

---

## ⚡ Key Engineering Optimizations & Safeguards

### 1. Reducing Algorithmic Loop Complexity
* **Problem**: In the campaign coverage leakage loop, verifying whether a search query was already blocked in the current campaign was being computed *inside* the inner loops for other campaigns' negative keywords:
  $$\text{Complexity: } O(\text{Queries} \times \text{Other Campaigns} \times \text{Campaign Negatives})$$
* **Solution**: Pre-calculate `isBlockedInCurrent` once per query. If a query is already blocked locally, bypass the outer campaign coverage gap checks entirely, bringing the complexity down to:
  $$\text{Complexity: } O(\text{Queries} \times \text{Campaign Negatives})$$

### 2. CPA Inflation & Score Stability
* **Zero CPA Baseline Protection**: CPA inflation percentage calculations are guarded with `preAiMaxCpa > 0` to prevent division-by-zero errors that yield `Infinity` or `NaN`.
* **AJV Schema Capping**: Any computed score that resolves to a non-finite number is defaulted to `0`, rounded, and capped between `0` and `100`, preventing AJV schema validation errors.

### 3. Punctuation, Pluralization & Whole-Word Matching Checks
* **Whole-Word Matching**: Implemented `isNegativeKeywordMatch` to enforce standard Google Ads negative match logic. It splits queries and keywords into whole-word tokens (arrays) for `BROAD` checks, and checks contiguous subarray placement for `PHRASE` checks, preventing letter-substring collisions (e.g. negative keyword `"art"` no longer blocks `"smart"`).
* **Punctuation Stripping**: Non-alphanumeric punctuation (except spaces) is stripped from both candidate keywords and converting search terms before comparison, preventing false negatives on terms like `"dentist, london"`.
* **Pluralization Rules**: Added standard English spelling variation rules (`y` $\leftrightarrow$ `ies`, e.g. `vacancy` $\leftrightarrow$ `vacancies`) to catch and de-duplicate negative recommendation variants.
* **Context-Agnostic Synonyms**: Stripped all campaign-specific or vertical-specific terms (e.g. `nhs`, `orthodontist`) from the static dictionary, keeping only generic business terms (like `free`, `cheap`, `salary`) to ensure correct multi-account compatibility.

### 4. Direct In-Memory JSON Signatures
* **Flexible Entrypoint**: The orchestrator signature:
  ```javascript
  async function runRecoveryAudit(searchTermsOrPath, campaignConfigOrPath, businessContextOrPath, schemaOrPath)
  ```
  accepts **either** local file paths or raw JS objects/arrays. This supports both local file audits (CLI/tests) and direct in-memory API integrations.

### 5. Negative Keyword Match Rules & Close-Variant Coverage Gaps
* **No Close-Variants for Negatives**: In Google Ads, negative keywords do not match close-variants (plurals, singulars, misspellings). Thus, `isAlreadyNegative` must perform exact string matching, as having `job` negative does not block `jobs`.
* **Proactive S/P Variant Expansion**: Implemented `expandGrammaticalVariants` to proactively suggest missing singular/plural variations of both recommended negatives and pre-existing campaign negatives, closing the close-variant leakage gap.

### 6. Match-Type Aware Safety Engine
* **Match-Type Aware Conflict Checks**: Refactored `isConflictingWithConverting` to accept the recommended match type (`EXACT`, `PHRASE`, `BROAD`) and call the standard match check `isNegativeKeywordMatch`. This prevents over-restrictive broad-match safety checks from discarding valid exact/phrase negative recommendations.
* **Cartesian Phrase Permutations**: Implemented `getPhraseVariations` to generate Cartesian-product permutations of multi-word phrases, ensuring that singulars/plurals in the middle of phrases (e.g. `"vacancies dental"`) are resolved correctly to check converting traffic safety.

### 7. Competitor Safety Boundary-Token Guardrails
* **Boundary-Token Heuristics**: Multi-word competitor brand extraction is guarded locally by boundary checks. If competitor brand candidates are not at the boundary (start/end) of the comparison query, local extraction is skipped and delegated to the Stage 2 LLM. This prevents the extraction of dangerous single generic words (like `"active"` from `"ProjectFlow vs Active Campaign"`).

---

## 📂 Git & Monorepo Best Practices

* **npm Workspaces Monorepo**: Structuring modules inside `modules/<module-name>/` keeps the codebase modular and ready for additional microservices.
* **Sensitive File Exclusion**: `.env` configurations, signed PDF documents, and local `.audit_cache.json` results should never be committed to git. Use a global `.gitignore` at the repository root.
* **Credential Manager authentication**: Push to GitHub using standard HTTPS remote URLs. The Git Credential Manager handles OAuth logins in the browser automatically, eliminating the need to configure SSH keys.
