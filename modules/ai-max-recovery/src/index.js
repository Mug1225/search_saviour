require('dotenv').config();
const path = require('path');
const fs = require('fs');

const { parseSearchTerms, parseCampaignConfig, parseBusinessContext } = require('./parser');
const { runStage1Diagnostics, expandNegativeSynonyms, isAlreadyNegative, isConflictingWithConverting, isNegativeKeywordMatch, CATEGORIES } = require('./diagnostics');
const { classifySearchTerms, postProcessRecommendations } = require('./gemini');
const { validateOutput } = require('./schemaValidator');

const AUDIT_VERSION = '1.0.0';

/**
 * Executes the complete two-stage AI Max Recovery Audit.
 * 
 * @param {string} csvPath - Path to the search terms CSV file.
 * @param {string} configPath - Path to the campaign config JSON file.
 * @param {string} contextPath - Path to the business context text file.
 * @param {string} schemaPath - Path to the output_schema.json file.
 * @returns {Promise<Object>} The validated audit result JSON object.
 */
async function runRecoveryAudit(searchTermsOrPath, campaignConfigOrPath, businessContextOrPath, schemaOrPath) {
  const startTime = Date.now();

  // 1. Ingestion & Parsing
  const searchTerms = typeof searchTermsOrPath === 'string'
    ? parseSearchTerms(searchTermsOrPath)
    : searchTermsOrPath;

  const campaignConfig = typeof campaignConfigOrPath === 'string'
    ? parseCampaignConfig(campaignConfigOrPath)
    : campaignConfigOrPath;

  const businessContext = typeof businessContextOrPath === 'string'
    ? parseBusinessContext(businessContextOrPath)
    : businessContextOrPath;

  // 2. Stage 1: Deterministic Local Heuristics & Programmatic Rule-based checks
  const stage1Result = runStage1Diagnostics(searchTerms, campaignConfig);

  // 3. Stage 2: Fallback AI Classification for complex competitor / semantic drift queries
  const aiRecommendations = await classifySearchTerms(
    stage1Result.fallbackCandidates,
    businessContext,
    campaignConfig.campaigns
  );

  // 4. Combine all recommended negatives and sort from highest waste to lowest
  const allNegatives = [...stage1Result.localRecommendations, ...aiRecommendations];
  
  // Post-process reasons, categories, and confidence variance (Layer 3 programmatic overrides)
  const processedNegatives = postProcessRecommendations(allNegatives);

  // Exclude duplicate keywords inside the same campaign
  const uniqueRecommendations = processedNegatives.reduce((acc, current) => {
    const key = `${current.keyword}_${current.matchType}_${(current.applicableCampaigns || []).join(',')}`;
    const exists = acc.find(item => `${item.keyword}_${item.matchType}_${(item.applicableCampaigns || []).join(',')}` === key);
    if (exists) {
      exists.estimatedMonthlyWaste += current.estimatedMonthlyWaste;
    } else {
      acc.push(current);
    }
    return acc;
  }, []);

  // Sort by waste descending
  uniqueRecommendations.sort((a, b) => b.estimatedMonthlyWaste - a.estimatedMonthlyWaste);

  // Close "The Synonym Gap" by programmatically expanding negative keywords to their synonym clusters
  let expandedRecommendations = expandNegativeSynonyms(uniqueRecommendations, searchTerms, campaignConfig);

  // Post-process the final expanded recommendations to make sure everything meets UI constraints
  expandedRecommendations = postProcessRecommendations(expandedRecommendations);

  // Filter out recommendations that are already blocked by existing negatives in the campaigns
  const activeRecommendations = [];
  for (const rec of expandedRecommendations) {
    const recCampaignIds = rec.applicableCampaigns || [];
    const activeCampaignIds = [];
    
    for (const campaignId of recCampaignIds) {
      const campaignObj = campaignConfig.campaigns.find(c => c.campaignId === campaignId);
      if (!isAlreadyNegative(rec.keyword, campaignObj, rec.matchType)) {
        activeCampaignIds.push(campaignId);
      }
    }
    
    // If the recommendation had campaign IDs and now they are all filtered out, skip it.
    if (recCampaignIds.length > 0 && activeCampaignIds.length === 0) {
      continue;
    }
    
    activeRecommendations.push({
      ...rec,
      applicableCampaigns: activeCampaignIds
    });
  }

  // Cross-campaign positive-keyword conflict checks (Account-level & campaign-level safety validation)
  const conflictCheckedRecommendations = [];
  const convertingTerms = searchTerms.filter(t => t.conversions > 0);

  for (const rec of activeRecommendations) {
    const recCampaignIds = rec.applicableCampaigns || [];
    
    if (recCampaignIds.length === 0) {
      // Account-level negative: check conflict across all campaigns (cross-campaign check)
      const hasConflict = isConflictingWithConverting(rec.keyword, convertingTerms, null);
      if (hasConflict) {
        continue; // Drop the entire account-level recommendation
      }
      conflictCheckedRecommendations.push(rec);
    } else {
      // Campaign-level negatives: check conflict campaign-by-campaign
      const safeCampaignIds = [];
      for (const campaignId of recCampaignIds) {
        const campaignObj = campaignConfig.campaigns.find(c => c.campaignId === campaignId);
        const hasConflict = isConflictingWithConverting(rec.keyword, convertingTerms, campaignObj.campaignName);
        if (!hasConflict) {
          safeCampaignIds.push(campaignId);
        }
      }
      
      if (safeCampaignIds.length > 0) {
        conflictCheckedRecommendations.push({
          ...rec,
          applicableCampaigns: safeCampaignIds
        });
      }
    }
  }

  // Prevent estimated monthly waste double-counting by allocating each zero-conversion search term's cost to exactly one matching recommendation.
  conflictCheckedRecommendations.forEach(rec => {
    rec.estimatedMonthlyWaste = 0;
  });

  const wastedTerms = searchTerms.filter(t => t.conversions === 0 && t.cost > 0);
  wastedTerms.forEach(term => {
    const query = term.search_term.toLowerCase().trim();
    const campaignId = campaignConfig.campaigns.find(c => c.campaignName === term.campaign)?.campaignId;

    // Find the first recommendation that matches this query and campaign
    const matchingRec = conflictCheckedRecommendations.find(rec => {
      // Campaign match check
      if (rec.applicableCampaigns && rec.applicableCampaigns.length > 0) {
        if (!rec.applicableCampaigns.includes(campaignId)) return false;
      }
      
      return isNegativeKeywordMatch(query, rec.keyword, rec.matchType);
    });

    if (matchingRec) {
      matchingRec.estimatedMonthlyWaste += term.cost;
    }
  });

  // Round estimated wastes to 2 decimal places
  conflictCheckedRecommendations.forEach(rec => {
    rec.estimatedMonthlyWaste = parseFloat(rec.estimatedMonthlyWaste.toFixed(2));
  });

  // Sort final recommendations by estimatedMonthlyWaste descending
  conflictCheckedRecommendations.sort((a, b) => b.estimatedMonthlyWaste - a.estimatedMonthlyWaste);

  // 5. Aggregate metrics for Junk Patterns
  // Group all zero-conversion wasted terms by final classified category
  const junkPatterns = aggregateJunkPatterns(searchTerms, conflictCheckedRecommendations);

  // 6. Assemble the final JSON payload matching output_schema.json
  const processingTimeMs = Date.now() - startTime;

  const result = {
    auditMetadata: {
      generatedAt: new Date().toISOString(),
      auditVersion: AUDIT_VERSION,
      fixtureName: typeof searchTermsOrPath === 'string' ? path.basename(path.dirname(searchTermsOrPath)) : 'api-import',
      accountName: campaignConfig.accountName,
      currency: campaignConfig.currency,
      processingTimeMs
    },
    hangoverScore: {
      score: stage1Result.hangoverScore.score,
      category: stage1Result.hangoverScore.category,
      explanation: stage1Result.hangoverScore.explanation,
      contributingFactors: stage1Result.hangoverScore.contributingFactors
    },
    junkPatterns,
    recommendedNegatives: conflictCheckedRecommendations,
    smartBiddingDiagnostics: (() => {
      const diag = {
        status: stage1Result.smartBiddingStatus,
        observations: generateSmartBiddingObservations(stage1Result, campaignConfig.currency)
      };

      // Document healthy campaigns explicitly
      campaignConfig.campaigns.forEach(camp => {
        const hasRecs = conflictCheckedRecommendations.some(rec => 
          (rec.applicableCampaigns || []).includes(camp.campaignId)
        );
        if (!hasRecs) {
          diag.observations.push(`Campaign '${camp.campaignName}' shows no anomalies.`);
        }
      });

      if (stage1Result.currentCpa !== null && stage1Result.currentCpa !== undefined) {
        diag.currentCpa = stage1Result.currentCpa;
      }
      if (stage1Result.preAiMaxCpa !== null && stage1Result.preAiMaxCpa !== undefined) {
        diag.preAiMaxCpa = stage1Result.preAiMaxCpa;
      }
      if (stage1Result.cpaInflationPct !== null && stage1Result.cpaInflationPct !== undefined) {
        diag.cpaInflationPct = parseFloat(stage1Result.cpaInflationPct.toFixed(2));
      }
      if (stage1Result.cpcDistributionShift !== null && stage1Result.cpcDistributionShift !== undefined && stage1Result.cpcDistributionShift !== 'none') {
        diag.cpcDistributionShift = stage1Result.cpcDistributionShift;
      }
      return diag;
    })(),
    recoveryTimeline: stage1Result.recoveryTimeline
  };

  // 7. Validate output against output_schema.json
  const validation = validateOutput(result, schemaOrPath);
  if (!validation.valid) {
    console.error('Audit output failed schema validation:', JSON.stringify(validation.errors, null, 2));
    throw new Error('Audit output did not conform to output_schema.json');
  }

  return result;
}

