#!/usr/bin/env python3
"""
Fixture generator for AI Max Recovery Audit module.
Generates three scenarios:
  1. Heavy hangover (ProjectFlow PM - B2B SaaS PM tool)
  2. Mild hangover (BrightSmile Dental)
  3. No hangover baseline (Roastery Co)
"""

import csv
import json
import random
from pathlib import Path

random.seed(42)  # Reproducible output for the same generator run

OUTPUT_BASE = Path("/mnt/user-data/outputs/searchsavior_fixtures")


def make_row(term, campaign, ad_group, match_type, impressions, clicks, cost, conversions, conversion_value):
    """Build a CSV row with computed CTR and CPC."""
    ctr = round((clicks / impressions) * 100, 2) if impressions > 0 else 0
    cpc = round(cost / clicks, 2) if clicks > 0 else 0
    return {
        "search_term": term,
        "campaign": campaign,
        "ad_group": ad_group,
        "match_type": match_type,
        "impressions": impressions,
        "clicks": clicks,
        "cost": round(cost, 2),
        "conversions": conversions,
        "conversion_value": round(conversion_value, 2),
        "ctr": ctr,
        "cpc": cpc,
    }


# =============================================================================
# SCENARIO 1: HEAVY HANGOVER — ProjectFlow PM (B2B SaaS)
# =============================================================================

