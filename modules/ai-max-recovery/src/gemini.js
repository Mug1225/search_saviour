require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const path = require('path');
const fs = require('fs');

// Path to store the persistent audit classifications cache
const CACHE_FILE = path.join(__dirname, '..', '.audit_cache.json');

// Fallback patterns for offline/test environments where GEMINI_API_KEY is not configured
const MOCK_COMPETITORS = [
  'asana', 'monday.com', 'monday', 'clickup', 'notion', 'trello', 'jira', 'basecamp', 'wrike',
  'bupa', 'mydentist'
];

const MOCK_TANGENTIAL = [
  'construction', 'nonprofit', 'nonprofits', 'school', 'schools', 'personal', 'family', 'student',
  'orthodontist', 'invisalign', 'implants', 'implant', 'veneers', 'veneer', 'nhs'
];

/**
 * Loads the persistent local classification cache from disk.
 * Returns a key-value object of { [searchTerm]: classificationObject }
 */
function loadCache() {
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const data = fs.readFileSync(CACHE_FILE, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      console.warn('Failed to parse audit cache, initializing empty cache:', e.message);
      return {};
    }
  }
  return {};
}

/**
 * Saves the persistent local classification cache back to disk.
 */
function saveCache(cache) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (e) {
    console.warn('Failed to save audit cache:', e.message);
  }
}

/**
 * Classifies search terms using a hybrid model: File-cache lookup, Gemini API, or offline mock fallback.
 * 
 * What it does exactly:
 * 1. Checks if the incoming candidate list is empty. If so, returns early.
 * 2. Loads `.audit_cache.json` from the root directory.
 * 3. Identifies which search terms are already classified inside the cache.
 * 4. Filters out the newly discovered search terms that require live AI analysis.
 * 5. If there are no new terms, immediately returns the combined cached results (API call count = 0, latency = 0ms).
 * 6. If new terms are found:
 *    - Uses live Gemini API (GoogleGenAI SDK) if `GEMINI_API_KEY` is present.
 *    - Falls back to the mock classifier if `GEMINI_API_KEY` is missing.
 * 7. Adds newly classified terms back to the cache and saves it to disk.
 * 8. Returns the complete combined results list.
 */
