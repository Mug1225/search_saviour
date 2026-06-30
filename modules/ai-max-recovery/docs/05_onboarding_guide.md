# Part 5: Onboarding & Integration Guide

This guide will help you install, run, verify, and integrate the AI Max Recovery Audit module into your development environment.

---

## 1. Quickstart Setup

### Prerequisites
* **Node.js**: Version 18.0.0 or higher.
* **API Key**: A Google Gemini API Key is required for production audits. During test execution (`NODE_ENV=test`), the key is optional and falls back to mock data.

### Installation
Navigate to the module directory and install the dependencies:
```bash
cd "Mugesh Task Folder/01 TASK - AI Max Guardrails"
npm install
```

### Environment Configuration
Create a `.env` file in the root of the module:
```env
GEMINI_API_KEY=your_live_api_key_here
```
Save the file. The module will automatically use the key to perform live Gemini 2.5 Flash classification. In production, if this key is missing or invalid, the module will throw an error and fail fast.

---

## 2. Executing Audits

### Run Fixture Scenarios (Automated Audit Runner)
We have pre-configured three testing scenarios representing different hangover states. To run the audits against all three scenarios and generate output JSON files, execute:
```bash
node src/index.js --run-fixtures
```

**What it does**:
* Audits Scenario 1 (ProjectFlow - Heavy Hangover) and generates `audit_output.json`.
* Audits Scenario 2 (BrightSmile - Mild Hangover) and generates `audit_output.json`.
* Audits Scenario 3 (Roastery Co - No Hangover) and generates `audit_output.json`.
* Validates all three outputs against `output_schema.json` using AJV.

### Run Custom Audits via CLI
To run an audit on your own custom campaign files, use the CLI options:
```bash
node src/index.js \
  --csv "path/to/search_terms.csv" \
  --config "path/to/campaign_config.json" \
  --context "path/to/business_context.txt" \
  --schema "Task Briefs/output_schema.json" \
  --output "path/to/custom_output.json"
```

---

## 3. Running & Adding Unit Tests

### Execute Unit Tests
To run the built-in test suite:
```bash
npm test
```
This tests CSV parsing, CPA metrics calculations, negative keyword safety checks, and AJV schema validity on Scenario 1.

### Adding New Tests
Unit tests are located in [tests/audit.test.js](file:///c:/programs/search-saviour/task-1%20AI%20hangover/Mugesh%20Task%20Folder/01%20TASK%20-%20AI%20Max%20Guardrails/tests/audit.test.js). To add a new test:
1. Open the file.
2. Add your test assertions using Node's native `assert` library.
3. Run `npm test` to verify your assertions pass.

---

## 4. Codebase Handoff & Integration

This module was built with high isolation so that it can be imported directly into SearchSavior's main system.

### A. Importing the Orchestrator
The main entry point is `runRecoveryAudit` in `src/index.js`. You can import it into another Node.js script:

```javascript
const { runRecoveryAudit } = require('./Mugesh Task Folder/01 TASK - AI Max Guardrails/src/index');

async function executeAudit() {
  try {
    const result = await runRecoveryAudit(
      './path/to/search_terms.csv',
      './path/to/campaign_config.json',
      './path/to/business_context.txt',
      './path/to/output_schema.json'
    );
    console.log("Hangover Score:", result.hangoverScore.score);
    console.log("Recommended Negatives:", result.recommendedNegatives);
  } catch (error) {
    console.error("Audit failed:", error.message);
  }
}

executeAudit();
```

### B. Integrating with a Supabase/PostgreSQL Database
The output payload conforms strictly to `output_schema.json`. To store the audits in Supabase:
1. Create a table `recovery_audits` matching the metadata schema.
2. Store the `junkPatterns` and `recommendedNegatives` arrays as `JSONB` columns.
3. Query the `hangoverScore` directly to power dashboard alerts (e.g. alert users when category is `severe`).