def scenario_heavy_hangover():
    """
    ProjectFlow PM: B2B SaaS project management for marketing agencies.
    AI Max was ON from March-May 2026. Disabled May 1.
    90 days of aggregated data (March 1 - May 30).
    Smart Bidding still chasing AI Max-trained patterns.
    """
    rows = []
    
    # Campaign names
    c_brand = "ProjectFlow - Brand"
    c_generic = "ProjectFlow - Generic - Agency PM"
    c_competitor = "ProjectFlow - Competitor"
    
    # ---------- LEGITIMATE CONVERTING TERMS (clean signal) ----------
    legit = [
        ("projectflow pm", c_brand, "Brand Terms", "EXACT", 4200, 380, 950.00, 42, 12180.00),
        ("projectflow project management", c_brand, "Brand Terms", "PHRASE", 1850, 156, 410.00, 18, 5220.00),
        ("projectflow for agencies", c_brand, "Brand Terms", "PHRASE", 920, 89, 234.00, 11, 3190.00),
        ("project management software for agencies", c_generic, "PM Tools", "PHRASE", 3800, 234, 1170.00, 14, 4060.00),
        ("agency project management tool", c_generic, "PM Tools", "PHRASE", 2400, 165, 825.00, 10, 2900.00),
        ("marketing agency project management", c_generic, "PM Tools", "EXACT", 1650, 124, 620.00, 8, 2320.00),
        ("project management tool for marketing agency", c_generic, "PM Tools", "PHRASE", 1180, 87, 435.00, 6, 1740.00),
        ("agency time tracking software", c_generic, "Time Tracking", "PHRASE", 2200, 142, 710.00, 9, 2610.00),
        ("client project tracking software", c_generic, "PM Tools", "PHRASE", 1450, 98, 490.00, 5, 1450.00),
        ("agency client billing software", c_generic, "Billing", "PHRASE", 980, 64, 320.00, 4, 1160.00),
        ("ProjectFlow vs Asana", c_competitor, "Comparison", "PHRASE", 1200, 88, 264.00, 5, 1450.00),
        ("ProjectFlow alternative", c_competitor, "Comparison", "PHRASE", 580, 42, 126.00, 3, 870.00),
    ]
    for r in legit:
        rows.append(make_row(*r))
    
    # ---------- AI MAX POLLUTED: BRAND COMPETITOR QUERIES ----------
    # Triggered by AI Max expansion into competitor terms. High cost, zero conversions.
    competitor_junk = [
        ("asana pricing", c_generic, "PM Tools", "PHRASE", 3200, 187, 580.00, 0, 0),
        ("asana review", c_generic, "PM Tools", "PHRASE", 2800, 156, 468.00, 0, 0),
        ("monday.com pricing", c_generic, "PM Tools", "PHRASE", 2400, 134, 415.00, 0, 0),
        ("monday vs asana", c_generic, "PM Tools", "PHRASE", 1800, 98, 294.00, 0, 0),
        ("clickup review", c_generic, "PM Tools", "PHRASE", 1450, 76, 228.00, 0, 0),
        ("notion project management", c_generic, "PM Tools", "PHRASE", 1200, 64, 192.00, 0, 0),
        ("trello pricing", c_generic, "PM Tools", "PHRASE", 980, 52, 156.00, 0, 0),
        ("jira alternative for agencies", c_generic, "PM Tools", "PHRASE", 720, 38, 114.00, 0, 0),
        ("basecamp vs trello", c_generic, "PM Tools", "PHRASE", 540, 28, 84.00, 0, 0),
        ("wrike pricing", c_generic, "PM Tools", "PHRASE", 410, 22, 66.00, 0, 0),
    ]
    for r in competitor_junk:
        rows.append(make_row(*r))
    
    # ---------- AI MAX POLLUTED: INFORMATIONAL QUERIES ----------
    # Job seekers, students, hobbyists. Wrong intent.
    informational_junk = [
        ("project management certification", c_generic, "PM Tools", "PHRASE", 2800, 142, 426.00, 0, 0),
        ("how to become a project manager", c_generic, "PM Tools", "PHRASE", 1900, 98, 294.00, 0, 0),
        ("project manager salary uk", c_generic, "PM Tools", "PHRASE", 1650, 84, 252.00, 0, 0),
        ("project management courses online", c_generic, "PM Tools", "PHRASE", 1450, 76, 228.00, 0, 0),
        ("what is agile project management", c_generic, "PM Tools", "PHRASE", 1200, 62, 186.00, 0, 0),
        ("project management interview questions", c_generic, "PM Tools", "PHRASE", 920, 48, 144.00, 0, 0),
        ("pmp certification cost", c_generic, "PM Tools", "PHRASE", 780, 41, 123.00, 0, 0),
        ("is project management a good career", c_generic, "PM Tools", "PHRASE", 580, 32, 96.00, 0, 0),
        ("scrum master vs project manager", c_generic, "PM Tools", "PHRASE", 510, 28, 84.00, 0, 0),
    ]
    for r in informational_junk:
        rows.append(make_row(*r))
    
    # ---------- AI MAX POLLUTED: TANGENTIAL VERTICAL ----------
    # Semantic drift into adjacent but wrong industries.
    tangential_junk = [
        ("construction project management software", c_generic, "PM Tools", "PHRASE", 2200, 118, 354.00, 0, 0),
        ("project management software for nonprofits", c_generic, "PM Tools", "PHRASE", 1450, 78, 234.00, 0, 0),
        ("project management software for schools", c_generic, "PM Tools", "PHRASE", 980, 54, 162.00, 0, 0),
        ("personal task management app", c_generic, "PM Tools", "PHRASE", 1200, 64, 192.00, 0, 0),
        ("family chore tracker app", c_generic, "PM Tools", "PHRASE", 720, 38, 114.00, 0, 0),
        ("student task management", c_generic, "PM Tools", "PHRASE", 580, 32, 96.00, 0, 0),
        ("construction scheduling software", c_generic, "PM Tools", "PHRASE", 510, 28, 84.00, 0, 0),
    ]
    for r in tangential_junk:
        rows.append(make_row(*r))
    
    # ---------- AI MAX POLLUTED: PRICE-ANCHORED LOW INTENT ----------
    # "Cheap", "free", "discount" attached to category. Almost never converts at premium price point.
    price_junk = [
        ("free project management software", c_generic, "PM Tools", "PHRASE", 4200, 234, 702.00, 0, 0),
        ("cheapest project management tool", c_generic, "PM Tools", "PHRASE", 2400, 128, 384.00, 0, 0),
        ("free agency management software", c_generic, "PM Tools", "PHRASE", 1800, 96, 288.00, 0, 0),
        ("free trello alternative", c_generic, "PM Tools", "PHRASE", 1200, 64, 192.00, 0, 0),
        ("discount project management software", c_generic, "PM Tools", "PHRASE", 580, 32, 96.00, 0, 0),
        ("free task management app", c_generic, "PM Tools", "PHRASE", 980, 52, 156.00, 0, 0),
    ]
    for r in price_junk:
        rows.append(make_row(*r))
    
    # ---------- AMBIGUOUS / LOW SIGNAL ----------
    # Low cost, sporadic conversions. Hard cases for the audit.
    ambiguous = [
        ("kanban for agencies", c_generic, "PM Tools", "PHRASE", 380, 24, 72.00, 1, 290.00),
        ("agency software 2026", c_generic, "PM Tools", "PHRASE", 240, 16, 48.00, 0, 0),
        ("project tracker for designers", c_generic, "PM Tools", "PHRASE", 320, 22, 66.00, 1, 290.00),
        ("retainer tracking software", c_generic, "PM Tools", "PHRASE", 180, 12, 36.00, 0, 0),
    ]
    for r in ambiguous:
        rows.append(make_row(*r))
    
    return rows