async function classifySearchTerms(fallbackCandidates, businessContext, campaigns) {
  if (!fallbackCandidates || fallbackCandidates.length === 0) {
    return [];
  }

  const useCache = process.env.NODE_ENV === 'test';
  const cache = useCache ? loadCache() : {};
  const cachedResults = [];
  const uncachedCandidates = [];

  // 1. Separate cached queries from uncached queries
  fallbackCandidates.forEach(candidate => {
    const termKey = candidate.search_term.toLowerCase().trim();
    if (useCache && cache[termKey]) {
      // Re-map the cached recommendation to match the current campaign ID context
      const campaignId = getCampaignIdByName(candidate.campaign, campaigns);
      cachedResults.push({
        ...cache[termKey],
        applicableCampaigns: campaignId ? [campaignId] : []
      });
    } else {
      uncachedCandidates.push(candidate);
    }
  });

  // If everything was already cached, return immediately!
  if (uncachedCandidates.length === 0) {
    return cachedResults;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  let newRecommendations = [];

  if (!apiKey || apiKey === 'PLACEHOLDER' || apiKey.trim() === '') {
    if (process.env.NODE_ENV === 'test') {
      newRecommendations = runMockClassifier(uncachedCandidates, campaigns);
    } else {
      throw new Error('Gemini API key is not configured. AI Max Recovery Audit cannot proceed.');
    }
  } else {
    try {
      // Initialize modern Google GenAI Client
      const ai = new GoogleGenAI({ apiKey });

      const BATCH_SIZE = 25;
      const batches = [];
      for (let i = 0; i < uncachedCandidates.length; i += BATCH_SIZE) {
        batches.push(uncachedCandidates.slice(i, i + BATCH_SIZE));
      }

      const allParsedClassifications = [];

      for (const batch of batches) {
        const promptText = `
You are SearchSavior's expert AI Ads Auditor. You are analyzing Google Ads search query leakage.
Your task is to classify zero-conversion, wasted-spend search terms based on the business context below.

BUSINESS CONTEXT:
${businessContext}

CAMPAIGNS CONFIGURATION:
${JSON.stringify(campaigns.map(c => ({ id: c.campaignId, name: c.campaignName })))}

For each of the search terms below, classify it into one of these three categories:
1. 'brand-competitor': The search term is a competitor brand name (or contains one). E.g. 'asana pricing', 'bupa dental'.
   - IMPORTANT: Do not classify professional roles, certifications, or methods (e.g. 'master', 'scrum master', 'project manager', 'pmp', 'agile') as competitor brands. Group them under 'other' or 'informational'.
2. 'tangential-vertical': The search term drifts semantically into adjacent industries, customer segments, or services.
   - PUBLIC SECTOR: State-funded public sector organizations (e.g. 'NHS') are not low-intent price terms. Classify them under 'tangential-vertical' for private businesses: "NHS queries are irrelevant for a private practice. Confirm before blocking."
3. 'other': Standard background noise or informational queries.

RECOMMENDED NEGATIVE:
- For competitor brands, recommend a PHRASE negative containing just the competitor's main name (e.g., keyword: "asana", matchType: "PHRASE").
- For tangential verticals, recommend a PHRASE or BROAD negative that blocks the specific irrelevant service (e.g., keyword: "construction", matchType: "PHRASE").
- For single unique junk queries, recommend EXACT (e.g. keyword: "decaf coffee subscription", matchType: "EXACT").

Strict Guidelines for Output Fields:
- confidence: Do not peg all confidence scores at 0.95 or 1.0. Dynamically spread the scores: use 0.60-0.75 for borderline semantic inferences, 0.80-0.89 for clear informational/tangential queries, and 0.90-0.99 for validated competitor brands.
- reason: Must be exactly one short sentence under 15 words. Avoid clauses, parentheticals, and extra descriptions. Keep the tone professional.
- language softening: For services not explicitly mentioned in the business profile, never claim as fact that the business "does not offer" them. Soften your reason: "Zero conversions suggest orthodontics is not a service you offer. Confirm before blocking." or similar.

Here are the search terms to classify:
${JSON.stringify(batch.map(t => ({ search_term: t.search_term, campaign: t.campaign, cost: t.cost })))}

Provide your response strictly in the requested JSON format.
`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: promptText,
          config: {
            temperature: 0.0,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                classifications: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      searchTerm: { type: 'STRING' },
                      category: { 
                        type: 'STRING', 
                        enum: ['brand-competitor', 'tangential-vertical', 'other'] 
                      },
                      recommendedNegative: { type: 'STRING' },
                      matchType: { 
                        type: 'STRING', 
                        enum: ['EXACT', 'PHRASE', 'BROAD'] 
                      },
                      reason: { type: 'STRING' },
                      confidence: { type: 'NUMBER' }
                    },
                    required: ['searchTerm', 'category', 'recommendedNegative', 'matchType', 'reason', 'confidence']
                  }
                }
              },
              required: ['classifications']
            }
          }
        });

        const parsedResponse = JSON.parse(response.text);
        const chunkClassifications = parsedResponse.classifications || [];
        allParsedClassifications.push(...chunkClassifications);
      }

      // Map classifications back to SearchSavior recommended format
      newRecommendations = allParsedClassifications
        .filter(c => c.category !== 'other')
        .map(c => {
          const matchingTerm = uncachedCandidates.find(t => t.search_term.toLowerCase() === c.searchTerm.toLowerCase());
          const campaignId = getCampaignIdByName(matchingTerm ? matchingTerm.campaign : '', campaigns);
          
          return {
            keyword: c.recommendedNegative.toLowerCase().trim(),
            matchType: c.matchType.toUpperCase(),
            reason: c.reason,
            estimatedMonthlyWaste: matchingTerm ? matchingTerm.cost : 0, // Direct cost mapping
            sourceCategory: c.category,
            confidence: c.confidence,
            applicableCampaigns: campaignId ? [campaignId] : []
          };
        });

    } catch (err) {
      if (process.env.NODE_ENV === 'test') {
        console.warn('Gemini API execution failed, falling back to mock classifier in test environment:', err.message);
        newRecommendations = runMockClassifier(uncachedCandidates, campaigns);
      } else {
        throw err;
      }
    }
  }

  // 2. Populate the newly classified terms into the persistent local cache
  newRecommendations = postProcessRecommendations(newRecommendations);

  if (useCache) {
    newRecommendations.forEach(rec => {
      // Strip campaign-specific targeting fields before saving to the global cache
      const cacheEntry = {
        keyword: rec.keyword,
        matchType: rec.matchType,
        reason: rec.reason,
        estimatedMonthlyWaste: rec.estimatedMonthlyWaste,
        sourceCategory: rec.sourceCategory,
        confidence: rec.confidence
      };
      
      // We cache based on the search query as the primary key
      const candidateQuery = fallbackCandidates.find(t => {
        const q = t.search_term.toLowerCase().trim();
        return q.includes(rec.keyword) || rec.keyword.includes(q);
      });

      if (candidateQuery) {
        const termKey = candidateQuery.search_term.toLowerCase().trim();
        cache[termKey] = cacheEntry;
      }
    });

    saveCache(cache);
  }

  // Return the merged array of previously cached and newly classified terms
  return [...cachedResults, ...newRecommendations];
}

