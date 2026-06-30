# AI Max Recovery Audit — Test Fixtures

This bundle contains three synthetic scenarios for testing the AI Max Recovery Audit module. Each scenario is a self-contained set of three files modelling a Google Ads account at a different stage of AI Max hangover.

## Bundle structure

```
searchsavior_fixtures/
├── scenario-1-heavy-hangover/
│   ├── search_terms.csv          (48 rows)
│   ├── campaign_config.json
│   └── business_context.txt
├── scenario-2-mild-hangover/
│   ├── search_terms.csv          (26 rows)
│   ├── campaign_config.json
│   └── business_context.txt
├── scenario-3-no-hangover/
│   ├── search_terms.csv          (23 rows)
│   ├── campaign_config.json
│   └── business_context.txt
├── output_schema.json
└── README.md
```

## What each fixture file is

### `search_terms.csv`

Standard Google Ads search-term report export format, aggregated across the 90-day audit window. Columns:

| Column              | Type    | Notes                                                       |
| ------------------- | ------- | ----------------------------------------------------------- |
| search_term         | string  | The actual search query as recorded by Google Ads           |
| campaign            | string  | Campaign name the term was attributed to                    |
| ad_group            | string  | Ad group within the campaign                                |
| match_type          | string  | EXACT, PHRASE, or BROAD                                     |
| impressions         | integer |                                                             |
| clicks              | integer |                                                             |
| cost                | number  | Currency from campaign_config.json                          |
| conversions         | number  | Can be fractional if conversion weighting is used           |
| conversion_value    | number  | Total revenue attributed to this term                       |
| ctr                 | number  | Click-through rate as a percentage (e.g. 6.20)              |
| cpc                 | number  | Average cost per click                                      |

### `campaign_config.json`

Current campaign settings, including AI Max history and Smart Bidding strategy. Key fields:

- `aiMaxStatus`: `"on"`, `"off"`, or `"never-enabled"`
- `aiMaxEnabledDate` / `aiMaxDisabledDate`: ISO date strings. Null if never enabled.
- `preAiMaxCpa`: optional baseline CPA from before AI Max was turned on. Used for diagnostic comparisons.
- `campaigns[].smartBiddingStrategy`: one of `TARGET_CPA`, `TARGET_ROAS`, `MAXIMIZE_CONVERSIONS`, `MANUAL_CPC`, etc.
- `campaigns[].currentNegativeKeywords`: negatives already in place, used by the audit to avoid duplicate recommendations.

### `business_context.txt`

Free-form text describing the business, ICP, what they offer, and what they don't. Feed this to Gemini as context when classifying search term intent.

## What each scenario demonstrates

### Scenario 1: Heavy hangover (ProjectFlow PM)

B2B SaaS project management tool for marketing agencies. AI Max was enabled March-May 2026, disabled May 1. Two months on, Smart Bidding is still chasing the broad cheap-click traffic AI Max attracted.

What the audit should detect:
- High proportion of zero-conversion cost (~40% of total spend)
- All four junk pattern categories represented: brand competitor (Asana, Monday, ClickUp etc.), informational (PM courses, salary, certification), tangential vertical (construction PM, personal task apps), price-anchored (free/cheap)
- Smart Bidding CPA elevated significantly above pre-AI-Max baseline of $80
- Hangover Score: severe (71-100)

Expected output: 15-25 recommended negatives across all four pattern categories. Recovery timeline 6-12 weeks given Smart Bidding still chasing patterns.

### Scenario 2: Mild hangover (BrightSmile Dental)

Premium dental practice in Manchester. AI Max was on briefly Feb 15 - April 10. Some patterns remain but most have decayed.

What the audit should detect:
- Smaller proportion of zero-conversion cost
- Three pattern categories with smaller volumes: informational (hygienist salary, dental nurse training), tangential (orthodontics, implants — services they don't offer), price-anchored (cheap dentist, free check up), small competitor presence (Bupa, mydentist)
- Smart Bidding slightly elevated above pre-AI-Max baseline of £22
- Hangover Score: mild to moderate (16-50)

Expected output: 8-15 recommended negatives. Recovery timeline 3-6 weeks.

### Scenario 3: No hangover baseline (Roastery Co)

D2C premium coffee subscription service. AI Max never enabled. Disciplined account with proper match types and existing negative lists.

What the audit should detect:
- Clean traffic with normal background noise (some informational/competitor presence, but in low volumes that occur naturally)
- NO AI Max patterns
- Smart Bidding healthy
- Hangover Score: 0-15

Expected output: 0-3 recommended negatives at most (genuine junk like 'amazon' or 'jobs'). No recovery timeline needed (estimatedWeeks: 0).

This scenario is the control case. The audit must NOT over-flag normal background noise as AI Max hangover.

## What success looks like

A correctly working audit module should:

1. Score the three scenarios distinctly (severe / mild-moderate / none) without false positives on the baseline
2. Recommend negatives that map cleanly back to junk patterns in the CSV
3. Suggest match types appropriate to the pattern (BROAD for intent categories, PHRASE for competitor brands, EXACT for one-off junk)
4. Avoid recommending negatives that conflict with terms already converting in the CSV
5. Avoid recommending negatives that duplicate the `currentNegativeKeywords` in campaign_config.json
6. Run end-to-end in under 60 seconds per scenario

## Output format

The module's output JSON must validate against `output_schema.json` at the root of this bundle. The schema is JSON Schema draft-07 and uses camelCase keys throughout to match SearchSavior's JavaScript codebase conventions. Match types are uppercase (`EXACT`, `PHRASE`, `BROAD`) to match Google Ads API conventions.

## Notes on the data

- Numbers are realistic-looking but synthetic. They are designed to make pattern detection possible, not to reflect any real account.
- CTR and CPC columns are computed from impressions/clicks/cost. They may not always be perfectly self-consistent with floating-point rounding; use the impressions/clicks/cost values as ground truth.
- The fixtures cover the 90-day window described in the brief. Scenarios with AI Max history aggregate the entire window without temporal split. If you find you need temporal-split data for Smart Bidding diagnostics, flag this in the kickoff call.