# =============================================================================
# SCENARIO 2: MILD HANGOVER — BrightSmile Dental
# =============================================================================

def scenario_mild_hangover():
    """
    BrightSmile Dental: General dentistry in Manchester, UK.
    AI Max was briefly ON Feb 15 - April 10, 2026.
    Some lingering CPA elevation, some patterns remaining.
    90 days aggregated.
    """
    rows = []
    
    c_general = "BrightSmile - General Dentistry"
    c_emergency = "BrightSmile - Emergency Dentist"
    
    # ---------- LEGITIMATE CONVERTING ----------
    legit = [
        ("dentist manchester", c_general, "Local Dental", "EXACT", 3200, 220, 540.00, 28, 4200.00),
        ("private dentist manchester", c_general, "Local Dental", "PHRASE", 1850, 142, 384.00, 18, 2700.00),
        ("dental check up manchester", c_general, "Local Dental", "PHRASE", 1200, 88, 220.00, 12, 1800.00),
        ("teeth whitening manchester", c_general, "Cosmetic", "PHRASE", 980, 72, 198.00, 8, 1600.00),
        ("emergency dentist manchester", c_emergency, "Emergency", "EXACT", 2400, 178, 480.00, 22, 3300.00),
        ("emergency dental appointment", c_emergency, "Emergency", "PHRASE", 1450, 108, 312.00, 14, 2100.00),
        ("dentist near me manchester", c_general, "Local Dental", "PHRASE", 1100, 82, 215.00, 9, 1350.00),
        ("dental hygienist manchester", c_general, "Hygienist", "PHRASE", 720, 54, 138.00, 7, 1050.00),
        ("brightsmile dental", c_general, "Brand", "EXACT", 580, 48, 96.00, 12, 1800.00),
        ("brightsmile manchester", c_general, "Brand", "PHRASE", 320, 28, 56.00, 7, 1050.00),
    ]
    for r in legit:
        rows.append(make_row(*r))
    
    # ---------- AI MAX POLLUTED: INFORMATIONAL ----------
    informational_junk = [
        ("dental hygienist salary uk", c_general, "Hygienist", "PHRASE", 1450, 72, 144.00, 0, 0),
        ("how to become a dentist", c_general, "Local Dental", "PHRASE", 980, 48, 96.00, 0, 0),
        ("how much does a filling cost", c_general, "Local Dental", "PHRASE", 1200, 62, 124.00, 0, 0),
        ("teeth whitening at home", c_general, "Cosmetic", "PHRASE", 1650, 88, 176.00, 0, 0),
        ("dental nurse training manchester", c_general, "Local Dental", "PHRASE", 580, 28, 56.00, 0, 0),
    ]
    for r in informational_junk:
        rows.append(make_row(*r))
    
    # ---------- AI MAX POLLUTED: TANGENTIAL VERTICAL ----------
    # Services they don't offer
    tangential_junk = [
        ("orthodontist manchester", c_general, "Local Dental", "PHRASE", 1800, 108, 216.00, 0, 0),
        ("invisalign manchester", c_general, "Local Dental", "PHRASE", 1200, 78, 156.00, 0, 0),
        ("dental implants manchester", c_general, "Local Dental", "PHRASE", 980, 64, 128.00, 0, 0),
        ("cosmetic dentist veneers manchester", c_general, "Cosmetic", "PHRASE", 720, 48, 96.00, 0, 0),
    ]
    for r in tangential_junk:
        rows.append(make_row(*r))
    
    # ---------- AI MAX POLLUTED: PRICE-ANCHORED ----------
    price_junk = [
        ("cheap dentist manchester", c_general, "Local Dental", "PHRASE", 980, 54, 108.00, 0, 0),
        ("free dental check up", c_general, "Local Dental", "PHRASE", 720, 38, 76.00, 0, 0),
        ("nhs dentist manchester", c_general, "Local Dental", "PHRASE", 2400, 142, 284.00, 0, 0),
    ]
    for r in price_junk:
        rows.append(make_row(*r))
    
    # ---------- AI MAX POLLUTED: BRAND COMPETITOR ----------
    competitor_junk = [
        ("bupa dental manchester", c_general, "Local Dental", "PHRASE", 580, 32, 64.00, 0, 0),
        ("mydentist manchester", c_general, "Local Dental", "PHRASE", 410, 22, 44.00, 0, 0),
    ]
    for r in competitor_junk:
        rows.append(make_row(*r))
    
    # ---------- AMBIGUOUS ----------
    ambiguous = [
        ("dental crown manchester", c_general, "Local Dental", "PHRASE", 320, 22, 48.00, 1, 250.00),
        ("dentist altrincham", c_general, "Local Dental", "PHRASE", 240, 18, 36.00, 2, 300.00),
    ]
    for r in ambiguous:
        rows.append(make_row(*r))
    
    return rows


