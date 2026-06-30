/**
 * Stage 1: Deterministic Heuristic & Leakage Diagnostics Engine
 * 
 * This module forms the analytical core of the AI Max Recovery Audit.
 * It operates strictly locally (No AI dependencies) using Node.js to parse search queries,
 * run negative keyword safety conflict engines, detect match-type leakage patterns,
 * analyze Smart Bidding CPC shifts, and compute composite Hangover Scores with temporal decay.
 * 
 * AI (Stage 2) is strictly reserved as a fallback for advanced semantic classification,
 * ensuring maximum token efficiency, speed, and safety.
 */

const CATEGORIES = {
  COMPETITOR: 'brand-competitor',
  INFORMATIONAL: 'informational',
  TANGENTIAL: 'tangential-vertical',
  PRICE: 'price-anchored-low-intent',
  OTHER: 'other'
};

// Obvious low-intent pricing tokens used by the local rule-based classifier
const PRICE_WORDS = ['free', 'cheap', 'cheapest', 'discount', 'coupon', 'promo', 'freebie'];

// Obvious standard informational/career-oriented tokens used by the local rule-based classifier
const INFO_WORDS = ['job', 'jobs', 'career', 'careers', 'hiring', 'salary', 'salaries', 'course', 'courses', 'training', 'resume', 'intern', 'wikipedia', 'reddit', 'tutorial', 'tutorials', 'salary uk', 'master', 'manager', 'scrum', 'pmp', 'agile', 'developer', 'designer', 'director', 'certification'];

// Comparative indicator words that suggest competitor queries
const COMPARATIVE_WORDS = ['vs', 'alternative', 'alternatives', 'review', 'reviews', 'competitor', 'comparison', 'pricing'];

/**
 * Stage 1 Diagnostic Ingestion & Calculations
 */