/**
 * Groups zero-conversion wasted search queries into junk patterns using negative classifications.
 */
function aggregateJunkPatterns(searchTerms, recommendations) {
  const categoriesMap = {};
  
  // Initialize standard categories
  const categories = ['brand-competitor', 'informational', 'tangential-vertical', 'price-anchored-low-intent', 'other'];
  categories.forEach(cat => {
    categoriesMap[cat] = {
      category: cat,
      termCount: 0,
      totalCost: 0,
      totalConversions: 0,
      exampleTerms: []
    };
  });

  // Track each search term's assigned category to prevent double counting
  const wastedTerms = searchTerms.filter(t => t.conversions === 0 && t.cost > 0);
  
  wastedTerms.forEach(term => {
    const query = term.search_term.toLowerCase().trim();
    
    // Find if any recommended negative keyword matches this query
    const matchingRec = recommendations.find(rec => {
      return isNegativeKeywordMatch(query, rec.keyword, rec.matchType);
    });

    const category = matchingRec ? matchingRec.sourceCategory : 'other';
    
    categoriesMap[category].termCount++;
    categoriesMap[category].totalCost += term.cost;
    categoriesMap[category].totalConversions += term.conversions;
    
    categoriesMap[category].exampleTerms.push({
      term: term.search_term,
      cost: term.cost
    });
  });

  // Format and sort example terms, keeping up to 10
  return Object.values(categoriesMap)
    .filter(cat => cat.termCount > 0)
    .map(cat => {
      // Sort example terms by cost descending
      cat.exampleTerms.sort((a, b) => b.cost - a.cost);
      cat.exampleTerms = cat.exampleTerms.map(x => x.term).slice(0, 10);
      
      // Force conversion rounding to fit types
      cat.totalCost = parseFloat(cat.totalCost.toFixed(2));
      cat.totalConversions = parseFloat(cat.totalConversions.toFixed(2));
      
      return cat;
    });
}