# =============================================================================
# SCENARIO 3: NO HANGOVER BASELINE — Roastery Co
# =============================================================================

def scenario_no_hangover():
    """
    Roastery Co: D2C premium coffee subscription service.
    AI Max NEVER enabled. Account has been disciplined throughout.
    Clean traffic with normal background noise.
    60 days of data.
    """
    rows = []
    
    c_brand = "Roastery - Brand"
    c_subscription = "Roastery - Subscription Service"
    
    # ---------- LEGITIMATE CONVERTING ----------
    legit = [
        ("roastery co", c_brand, "Brand Terms", "EXACT", 5800, 480, 720.00, 64, 4480.00),
        ("roastery coffee subscription", c_brand, "Brand Terms", "PHRASE", 2400, 198, 396.00, 28, 1960.00),
        ("premium coffee subscription", c_subscription, "Subscription", "PHRASE", 3200, 220, 660.00, 24, 1680.00),
        ("monthly coffee subscription uk", c_subscription, "Subscription", "PHRASE", 1850, 142, 426.00, 16, 1120.00),
        ("freshly roasted coffee delivery", c_subscription, "Subscription", "PHRASE", 1450, 108, 324.00, 12, 840.00),
        ("specialty coffee subscription uk", c_subscription, "Subscription", "PHRASE", 1200, 92, 276.00, 10, 700.00),
        ("single origin coffee subscription", c_subscription, "Subscription", "PHRASE", 980, 78, 234.00, 8, 560.00),
        ("subscription coffee beans uk", c_subscription, "Subscription", "PHRASE", 1100, 84, 252.00, 9, 630.00),
        ("best coffee subscription uk", c_subscription, "Subscription", "PHRASE", 1650, 124, 372.00, 11, 770.00),
        ("ethical coffee subscription", c_subscription, "Subscription", "PHRASE", 720, 56, 168.00, 6, 420.00),
        ("artisan coffee delivery", c_subscription, "Subscription", "PHRASE", 580, 42, 126.00, 4, 280.00),
        ("250g coffee subscription", c_subscription, "Subscription", "PHRASE", 380, 32, 96.00, 4, 280.00),
        ("500g coffee subscription", c_subscription, "Subscription", "PHRASE", 320, 26, 78.00, 3, 210.00),
        ("speciality roasted beans uk", c_subscription, "Subscription", "PHRASE", 450, 36, 108.00, 4, 280.00),
        ("light roast coffee subscription", c_subscription, "Subscription", "PHRASE", 410, 32, 96.00, 3, 210.00),
        ("dark roast subscription uk", c_subscription, "Subscription", "PHRASE", 340, 28, 84.00, 3, 210.00),
    ]
    for r in legit:
        rows.append(make_row(*r))
    
    # ---------- NATURAL BACKGROUND NOISE ----------
    # Every account has some junk. The audit should NOT flag these as AI Max patterns.
    natural_noise = [
        ("coffee subscription jobs", c_brand, "Brand Terms", "PHRASE", 80, 4, 8.00, 0, 0),
        ("how to start a coffee subscription", c_subscription, "Subscription", "PHRASE", 120, 6, 12.00, 0, 0),
        ("coffee subscription gift voucher amazon", c_subscription, "Subscription", "PHRASE", 90, 5, 10.00, 0, 0),
    ]
    for r in natural_noise:
        rows.append(make_row(*r))
    
    # ---------- AMBIGUOUS (some convert, some don't) ----------
    ambiguous = [
        ("decaf coffee subscription", c_subscription, "Subscription", "PHRASE", 280, 22, 66.00, 2, 140.00),
        ("organic coffee delivery uk", c_subscription, "Subscription", "PHRASE", 320, 26, 78.00, 2, 140.00),
        ("colombian coffee subscription", c_subscription, "Subscription", "PHRASE", 220, 18, 54.00, 1, 70.00),
        ("ethiopian coffee delivery", c_subscription, "Subscription", "PHRASE", 180, 14, 42.00, 1, 70.00),
    ]
    for r in ambiguous:
        rows.append(make_row(*r))
    
    return rows