function runStage1Diagnostics(searchTerms, campaignConfig) {
  const campaigns = campaignConfig.campaigns;
  
  // 1. Separate converting from wasted search terms
  const convertingTerms = searchTerms.filter(t => t.conversions > 0);
  const wastedTerms = searchTerms.filter(t => t.conversions === 0 && t.cost > 0);
  
  const totalSpend = searchTerms.reduce((sum, t) => sum + t.cost, 0);
  const wastedSpend = wastedTerms.reduce((sum, t) => sum + t.cost, 0);
  const totalConversions = convertingTerms.reduce((sum, t) => sum + t.conversions, 0);
  
  const currentCpa = totalConversions > 0 ? (totalSpend / totalConversions) : null;
  const preAiMaxCpa = campaignConfig.preAiMaxCpa || null;
  let cpaInflationPct = null;
  if (currentCpa !== null && preAiMaxCpa !== null && preAiMaxCpa > 0) {
    cpaInflationPct = ((currentCpa - preAiMaxCpa) / preAiMaxCpa) * 100;
  }
  
  // 2. Perform Negative keyword leakage & failure diagnostics
  const leakageDetections = runLeakageDiagnostics(searchTerms, campaigns);
  
  // 3. Programmatic (Rule-Based) Classification of Candidate Negatives
  const localRecommendations = [];
  const fallbackCandidates = []; // Handed over to Stage 2 LLM
  
  wastedTerms.forEach(term => {
    const query = term.search_term.toLowerCase().trim();
    const campaignId = getCampaignIdByName(term.campaign, campaigns);
    const campaignObj = campaigns.find(c => c.campaignId === campaignId);
    
    // Safety check: Don't recommend any negative that conflicts with successfully converting terms in the same campaign!
    if (isConflictingWithConverting(query, convertingTerms, term.campaign)) {
      return; // Pruned for safety
    }
    
    // Optimization 4: Local Competitor Comparison Extractor
    // Programmatically check if the query contains competitor brand markers (vs, alternative, review)
    // E.g., 'ProjectFlow vs Monday' extracts 'monday'.
    let isLocalCompetitor = false;
    let extractedCompetitor = null;
    
    const tokens = query.split(/\s+/);
    const comparativeTokenIndex = tokens.findIndex(t => COMPARATIVE_WORDS.includes(t));
    
    if (comparativeTokenIndex !== -1) {
      // Find the adjacent tokens representing the brand
      // E.g., 'ProjectFlow vs Monday' -> index of vs is 1, next is Monday (index 2)
      // Check surrounding tokens that are not our brand, campaign name, or generic words
      const adjacentTokens = [];
      if (comparativeTokenIndex > 0) adjacentTokens.push(tokens[comparativeTokenIndex - 1]);
      if (comparativeTokenIndex < tokens.length - 1) adjacentTokens.push(tokens[comparativeTokenIndex + 1]);
      
      const ourBrandWords = campaignConfig.accountName.toLowerCase().split(/\s+/);
      const possibleBrands = adjacentTokens.filter(tok => {
        return !ourBrandWords.includes(tok) && 
               !PRICE_WORDS.includes(tok) && 
               !INFO_WORDS.includes(tok) &&
               tok.length > 2;
      });
      
      if (possibleBrands.length > 0) {
        extractedCompetitor = possibleBrands[0];
        isLocalCompetitor = true;
      }
    }
    
    // Check local price-anchored patterns
    const priceMatch = PRICE_WORDS.find(word => query.includes(word));
    // Check local informational patterns
    const infoMatch = INFO_WORDS.find(word => query.includes(word));
    
    if (isLocalCompetitor && extractedCompetitor) {
      if (!isAlreadyNegative(extractedCompetitor, campaignObj, 'PHRASE')) {
        localRecommendations.push({
          keyword: extractedCompetitor,
          matchType: 'PHRASE',
          reason: `Programmatically identified competitor brand '${extractedCompetitor}' in comparison search query '${query}'.`,
          estimatedMonthlyWaste: term.cost,
          sourceCategory: CATEGORIES.COMPETITOR,
          confidence: 0.95,
          applicableCampaigns: campaignId ? [campaignId] : []
        });
      }
    } else if (priceMatch) {
      // Check duplicate negative keyword
      if (!isAlreadyNegative(priceMatch, campaignObj, 'BROAD')) {
        localRecommendations.push({
          keyword: priceMatch,
          matchType: 'BROAD',
          reason: `Obvious price-anchored junk word '${priceMatch}' found in zero-conversion search term.`,
          estimatedMonthlyWaste: term.cost, // direct cost mapping
          sourceCategory: CATEGORIES.PRICE,
          confidence: 0.95,
          applicableCampaigns: campaignId ? [campaignId] : []
        });
      }
    } else if (infoMatch) {
      if (!isAlreadyNegative(infoMatch, campaignObj, 'BROAD')) {
        localRecommendations.push({
          keyword: infoMatch,
          matchType: 'BROAD',
          reason: `Obvious low-intent informational word '${infoMatch}' found in job/career search.`,
          estimatedMonthlyWaste: term.cost, // direct cost mapping
          sourceCategory: CATEGORIES.INFORMATIONAL,
          confidence: 0.95,
          applicableCampaigns: campaignId ? [campaignId] : []
        });
      }
    } else {
      // Falls back to Stage 2 (Gemini LLM) for advanced competitor and semantic drift detection
      fallbackCandidates.push(term);
    }
  });

  // Group duplicate recommended local negatives across the same campaign to sum waste
  const deduplicatedLocalRecommendations = deduplicateRecommendations(localRecommendations);

  // 4. Optimization 3: Median-Based CPC Distribution Shift Analysis
  const convertingCpcs = convertingTerms.map(t => t.cpc).filter(cpc => cpc > 0);
  const wastedCpcs = wastedTerms.map(t => t.cpc).filter(cpc => cpc > 0);
  
  const medianConvertingCpc = getMedian(convertingCpcs);
  const medianWastedCpc = getMedian(wastedCpcs);
  
  let cpcDistributionShift = 'none';
  if (medianConvertingCpc > 0 && medianWastedCpc > 0) {
    const ratio = medianWastedCpc / medianConvertingCpc;
    if (ratio < 0.8) {
      cpcDistributionShift = 'downward'; // Junk is statistically much cheaper
    } else if (ratio > 1.2) {
      cpcDistributionShift = 'upward';
    } else {
      cpcDistributionShift = 'mixed';
    }
  }

  // 5. Smart Bidding Health Classification
  let smartBiddingStatus = 'healthy';
  const hasAiMaxHistory = campaignConfig.aiMaxStatus !== 'never-enabled';
  
  if (!hasAiMaxHistory) {
    smartBiddingStatus = 'healthy';
  } else if (totalSpend === 0 || totalConversions === 0) {
    smartBiddingStatus = 'insufficient-data';
  } else if (cpaInflationPct > 15) {
    if (cpcDistributionShift === 'downward') {
      smartBiddingStatus = 'chasing-cheap-clicks';
    } else {
      smartBiddingStatus = 'elevated-cpa';
    }
  } else {
    smartBiddingStatus = 'healthy';
  }

  // 6. Hangover Score Computation (0-100)
  const scoreResult = calculateHangoverScore(
    campaignConfig,
    wastedSpend,
    totalSpend,
    cpaInflationPct,
    leakageDetections
  );

  // 7. Recovery Timeline Estimate
  const recoveryTimeline = calculateRecoveryTimeline(
    scoreResult.score,
    smartBiddingStatus,
    campaignConfig.aiMaxStatus
  );

  return {
    totalSpend,
    wastedSpend,
    totalConversions,
    currentCpa,
    preAiMaxCpa,
    cpaInflationPct,
    cpcDistributionShift,
    smartBiddingStatus,
    hangoverScore: scoreResult,
    recoveryTimeline,
    localRecommendations: deduplicatedLocalRecommendations,
    fallbackCandidates,
    leakageDetections
  };
}

