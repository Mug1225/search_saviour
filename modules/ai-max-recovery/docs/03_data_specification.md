# Part 3: Data Specification

This guide details the structure of the input files processed by the AI Max Recovery Audit module and the format of the output payload.

---

## 1. Input Files

An audit run requires three inputs:
1. **Search Terms Report** (`search_terms.csv`)
2. **Campaign Configuration** (`campaign_config.json`)
3. **Business Context** (`business_context.txt`)

### A. Search Terms Report (`search_terms.csv`)
This is a standard export from Google Ads representing search terms triggered over the audit period (typically a 90-day window).

**Required Headers**:
* `Search term`: The exact query typed by the user (string).
* `Campaign`: The name of the campaign that triggered the ad (string).
* `Match type`: Google's matching match type (e.g. `Broad`, `Phrase`, `Exact`).
* `Clicks`: Number of clicks received (integer).
* `Cost`: Total cost spent on this query (number, in campaign currency).
* `Conversions`: Number of conversions generated (number).

**Example CSV Structure**:
```csv
Search term,Campaign,Match type,Clicks,Cost,Conversions
nhs dentist manchester,BrightSmile - General Dentistry,Broad,24,284.00,0
cheap dentist manchester,BrightSmile - General Dentistry,Broad,12,108.00,0
emergency dentist,BrightSmile - Emergency Dentist,Phrase,15,60.00,2
```

### B. Campaign Configuration (`campaign_config.json`)
Provides historical account-level metadata, status of AI Max, and current negative keyword lists.

**Key Fields**:
* `accountName`: The name of the advertising account.
* `currency`: ISO 4217 code (e.g., `GBP`, `USD`).
* `monthlyBudget`: Total budget.
* `aiMaxStatus`: Bidding status (`on`, `off`, `never-enabled`).
* `aiMaxDisabledDate`: Date when AI Max was turned off (ISO string `YYYY-MM-DD` or `null`).
* `preAiMaxCpa`: Historical CPA baseline before matching drift (number).
* `referenceDate`: Contextual run date for historical test reproducibility (e.g., `"2026-05-30"`).
* `campaigns`: List of campaign objects:
  - `campaignId`: Unique identifier (e.g., `camp-bs-001`).
  - `campaignName`: Human name matching the CSV.
  - `smartBiddingStrategy`: (e.g., `MAXIMIZE_CONVERSIONS`, `TARGET_CPA`).
  - `currentNegativeKeywords`: Array of negative keywords currently configured in Google Ads (`keyword` and `matchType`).

**Example JSON Structure**:
```json
{
  "accountName": "BrightSmile Dental Practice",
  "currency": "GBP",
  "monthlyBudget": 800,
  "aiMaxStatus": "off",
  "aiMaxDisabledDate": "2026-04-10",
  "preAiMaxCpa": 22,
  "referenceDate": "2026-05-30",
  "campaigns": [
    {
      "campaignId": "camp-bs-001",
      "campaignName": "BrightSmile - General Dentistry",
      "currentNegativeKeywords": [
        { "keyword": "free", "matchType": "BROAD" }
      ]
    }
  ]
}
```

### C. Business Context (`business_context.txt`)
A brief plain-text description outlining who the client is, what services they offer, and what audience segments they target. This is injected directly into Gemini's system context.

**Example Context**:
```text
BrightSmile Dental Practice is a premium, private dental clinic located in Manchester, UK. 
We offer general private dentistry, root canal treatments, fillings, and cleanings. 
We DO NOT offer NHS treatments, public health services, cosmetic dentistry (such as veneers or implants), or orthodontics (Invisalign/braces). 
Target audience: Premium private patients seeking immediate clinical dental work.
```

---

## 2. Output Schema (`output_schema.json`)

The audit module outputs a single unified JSON payload. It compiles and validates against `Task Briefs/output_schema.json` using **AJV** (Another JSON Schema Validator).

### Major Output Blocks

1. **`auditMetadata`**:
   - `generatedAt`: ISO UTC timestamp.
   - `accountName` & `currency`: Mapped from config.
   - `processingTimeMs`: Performance metric.
2. **`hangoverScore`**:
   - `score`: Composite integer (`0` to `100`).
   - `category`: Banded rating (`none`, `mild`, `moderate`, `severe`).
   - `contributingFactors`: Detailed weights and evidence reasons.
3. **`junkPatterns`**:
   - Aggregated metrics (`termCount`, `totalCost`, `totalConversions`) grouped by category (`brand-competitor`, `informational`, `tangential-vertical`, `price-anchored-low-intent`, `other`). Includes up to 10 example search terms per category.
4. **`recommendedNegatives`**:
   - Ordered array of negative keyword objects:
     - `keyword`: Target negative string (lowercase, trimmed).
     - `matchType`: Recommended match type (`EXACT`, `PHRASE`, or `BROAD`).
     - `reason`: Crisp, one-sentence explanation under 15 words.
     - `estimatedMonthlyWaste`: Cost saved (de-duplicated).
     - `confidence`: Dynamic prioritization score (`0.50` to `0.99`).
     - `applicableCampaigns`: Campaign IDs where the negative should be added.
5. **`smartBiddingDiagnostics`**:
   - `status`: Smart Bidding health category (`healthy`, `chasing-cheap-clicks`, etc.).
   - `currentCpa` / `preAiMaxCpa` / `cpaInflationPct`: Calculated metrics.
   - `observations`: String arrays describing account anomalies and healthy campaigns.
6. **`recoveryTimeline`**:
   - `estimatedWeeks`: Weeks needed to re-train Smart Bidding.
   - `milestones`: Expected outcomes by week.