# =============================================================================
# WRITE CSV
# =============================================================================

def write_csv(rows, path):
    fieldnames = ["search_term", "campaign", "ad_group", "match_type", "impressions", "clicks", "cost", "conversions", "conversion_value", "ctr", "cpc"]
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


# =============================================================================
# CAMPAIGN CONFIGS
# =============================================================================

CAMPAIGN_CONFIG_HEAVY = {
    "accountName": "ProjectFlow PM",
    "currency": "USD",
    "monthlyBudget": 3000,
    "aiMaxStatus": "off",
    "aiMaxEnabledDate": "2026-03-01",
    "aiMaxDisabledDate": "2026-05-01",
    "preAiMaxCpa": 80,
    "campaigns": [
        {
            "campaignId": "camp-pf-001",
            "campaignName": "ProjectFlow - Brand",
            "campaignType": "SEARCH",
            "smartBiddingStrategy": "TARGET_CPA",
            "targetCpa": 80,
            "currentNegativeKeywords": [
                {"keyword": "free", "matchType": "BROAD"},
                {"keyword": "jobs", "matchType": "BROAD"}
            ]
        },
        {
            "campaignId": "camp-pf-002",
            "campaignName": "ProjectFlow - Generic - Agency PM",
            "campaignType": "SEARCH",
            "smartBiddingStrategy": "TARGET_CPA",
            "targetCpa": 80,
            "currentNegativeKeywords": [
                {"keyword": "free", "matchType": "BROAD"}
            ]
        },
        {
            "campaignId": "camp-pf-003",
            "campaignName": "ProjectFlow - Competitor",
            "campaignType": "SEARCH",
            "smartBiddingStrategy": "MAXIMIZE_CONVERSIONS",
            "currentNegativeKeywords": []
        }
    ]
}

CAMPAIGN_CONFIG_MILD = {
    "accountName": "BrightSmile Dental Practice",
    "currency": "GBP",
    "monthlyBudget": 800,
    "aiMaxStatus": "off",
    "aiMaxEnabledDate": "2026-02-15",
    "aiMaxDisabledDate": "2026-04-10",
    "preAiMaxCpa": 22,
    "campaigns": [
        {
            "campaignId": "camp-bs-001",
            "campaignName": "BrightSmile - General Dentistry",
            "campaignType": "SEARCH",
            "smartBiddingStrategy": "MAXIMIZE_CONVERSIONS",
            "currentNegativeKeywords": [
                {"keyword": "free", "matchType": "BROAD"},
                {"keyword": "jobs", "matchType": "BROAD"},
                {"keyword": "course", "matchType": "BROAD"}
            ]
        },
        {
            "campaignId": "camp-bs-002",
            "campaignName": "BrightSmile - Emergency Dentist",
            "campaignType": "SEARCH",
            "smartBiddingStrategy": "TARGET_CPA",
            "targetCpa": 28,
            "currentNegativeKeywords": []
        }
    ]
}