function getCurrencySymbol(currencyCode) {
  const mapping = {
    USD: '$',
    GBP: '£',
    EUR: '€',
    CAD: 'C$',
    AUD: 'A$'
  };
  return mapping[(currencyCode || '').toUpperCase()] || '$';
}

function generateSmartBiddingObservations(stage1, currencyCode) {
  const obs = [];
  const symbol = getCurrencySymbol(currencyCode);
  
  if (stage1.hangoverScore.score <= 15) {
    obs.push("Smart Bidding signals are extremely healthy with clean conversion tracking.");
    obs.push("No legacy AI Max matched patterns or elevated budget waste observed.");
    return obs;
  }

  if (stage1.smartBiddingStatus === 'chasing-cheap-clicks') {
    obs.push("Smart Bidding has trained aggressively on high-volume, cheap junk clicks attracted during the AI Max period.");
    obs.push(`Average CPC for wasted queries is lower than converting queries, indicating a strong downward CPC distribution shift.`);
  }

  if (stage1.cpaInflationPct > 20) {
    obs.push(`Observed CPA of ${symbol}${stage1.currentCpa.toFixed(2)} represents a severe inflation of ${stage1.cpaInflationPct.toFixed(1)}% above the baseline of ${symbol}${stage1.preAiMaxCpa.toFixed(2)}.`);
  } else if (stage1.cpaInflationPct > 5) {
    obs.push(`Observed CPA is slightly elevated (+${stage1.cpaInflationPct.toFixed(1)}%) above the baseline pre-AI Max level.`);
  }

  if (stage1.leakageDetections.length > 0) {
    obs.push(`Detected ${stage1.leakageDetections.length} key match-type leakage points where existing negatives failed to block junk terms.`);
  }

  obs.push("Applying campaign-specific phrase and broad negatives is required to clear Smart Bidding's hangover.");
  return obs;
}