/**
 * Helper to calculate median value from a numeric array.
 * Immune to single generic outlier click values.
 */
function getMedian(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Runs negative keyword "leakage" diagnostics to find match-type failures.
 */
function runLeakageDiagnostics(searchTerms, campaigns) {
  const leaks = [];

  searchTerms.forEach(term => {
    const query = term.search_term.toLowerCase().trim();
    const campaignId = getCampaignIdByName(term.campaign, campaigns);
    const campaignObj = campaigns.find(c => c.campaignId === campaignId);
    
    if (!campaignObj) return;

    const negatives = campaignObj.currentNegativeKeywords || [];

    // Pre-calculate if the query is already blocked in the current campaign
    const isBlockedInCurrent = negatives.some(n => {
      const nKw = n.keyword.toLowerCase().trim();
      if (n.matchType === 'BROAD') return nKw.split(/\s+/).every(tok => query.includes(tok));
      if (n.matchType === 'PHRASE') return query.includes(nKw);
      if (n.matchType === 'EXACT') return query === nKw;
      return false;
    });

    negatives.forEach(neg => {
      const negKeyword = neg.keyword.toLowerCase().trim();
      
      // 1. Broad AND Trap check: negative broad has multiple words, but search query only had one
      if (neg.matchType === 'BROAD' && negKeyword.includes(' ')) {
        const tokens = negKeyword.split(/\s+/);
        const matchedTokens = tokens.filter(tok => query.includes(tok));
        
        // If query has some but not all of the tokens, it triggered because of the AND logic!
        if (matchedTokens.length > 0 && matchedTokens.length < tokens.length) {
          leaks.push({
            type: 'broad-and-trap',
            search_term: term.search_term,
            campaign: term.campaign,
            negative_keyword: neg.keyword,
            evidence: `Query matched keywords [${matchedTokens.join(', ')}] but slipped through broad negative '${neg.keyword}' because it lacks [${tokens.filter(tok => !query.includes(tok)).join(', ')}] due to Broad AND logic.`
          });
        }
      }

      // 2. Phrase match word order check
      if (neg.matchType === 'PHRASE') {
        const tokens = negKeyword.split(/\s+/);
        // If all words are present but order has flipped or split
        const allPresent = tokens.every(tok => query.includes(tok));
        if (allPresent && !query.includes(negKeyword)) {
          leaks.push({
            type: 'phrase-word-order-failure',
            search_term: term.search_term,
            campaign: term.campaign,
            negative_keyword: neg.keyword,
            evidence: `Query contains all words in phrase negative '${neg.keyword}', but in a different order or split, letting the query trigger.`
          });
        }
      }
    });

    // 3. Campaign Coverage Gap Check
    // If it is already blocked in the current campaign, there is no coverage gap.
    if (!isBlockedInCurrent) {
      campaigns.forEach(otherCamp => {
        if (otherCamp.campaignId === campaignId) return;
        const otherNegs = otherCamp.currentNegativeKeywords || [];
        otherNegs.forEach(otherNeg => {
          const otherNegKeyword = otherNeg.keyword.toLowerCase().trim();
          // Check if otherNeg would block this query
          let wouldBlock = false;
          if (otherNeg.matchType === 'BROAD') {
            wouldBlock = otherNegKeyword.split(/\s+/).every(tok => query.includes(tok));
          } else if (otherNeg.matchType === 'PHRASE') {
            wouldBlock = query.includes(otherNegKeyword);
          } else if (otherNeg.matchType === 'EXACT') {
            wouldBlock = query === otherNegKeyword;
          }

          if (wouldBlock) {
            leaks.push({
              type: 'campaign-coverage-gap',
              search_term: term.search_term,
              campaign: term.campaign,
              negative_keyword: otherNeg.keyword,
              evidence: `Junk term triggered under '${term.campaign}', which lacks negative '${otherNeg.keyword}' that is already active in '${otherCamp.campaignName}'.`
            });
          }
        });
      });
    }
  });

  return leaks;
}

/**
 * The Safety Engine: Verifies that a candidate negative does NOT conflict with converting traffic.
 * 
 * Optimization 2: Singular and Plural checking.
 * Checks both the proposed keyword and its singular/plural variations (e.g. 'jobs' vs 'job')
 * to ensure that neither blocks profitable, converting keywords.
 */
function isConflictingWithConverting(candidateKeyword, convertingTerms, campaignName) {
  const normalizedCandidate = candidateKeyword.toLowerCase().trim();
  const variations = getSingularPluralVariations(normalizedCandidate);
  
  // Strictly check conflicts within the SAME campaign (campaign-specific target boundary check)
  // or across ALL campaigns if campaignName is not provided (cross-campaign/account-level check)
  const campaignConverting = campaignName 
    ? convertingTerms.filter(t => t.campaign === campaignName)
    : convertingTerms;

  return campaignConverting.some(convertingTerm => {
    const normConverting = convertingTerm.search_term.toLowerCase().trim();
    
    // Check direct and variant conflicts
    for (let variant of variations) {
      // Clean punctuation for safe word matching to avoid false negative conflicts
      const cleanVariant = variant.replace(/[^\w\s]/g, '').trim();
      const cleanConverting = normConverting.replace(/[^\w\s]/g, '').trim();
      
      if (cleanConverting === cleanVariant) return true;
      
      const words = cleanVariant.split(/\s+/).filter(Boolean);
      const convertingWords = cleanConverting.split(/\s+/).filter(Boolean);
      
      if (words.length > 0 && words.every(w => convertingWords.includes(w))) {
        return true;
      }
    }

    return false;
  });
}

/**
 * Generates both singular and plural forms of a given string.
 * Supports basic 'y' <-> 'ies' spelling rules.
 */
function getSingularPluralVariations(keyword) {
  const variations = [keyword];
  const kw = keyword.toLowerCase().trim();
  
  if (kw.endsWith('s') && kw.length > 3) {
    if (kw.endsWith('ies')) {
      variations.push(kw.slice(0, -3) + 'y'); // e.g. vacancies -> vacancy
    } else {
      variations.push(kw.slice(0, -1)); // e.g. jobs -> job
    }
  } else if (kw.length > 2) {
    if (kw.endsWith('y')) {
      variations.push(kw.slice(0, -1) + 'ies'); // e.g. agency -> agencies
    } else {
      variations.push(kw + 's'); // e.g. job -> jobs
    }
  }
  return variations;
}

/**
 * Checks if a negative keyword is already configured in a campaign.
 */
function isAlreadyNegative(keyword, campaignObj, recommendedMatchType = 'EXACT') {
  if (!campaignObj || !campaignObj.currentNegativeKeywords) return false;
  const keywordVariants = getSingularPluralVariations(keyword.toLowerCase().trim());
  return campaignObj.currentNegativeKeywords.some(neg => {
    const negKeyword = neg.keyword.toLowerCase().trim();
    if (keywordVariants.includes(negKeyword)) {
      const existingMatchType = (neg.matchType || 'BROAD').toUpperCase();
      const recMatchType = recommendedMatchType.toUpperCase();
      
      if (existingMatchType === 'BROAD') return true;
      if (existingMatchType === 'PHRASE' && (recMatchType === 'PHRASE' || recMatchType === 'EXACT')) return true;
      if (existingMatchType === 'EXACT' && recMatchType === 'EXACT') return true;
    }
    return false;
  });
}

/**
 * Deduplicates recommended negatives across identical campaigns.
 */
function deduplicateRecommendations(recs) {
  const grouped = {};
  recs.forEach(rec => {
    const key = `${rec.keyword}_${rec.matchType}_${(rec.applicableCampaigns || []).join(',')}`;
    if (!grouped[key]) {
      grouped[key] = { ...rec };
    } else {
      grouped[key].estimatedMonthlyWaste += rec.estimatedMonthlyWaste;
    }
  });
  return Object.values(grouped);
}

/**
 * Helper to fetch a Campaign ID using its human-readable Campaign Name.
 */
function getCampaignIdByName(campaignName, campaigns) {
  const match = campaigns.find(c => c.campaignName === campaignName);
  return match ? match.campaignId : '';
}

/**
 * Calculates Hangover Score (0-100) and Banded Category
 */
function calculateHangoverScore(config, wastedSpend, totalSpend, cpaInflationPct, leaks) {
  if (config.aiMaxStatus === 'never-enabled') {
    // Control case
    return {
      score: 5,
      category: 'none',
      explanation: 'AI Max has never been enabled on this account. Bidding and match patterns represent standard background noise.',
      contributingFactors: []
    };
  }

  let score = 0;
  const factors = [];

  // 1. Waste Ratio Impact (Max 40 points)
  const wasteRatio = totalSpend > 0 ? (wastedSpend / totalSpend) : 0;
  const wastePoints = Math.min(Math.round(wasteRatio * 100), 40);
  if (wastePoints > 0) {
    score += wastePoints;
    factors.push({
      factor: 'High proportion of zero-conversion waste',
      weight: 0.4,
      evidence: `Wasted spend on zero-conversion terms accounts for ${Math.round(wasteRatio * 100)}% of total budget.`
    });
  }

  // 2. CPA Inflation Impact (Max 40 points)
  if (cpaInflationPct !== null && cpaInflationPct > 0) {
    const cpaPoints = Math.min(Math.round(cpaInflationPct * 1.25), 40);
    if (cpaPoints > 0) {
      score += cpaPoints;
      factors.push({
        factor: 'CPA inflation above baseline',
        weight: 0.4,
        evidence: `Current observed CPA is ${Math.round(cpaInflationPct)}% higher than historical pre-AI Max baseline.`
      });
    }
  }

  // 3. Leakage matches and match type failures (Max 20 points)
  if (leaks.length > 0) {
    const leakPoints = Math.min(leaks.length * 5, 20);
    score += leakPoints;
    factors.push({
      factor: 'Negative match type leakages',
      weight: 0.2,
      evidence: `Detected ${leaks.length} instance(s) where existing negatives failed to block junk terms due to match type limitations.`
    });
  }

  // 4. Temporal Decay Factor (Hangover naturally decays over time after AI Max is turned off)
  let decayFactor = 1.0;
  if (config.aiMaxDisabledDate) {
    // Reference date represents the end of the historical 90-day window
    const refDate = config.referenceDate ? new Date(config.referenceDate) : new Date();
    const disabledDate = new Date(config.aiMaxDisabledDate);
    const daysSinceDisable = (refDate - disabledDate) / (1000 * 60 * 60 * 24);
    
    // Hangover naturally decays after 30 days of switch-off by 1.5% per day
    if (daysSinceDisable > 30) {
      decayFactor = Math.max(0.4, 1.0 - (daysSinceDisable - 30) * 0.015);
    }
  }

  score = Math.round(score * decayFactor);

  // Cap score at 100, ensure not NaN or Infinity, and min is 0
  if (isNaN(score) || !isFinite(score)) {
    score = 0;
  }
  score = Math.max(0, Math.min(score, 100));

  // Banding categories: none=0-15, mild=16-40, moderate=41-70, severe=71-100
  let category = 'none';
  let explanation = '';

  if (score >= 71) {
    category = 'severe';
    explanation = 'Severe AI Max hangover detected. Widespread semantic expansions have polluted bidding signals, and Smart Bidding is aggressively chasing cheap, zero-conversion traffic.';
  } else if (score >= 41) {
    category = 'moderate';
    explanation = 'Moderate AI Max hangover detected. Significant leakages and CPA inflation exist, but legacy keyword patterns are decaying.';
  } else if (score >= 16) {
    category = 'mild';
    explanation = 'Mild AI Max hangover detected. Some lingering search query drift exists, but Smart Bidding signals are mostly intact.';
  } else {
    category = 'none';
    explanation = 'Healthy account with standard search query matching. No major AI Max patterns detected.';
  }

  // Sort contributing factors by weight descending
  factors.sort((a, b) => b.weight - a.weight);

  return {
    score,
    category,
    explanation,
    contributingFactors: factors
  };
}

/**
 * Projects recovery timelines and expected weekly milestones.
 */
function calculateRecoveryTimeline(score, smartBiddingStatus, aiMaxStatus) {
  if (score <= 15 || aiMaxStatus === 'never-enabled') {
    return {
      estimatedWeeks: 0,
      confidence: 'high',
      explanation: 'Account is healthy. No recovery period needed.',
      milestones: []
    };
  }

  let estimatedWeeks = 4;
  let confidence = 'medium';
  
  if (score >= 71) {
    estimatedWeeks = 8;
    confidence = 'high';
  } else if (score >= 41) {
    estimatedWeeks = 5;
    confidence = 'medium';
  } else {
    estimatedWeeks = 3;
    confidence = 'medium';
  }

  // Smart bidding chasing cheap clicks increases recovery period
  if (smartBiddingStatus === 'chasing-cheap-clicks') {
    estimatedWeeks += 2;
  }

  let explanation = `Applying the recommended negative keywords will stop immediate waste. Smart Bidding will require approximately ${estimatedWeeks} weeks to re-train on clean, high-intent converting traffic and stabilize the CPA.`;

  const milestones = [
    {
      weekNumber: 1,
      expectedOutcome: 'Apply recommended negative keywords. Zero-conversion waste is cut immediately.'
    },
    {
      weekNumber: Math.round(estimatedWeeks / 2),
      expectedOutcome: 'Smart Bidding begins to stop bidding on cheap click patterns and redirects budget to converting terms.'
    },
    {
      weekNumber: estimatedWeeks,
      expectedOutcome: 'Observed CPA stabilizes and returns close to pre-AI Max baseline levels.'
    }
  ];
 
   return {
     estimatedWeeks,
     confidence,
     explanation,
     milestones
   };
 }
 
 const SYNONYM_DICTIONARY = {
   free: ['freebie', 'complimentary', 'no-cost', 'gratis', 'zero-cost'],
   cheap: ['cheapest', 'inexpensive', 'bargain'],
   jobs: ['job', 'career', 'careers', 'hiring', 'employment', 'internship', 'intern', 'salary', 'salaries', 'vacancy', 'vacancies'],
   job: ['jobs', 'career', 'careers', 'hiring', 'employment', 'internship', 'intern', 'salary', 'salaries', 'vacancy', 'vacancies'],
   salary: ['jobs', 'job', 'careers', 'career', 'hiring', 'recruitment', 'vacancies', 'vacancy', 'wages', 'wage'],
   nhs: ['free dentist', 'nhs dental', 'nhs dentist manchester'],
   orthodontist: ['orthodontics', 'braces', 'invisalign'],
   implant: ['implants', 'veneers', 'veneer', 'crown', 'crowns']
 };
 
 /**
  * Closes "The Synonym Gap" (PRD & Gotcha 1 of Match Types Cheat Sheet)
  * Recommends the complete synonym cluster for identified category-defining negatives
  * to prevent future semantic drift leakages.
  */
 function expandNegativeSynonyms(recommendations, searchTerms, campaignConfig) {
   const campaigns = campaignConfig.campaigns;
   const expandedRecs = [...recommendations];
   const convertingTerms = searchTerms.filter(t => t.conversions > 0);
 
   recommendations.forEach(rec => {
     const term = rec.keyword.toLowerCase().trim();
     const synonyms = SYNONYM_DICTIONARY[term] || [];
 
     synonyms.forEach(syn => {
       // Check if this synonym is already in our recommendations list
       const alreadyRecommended = expandedRecs.some(r => r.keyword === syn && (r.applicableCampaigns || []).join(',') === (rec.applicableCampaigns || []).join(','));
       if (alreadyRecommended) return;
 
       // Campaign boundary: Check if it's already active or conflicts
       const campaignId = rec.applicableCampaigns[0];
       if (!campaignId) return;
 
       const campaignObj = campaigns.find(c => c.campaignId === campaignId);
       if (!campaignObj) return;
 
       // Verify it is not already negative in the campaign
       if (isAlreadyNegative(syn, campaignObj, rec.matchType)) return;
 
       // Verify it does not conflict with active converting terms in that campaign
       if (isConflictingWithConverting(syn, convertingTerms, campaignObj.campaignName)) return;
 
       // Add as a prophylactic synonym recommendation
       expandedRecs.push({
         keyword: syn,
         matchType: rec.matchType,
         reason: `Prophylactic synonym block for '${rec.keyword}' to close the synonym gap and prevent future budget leakages.`,
         estimatedMonthlyWaste: 0.00, // $0.00 as it is a preventative block
         sourceCategory: rec.sourceCategory,
         confidence: parseFloat((rec.confidence * 0.9).toFixed(2)), // slightly lower confidence as it is preventative
         applicableCampaigns: [campaignId]
       });
     });
   });
 
   return expandedRecs;
 }
 
 module.exports = {
   runStage1Diagnostics,
   expandNegativeSynonyms,
   isAlreadyNegative,
   isConflictingWithConverting,
   CATEGORIES
 };