CAMPAIGN_CONFIG_BASELINE = {
    "accountName": "Roastery Co",
    "currency": "GBP",
    "monthlyBudget": 2500,
    "aiMaxStatus": "never-enabled",
    "aiMaxEnabledDate": None,
    "aiMaxDisabledDate": None,
    "preAiMaxCpa": None,
    "campaigns": [
        {
            "campaignId": "camp-rc-001",
            "campaignName": "Roastery - Brand",
            "campaignType": "SEARCH",
            "smartBiddingStrategy": "TARGET_ROAS",
            "targetRoas": 4.0,
            "currentNegativeKeywords": [
                {"keyword": "jobs", "matchType": "BROAD"},
                {"keyword": "wholesale", "matchType": "BROAD"},
                {"keyword": "machine", "matchType": "BROAD"}
            ]
        },
        {
            "campaignId": "camp-rc-002",
            "campaignName": "Roastery - Subscription Service",
            "campaignType": "SEARCH",
            "smartBiddingStrategy": "TARGET_ROAS",
            "targetRoas": 4.0,
            "currentNegativeKeywords": [
                {"keyword": "jobs", "matchType": "BROAD"},
                {"keyword": "free", "matchType": "PHRASE"},
                {"keyword": "amazon", "matchType": "BROAD"}
            ]
        }
    ]
}


# =============================================================================
# BUSINESS CONTEXT
# =============================================================================

BUSINESS_CONTEXT_HEAVY = """ProjectFlow PM is a B2B SaaS product offering project management software specifically designed for digital marketing agencies. Target customer is the agency owner or operations director at agencies with 10 to 50 employees managing client projects.

Pricing: $29 per user per month. Sells globally with primary markets in US, UK, and Australia.

Key differentiator: time tracking and client billing built in, removing the need for separate tools.

Not for: freelancers, students, large enterprises, non-agency businesses.
"""

BUSINESS_CONTEXT_MILD = """BrightSmile Dental is a general dental practice located in central Manchester, UK. Services include routine check-ups, fillings, hygienist appointments, teeth whitening, and emergency dental care.

Does NOT offer: orthodontics, dental implants, cosmetic surgery, Invisalign, veneers, dental nurse training.

Target customer: local residents within 5-mile radius of practice. Private patients only (no NHS).

Average customer value: £150 per visit. Premium positioning.
"""

BUSINESS_CONTEXT_BASELINE = """Roastery Co is a direct-to-consumer premium coffee subscription service based in the UK. Sells freshly roasted single-origin and blend coffees by monthly subscription, with options for 250g, 500g, or 1kg deliveries. Roasts to order.

Pricing: subscriptions start at £15 per month. Premium positioning.

Target customer: coffee enthusiasts who appreciate quality over price. Home brewers.

Does not sell: coffee equipment, accessories, instant coffee, wholesale, gift vouchers from third-party retailers.
"""


# =============================================================================
# OUTPUT SCHEMA
# =============================================================================