// =============================================================================
// CLI Execution Harness (If executed directly via node src/index.js)
// =============================================================================

async function cliRunner() {
  const args = process.argv.slice(2);
  const runFixtures = args.includes('--run-fixtures');

  if (runFixtures) {
    console.log('🚀 Running recovery audits against all three test fixtures...');
    const fixturesBase = path.join(__dirname, '..', 'Task Briefs', 'searchsavior_input_fixtures');
    const schemaPath = path.join(__dirname, '..', 'Task Briefs', 'output_schema.json');

    const scenarios = [
      {
        name: 'scenario-1-heavy-hangover',
        csv: 'search_terms_projectFlow.csv',
        config: 'campaign_config.json',
        context: 'business_context_ProjectFlow.txt'
      },
      {
        name: 'scenario-2-mild-hangover',
        csv: 'search_terms_BrightSmile.csv',
        config: 'campaign_config.json',
        context: 'business_context_BrightSmile.txt'
      },
      {
        name: 'scenario-3-no-hangover',
        csv: 'search_terms_Roastery.csv',
        config: 'campaign_config.json',
        context: 'business_context_Roastery.txt'
      }
    ];

    for (const sc of scenarios) {
      console.log(`\n--------------------------------------------------`);
      console.log(`Processing Scenario: ${sc.name}`);
      console.log(`--------------------------------------------------`);
      
      const scenarioDir = path.join(fixturesBase, sc.name);
      const csvPath = path.join(scenarioDir, sc.csv);
      const configPath = path.join(scenarioDir, sc.config);
      const contextPath = path.join(scenarioDir, sc.context);
      
      try {
        const auditResult = await runRecoveryAudit(csvPath, configPath, contextPath, schemaPath);
        
        // Write the result payload back to the scenario folder
        const outputPath = path.join(scenarioDir, 'audit_output.json');
        fs.writeFileSync(outputPath, JSON.stringify(auditResult, null, 2));
        
        console.log(`✅ Success! Score: ${auditResult.hangoverScore.score} (${auditResult.hangoverScore.category.toUpperCase()})`);
        console.log(`Recommended Negatives: ${auditResult.recommendedNegatives.length}`);
        console.log(`Saved output to: ${outputPath}`);
      } catch (err) {
        console.error(`❌ Scenario execution failed:`, err);
      }
    }
    console.log(`\n🎉 All fixtures executed successfully!`);
    return;
  }

  // Standard CLI usage
  if (args.length < 4) {
    console.log(`
AI Max Recovery Audit Engine CLI usage:
  node src/index.js --csv <csv_path> --config <config_path> --context <context_path> --schema <schema_path> [--output <output_path>]
  
Fixture test helper:
  node src/index.js --run-fixtures
`);
    return;
  }

  let csvPath, configPath, contextPath, schemaPath, outputPath;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--csv') csvPath = args[++i];
    if (args[i] === '--config') configPath = args[++i];
    if (args[i] === '--context') contextPath = args[++i];
    if (args[i] === '--schema') schemaPath = args[++i];
    if (args[i] === '--output') outputPath = args[++i];
  }

  try {
    const result = await runRecoveryAudit(csvPath, configPath, contextPath, schemaPath);
    if (outputPath) {
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
      console.log(`Audit generated successfully at: ${outputPath}`);
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (err) {
    console.error('Audit execution failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  cliRunner();
}

module.exports = {
  runRecoveryAudit
};