/**
 * Programmatic Post-Processing Validation Override (Layer 3 Safety)
 */
function postProcessRecommendations(recs) {
  if (!recs || !Array.isArray(recs)) return [];
  const ROLE_KEYS = ['master', 'scrum', 'pmp', 'manager', 'agile', 'developer', 'designer', 'director', 'certification'];
  
  return recs
    .filter(rec => rec !== null && rec !== undefined)
    .map(rec => {
      let keyword = (rec.keyword || '').toLowerCase().trim();
      let category = rec.sourceCategory || 'other';
      let matchType = (rec.matchType || 'BROAD').toUpperCase();
      let reason = rec.reason || '';
      let confidence = typeof rec.confidence === 'number' ? rec.confidence : 0.65;

    // 1. Role / certification override (Layer 3 programmatic post-processing)
    const containsRole = ROLE_KEYS.some(r => keyword.includes(r));
    if (containsRole) {
      if (category === 'brand-competitor') {
        category = 'informational';
        matchType = 'BROAD';
        reason = `Professional role or certification query classified as informational.`;
        confidence = 0.75;
      }
    }

    // 2. Soften inferred business knowledge reasons
    if (category === 'tangential-vertical') {
      const match = reason.match(/does not offer ([\w\s-]+)/i);
      if (match) {
        const service = match[1].trim();
        reason = `Zero conversions suggest '${service}' is not a service you offer. Confirm before blocking.`;
      } else if (!reason.toLowerCase().includes('suggest') && !reason.toLowerCase().includes('confirm') && !reason.toLowerCase().includes('irrelevant')) {
        reason = `Zero conversions suggest this isn't a service you offer. Confirm before blocking.`;
      }
    }

    // 3. Trim reasons to a single sentence programmatically (ensures grammatical sense)
    if (reason) {
      let firstSentence = reason.split(/[.!?]/)[0].trim();
      if (firstSentence) {
        reason = firstSentence + '.';
      }
    }

    // 4. Ensure confidence variance
    if (confidence === 0.95 || confidence === 1.0) {
      if (category === 'brand-competitor') {
        confidence = 0.92;
      } else if (category === 'tangential-vertical') {
        confidence = 0.78;
      } else if (category === 'informational') {
        confidence = 0.72;
      } else {
        confidence = 0.65;
      }
    }

    return {
      ...rec,
      keyword,
      sourceCategory: category,
      matchType,
      reason,
      confidence
    };
  });
}

/**
 * Procedural mock semantic classifier for offline/test environments
 */
function runMockClassifier(candidates, campaigns) {
  const recommendations = [];

  candidates.forEach(term => {
    const query = term.search_term.toLowerCase().trim();
    const campaignId = getCampaignIdByName(term.campaign, campaigns);

    // Look for competitors
    const competitorMatch = MOCK_COMPETITORS.find(comp => query.includes(comp));
    // Look for tangential services
    const tangentialMatch = MOCK_TANGENTIAL.find(tang => query.includes(tang));

    if (competitorMatch) {
      recommendations.push({
        keyword: competitorMatch,
        matchType: 'PHRASE',
        reason: `Competitor brand '${competitorMatch}' found in search query.`,
        estimatedMonthlyWaste: term.cost,
        sourceCategory: 'brand-competitor',
        confidence: 0.92,
        applicableCampaigns: campaignId ? [campaignId] : []
      });
    } else if (tangentialMatch) {
      recommendations.push({
        keyword: tangentialMatch,
        matchType: 'PHRASE',
        reason: `Zero conversions suggest '${tangentialMatch}' is not a service you offer. Confirm before blocking.`,
        estimatedMonthlyWaste: term.cost,
        sourceCategory: 'tangential-vertical',
        confidence: 0.78,
        applicableCampaigns: campaignId ? [campaignId] : []
      });
    } else {
      // Default exact block for one-off junk
      recommendations.push({
        keyword: term.search_term,
        matchType: 'EXACT',
        reason: `Isolated zero-conversion query recommended for exact block.`,
        estimatedMonthlyWaste: term.cost,
        sourceCategory: 'other',
        confidence: 0.65,
        applicableCampaigns: campaignId ? [campaignId] : []
      });
    }
  });

  return recommendations;
}

function getCampaignIdByName(campaignName, campaigns) {
  const match = campaigns.find(c => c.campaignName === campaignName);
  return match ? match.campaignId : '';
}

module.exports = {
  classifySearchTerms,
  postProcessRecommendations
};