OUTPUT_SCHEMA = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "AI Max Recovery Audit Output",
    "description": "Structured output from the AI Max Recovery Audit module. Designed to slot into SearchSavior's existing Supabase storage and dashboard components.",
    "type": "object",
    "required": ["auditMetadata", "hangoverScore", "junkPatterns", "recommendedNegatives", "smartBiddingDiagnostics", "recoveryTimeline"],
    "additionalProperties": False,
    "properties": {
        "auditMetadata": {
            "type": "object",
            "description": "Provenance and timing information about this audit run.",
            "required": ["generatedAt", "auditVersion", "fixtureName"],
            "additionalProperties": False,
            "properties": {
                "generatedAt": {"type": "string", "format": "date-time", "description": "ISO 8601 UTC timestamp of when this audit was generated."},
                "auditVersion": {"type": "string", "description": "Semantic version of the audit module that produced this output, e.g. '0.1.0'."},
                "fixtureName": {"type": "string", "description": "Name of the input fixture or account this audit was run against."},
                "processingTimeMs": {"type": "integer", "description": "Total processing time in milliseconds.", "minimum": 0},
                "accountName": {"type": "string", "description": "Account name from campaign_config.json, useful for display."},
                "currency": {"type": "string", "description": "ISO 4217 currency code (USD, GBP, etc.).", "minLength": 3, "maxLength": 3}
            }
        },
        "hangoverScore": {
            "type": "object",
            "description": "Composite indicator of how much AI Max behaviour persists in this account.",
            "required": ["score", "category", "explanation"],
            "additionalProperties": False,
            "properties": {
                "score": {"type": "integer", "minimum": 0, "maximum": 100, "description": "0 = no hangover; 100 = severe hangover. Higher values indicate more persistent AI Max-trained behaviour."},
                "category": {"type": "string", "enum": ["none", "mild", "moderate", "severe"], "description": "Banded interpretation of score: none=0-15, mild=16-40, moderate=41-70, severe=71-100."},
                "explanation": {"type": "string", "description": "Human-readable summary of why this score was assigned. 1-3 sentences."},
                "contributingFactors": {
                    "type": "array",
                    "description": "Itemized factors that influenced the score, in descending order of impact.",
                    "items": {
                        "type": "object",
                        "required": ["factor", "weight"],
                        "additionalProperties": False,
                        "properties": {
                            "factor": {"type": "string", "description": "Short label of the factor, e.g. 'High proportion of competitor brand queries'."},
                            "weight": {"type": "number", "minimum": 0, "maximum": 1, "description": "0-1 relative weight of this factor in the composite score."},
                            "evidence": {"type": "string", "description": "One-sentence evidence supporting this factor."}
                        }
                    }
                }
            }
        },
        "junkPatterns": {
            "type": "array",
            "description": "Detected categories of junk traffic with aggregated metrics. Empty array if no patterns detected.",
            "items": {
                "type": "object",
                "required": ["category", "termCount", "totalCost", "exampleTerms"],
                "additionalProperties": False,
                "properties": {
                    "category": {"type": "string", "enum": ["brand-competitor", "informational", "tangential-vertical", "price-anchored-low-intent", "other"]},
                    "termCount": {"type": "integer", "minimum": 0, "description": "Number of distinct search terms in this category."},
                    "totalCost": {"type": "number", "minimum": 0, "description": "Sum of cost across all terms in this category, in the account currency."},
                    "totalConversions": {"type": "number", "minimum": 0, "description": "Sum of conversions across all terms in this category. Usually zero or near-zero for junk patterns."},
                    "exampleTerms": {"type": "array", "items": {"type": "string"}, "maxItems": 10, "description": "Up to 10 representative example terms from this category, for display."}
                }
            }
        },
        "recommendedNegatives": {
            "type": "array",
            "description": "Ordered list of recommended negative keywords. Order is from highest impact (most cost saved) to lowest.",
            "items": {
                "type": "object",
                "required": ["keyword", "matchType", "reason", "estimatedMonthlyWaste", "sourceCategory"],
                "additionalProperties": False,
                "properties": {
                    "keyword": {"type": "string", "description": "The negative keyword text. Do not include square brackets or quotes; just the raw term."},
                    "matchType": {"type": "string", "enum": ["EXACT", "PHRASE", "BROAD"], "description": "Recommended match type for the negative. Uppercase to match Google Ads API conventions."},
                    "reason": {"type": "string", "description": "One-sentence justification for why this negative is recommended. Will be displayed to the user."},
                    "estimatedMonthlyWaste": {"type": "number", "minimum": 0, "description": "Estimated wasted spend per month this negative would prevent, in the account currency."},
                    "sourceCategory": {"type": "string", "enum": ["brand-competitor", "informational", "tangential-vertical", "price-anchored-low-intent", "other"], "description": "Which junk pattern category this negative addresses."},
                    "confidence": {"type": "number", "minimum": 0, "maximum": 1, "description": "0-1 confidence score for this recommendation. Used by the Confidence Engine for prioritization."},
                    "applicableCampaigns": {"type": "array", "items": {"type": "string"}, "description": "Campaign IDs this negative should be added to. Empty array means account-level negative list."}
                }
            }
        },
        "smartBiddingDiagnostics": {
            "type": "object",
            "description": "Observations about Smart Bidding behaviour and whether it is still chasing AI Max-trained patterns.",
            "required": ["status", "observations"],
            "additionalProperties": False,
            "properties": {
                "status": {"type": "string", "enum": ["healthy", "elevated-cpa", "chasing-cheap-clicks", "insufficient-data"], "description": "Overall Smart Bidding health classification."},
                "currentCpa": {"type": "number", "description": "Current observed CPA across the audit window. Null if no conversions.", "minimum": 0},
                "preAiMaxCpa": {"type": "number", "description": "Reported pre-AI Max baseline CPA from campaign config. Null if AI Max never enabled or no baseline provided.", "minimum": 0},
                "cpaInflationPct": {"type": "number", "description": "Percentage difference between current and pre-AI Max CPA. Null if either value missing."},
                "cpcDistributionShift": {"type": "string", "enum": ["none", "downward", "upward", "mixed"], "description": "Direction of CPC distribution shift observed across the audit window."},
                "observations": {"type": "array", "items": {"type": "string"}, "description": "Free-form observations about the Smart Bidding behaviour. 2-5 sentences typical."}
            }
        },
        "recoveryTimeline": {
            "type": "object",
            "description": "Estimate of how long until CPA returns to pre-AI Max baseline after recommended negatives are applied.",
            "required": ["estimatedWeeks", "confidence", "explanation"],
            "additionalProperties": False,
            "properties": {
                "estimatedWeeks": {"type": "integer", "minimum": 0, "description": "Estimated weeks to recovery. 0 means already recovered or AI Max never enabled."},
                "confidence": {"type": "string", "enum": ["low", "medium", "high"], "description": "Confidence in the timeline estimate."},
                "explanation": {"type": "string", "description": "Human-readable explanation of the timeline. 1-3 sentences."},
                "milestones": {
                    "type": "array",
                    "description": "Optional week-by-week expected outcomes.",
                    "items": {
                        "type": "object",
                        "required": ["weekNumber", "expectedOutcome"],
                        "additionalProperties": False,
                        "properties": {
                            "weekNumber": {"type": "integer", "minimum": 1},
                            "expectedOutcome": {"type": "string"}
                        }
                    }
                }
            }
        }
    }
}


# =============================================================================
# MAIN
# =============================================================================

def write_scenario(folder_name, rows, campaign_config, business_context):
    folder = OUTPUT_BASE / folder_name
    folder.mkdir(parents=True, exist_ok=True)
    
    write_csv(rows, folder / "search_terms.csv")
    
    with open(folder / "campaign_config.json", "w") as f:
        json.dump(campaign_config, f, indent=2)
    
    with open(folder / "business_context.txt", "w") as f:
        f.write(business_context)


def main():
    OUTPUT_BASE.mkdir(parents=True, exist_ok=True)
    
    write_scenario("scenario-1-heavy-hangover", scenario_heavy_hangover(), CAMPAIGN_CONFIG_HEAVY, BUSINESS_CONTEXT_HEAVY)
    write_scenario("scenario-2-mild-hangover", scenario_mild_hangover(), CAMPAIGN_CONFIG_MILD, BUSINESS_CONTEXT_MILD)
    write_scenario("scenario-3-no-hangover", scenario_no_hangover(), CAMPAIGN_CONFIG_BASELINE, BUSINESS_CONTEXT_BASELINE)
    
    with open(OUTPUT_BASE / "output_schema.json", "w") as f:
        json.dump(OUTPUT_SCHEMA, f, indent=2)
    
    print("Fixtures generated successfully.")
    print(f"Output base: {OUTPUT_BASE}")


if __name__ == "__main__":
    main()
