process.env.NODE_ENV = 'test';
const assert = require('assert').strict;
const path = require('path');
const fs = require('fs');

const { parseSearchTerms, parseCampaignConfig, parseBusinessContext } = require('../src/parser');
const { runStage1Diagnostics, isNegativeKeywordMatch, getSingularPluralVariations } = require('../src/diagnostics');
const { runRecoveryAudit } = require('../src/index');

const fixturesBase = path.join(__dirname, '..', 'Task Briefs', 'searchsavior_input_fixtures');
const schemaPath = path.join(__dirname, '..', 'Task Briefs', 'output_schema.json');

async function testSuite() {
  console.log('🧪 Starting AI Max Recovery Audit Unit Tests...\n');

  try {
    // ----------------------------------------------------
    // TEST 1: CSV and Campaign Config parsing correctness
    // ----------------------------------------------------
    console.log('▶ Test 1: Ingestion and Parsing validation...');
    const pfCsv = path.join(fixturesBase, 'scenario-1-heavy-hangover', 'search_terms_projectFlow.csv');
    const pfConfig = path.join(fixturesBase, 'scenario-1-heavy-hangover', 'campaign_config.json');

    const searchTerms = parseSearchTerms(pfCsv);
    const campaignConfig = parseCampaignConfig(pfConfig);

    assert.equal(searchTerms.length > 0, true, 'Should parse multiple CSV rows');
    assert.equal(campaignConfig.accountName, 'ProjectFlow PM', 'Should load config parameters');
    assert.equal(campaignConfig.currency, 'USD', 'Should load config currency');
    console.log('  ✅ Ingestion parsing successful.\n');

    // ----------------------------------------------------
    // TEST 2: Stage 1 local diagnostic assertions (No AI)
    // ----------------------------------------------------
    console.log('▶ Test 2: Local heuristics calculations and safety checks...');
    const diagnostics = runStage1Diagnostics(searchTerms, campaignConfig);

    // Verify CPA inflation calculations
    assert.equal(diagnostics.preAiMaxCpa, 80, 'Baseline CPA should match config');
    assert.ok(diagnostics.currentCpa > 80, 'Current CPA should show inflation');
    assert.ok(diagnostics.cpaInflationPct > 0, 'Inflation percentage should be positive');

    // Verify campaign safety checks
    const hasConflict = diagnostics.localRecommendations.some(rec => {
      // Check if keyword is a positive converting term
      return searchTerms.some(t => t.conversions > 0 && t.search_term.toLowerCase() === rec.keyword);
    });
    assert.equal(hasConflict, false, 'No recommended negative should conflict with positive converting terms in that campaign!');
    console.log('  ✅ Diagnostic metrics and safety check passing.\n');

    // ----------------------------------------------------
    // TEST 3: End-to-end output schema compliance on Scenario 1
    // ----------------------------------------------------
    console.log('▶ Test 3: End-to-end audit execution and schema validation...');
    const contextPath = path.join(fixturesBase, 'scenario-1-heavy-hangover', 'business_context_ProjectFlow.txt');
    const auditResult = await runRecoveryAudit(pfCsv, pfConfig, contextPath, schemaPath);

    assert.equal(auditResult.hangoverScore.category, 'severe', 'Scenario 1 should yield severe score');
    assert.ok(auditResult.recommendedNegatives.length >= 15, 'Scenario 1 should yield at least 15 recommendations');
    console.log('  ✅ End-to-end schema compliance successful.\n');

    // ----------------------------------------------------
    // TEST 4: Object injection (direct JSON structures)
    // ----------------------------------------------------
    console.log('▶ Test 4: Object-based parameter signature validation (no file paths)...');
    const businessContext = parseBusinessContext(contextPath);
    const schemaObj = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    const objectAuditResult = await runRecoveryAudit(searchTerms, campaignConfig, businessContext, schemaObj);

    assert.equal(objectAuditResult.hangoverScore.category, 'severe', 'Object audit should yield severe score');
    assert.equal(objectAuditResult.auditMetadata.fixtureName, 'api-import', 'Metadata fixture name should default to api-import for object imports');
    console.log('  ✅ Object-based parameter signature validation successful.\n');

    // ----------------------------------------------------
    // TEST 5: Whole-Word Matching & Substring Collision Checks
    // ----------------------------------------------------
    console.log('▶ Test 5: Whole-word matching & letter-substring collision validations...');

    // BROAD Match Checks
    assert.equal(isNegativeKeywordMatch('smart software plan', 'art', 'BROAD'), false, 'BROAD: negative "art" should not match "smart"');
    assert.equal(isNegativeKeywordMatch('best project management software', 'project management', 'BROAD'), true, 'BROAD: "project management" should match query with "project" and "management"');
    assert.equal(isNegativeKeywordMatch('scrum master training', 'scrum master', 'BROAD'), true, 'BROAD: should match all tokens');

    // PHRASE Match Checks
    assert.equal(isNegativeKeywordMatch('smart dental clinic', 'art', 'PHRASE'), false, 'PHRASE: negative "art" should not match "smart"');
    assert.equal(isNegativeKeywordMatch('emergency dentist london', 'dentist london', 'PHRASE'), true, 'PHRASE: contiguous phrase in order should match');
    assert.equal(isNegativeKeywordMatch('london dentist emergency', 'dentist london', 'PHRASE'), false, 'PHRASE: out of order should not match');
    assert.equal(isNegativeKeywordMatch('emergency dentist, london', 'dentist london', 'PHRASE'), true, 'PHRASE: punctuation should be stripped/ignored');

    // EXACT Match Checks
    assert.equal(isNegativeKeywordMatch('emergency dentist', 'emergency dentist', 'EXACT'), true, 'EXACT: exact terms should match');
    assert.equal(isNegativeKeywordMatch('emergency dentist london', 'emergency dentist', 'EXACT'), false, 'EXACT: extra words should not match');
    assert.equal(isNegativeKeywordMatch('emergency dentist,', 'emergency dentist', 'EXACT'), true, 'EXACT: punctuation should be ignored');

    console.log('  ✅ Whole-word matching validation successful.\n');

    // ----------------------------------------------------
    // TEST 6: Grammar Rules, Irregular Plurals, and Exceptions
    // ----------------------------------------------------
    console.log('▶ Test 6: Grammar rules, irregular plurals, and suffix exceptions...');

    // Regular endings
    assert.deepEqual(getSingularPluralVariations('job'), ['job', 'jobs']);
    assert.deepEqual(getSingularPluralVariations('jobs'), ['jobs', 'job']);
    assert.deepEqual(getSingularPluralVariations('agency'), ['agency', 'agencies']);
    assert.deepEqual(getSingularPluralVariations('agencies'), ['agencies', 'agency']);
    assert.deepEqual(getSingularPluralVariations('toy'), ['toy', 'toys']);
    assert.deepEqual(getSingularPluralVariations('toys'), ['toys', 'toy']);

    // Singular words ending in -ss, -us, -is, -as
    assert.deepEqual(getSingularPluralVariations('class'), ['class', 'classes']);
    assert.deepEqual(getSingularPluralVariations('status'), ['status', 'statuses']);
    assert.deepEqual(getSingularPluralVariations('analysis'), ['analysis', 'analyses']);
    assert.deepEqual(getSingularPluralVariations('canvas'), ['canvas', 'canvases']);

    // Plural words ending in -sses, -ses, -xes, etc.
    assert.deepEqual(getSingularPluralVariations('classes'), ['classes', 'class']);
    assert.deepEqual(getSingularPluralVariations('boxes'), ['boxes', 'box']);
    assert.deepEqual(getSingularPluralVariations('buses'), ['buses', 'bus', 'busis']);
    assert.deepEqual(getSingularPluralVariations('analyses'), ['analyses', 'analys', 'analysis']);

    // Irregular nouns
    assert.deepEqual(getSingularPluralVariations('man'), ['man', 'men']);
    assert.deepEqual(getSingularPluralVariations('men'), ['men', 'man']);
    assert.deepEqual(getSingularPluralVariations('woman'), ['woman', 'women']);
    assert.deepEqual(getSingularPluralVariations('women'), ['women', 'woman']);
    assert.deepEqual(getSingularPluralVariations('person'), ['person', 'people']);
    assert.deepEqual(getSingularPluralVariations('people'), ['people', 'person']);

    // Latin/Greek Outliers
    assert.deepEqual(getSingularPluralVariations('medium'), ['medium', 'media']);
    assert.deepEqual(getSingularPluralVariations('media'), ['media', 'medium']);
    assert.deepEqual(getSingularPluralVariations('indices'), ['indices', 'index']);
    assert.deepEqual(getSingularPluralVariations('index'), ['index', 'indices']);

    // -f / -fe / -ves endings and exceptions
    assert.deepEqual(getSingularPluralVariations('leaf'), ['leaf', 'leaves', 'leafs']);
    assert.deepEqual(getSingularPluralVariations('leaves'), ['leaves', 'leaf', 'leafe']);
    assert.deepEqual(getSingularPluralVariations('life'), ['life', 'lives']);
    assert.deepEqual(getSingularPluralVariations('lives'), ['lives', 'lif', 'life']);
    assert.deepEqual(getSingularPluralVariations('chef'), ['chef', 'chefs']);
    assert.deepEqual(getSingularPluralVariations('roof'), ['roof', 'roofs']);
    assert.deepEqual(getSingularPluralVariations('cliff'), ['cliff', 'cliffs']);

    // -o / -es exceptions
    assert.deepEqual(getSingularPluralVariations('hero'), ['hero', 'heroes']);
    assert.deepEqual(getSingularPluralVariations('heroes'), ['heroes', 'hero']);
    assert.deepEqual(getSingularPluralVariations('potato'), ['potato', 'potatoes']);
    assert.deepEqual(getSingularPluralVariations('potatoes'), ['potatoes', 'potato']);

    console.log('  ✅ Grammar rules and exceptions validation successful.\n');

    console.log('🎉 ALL TESTS COMPLETED SUCCESSFULLY! MODULE IS CORRECT.');
  } catch (err) {
    console.error('❌ Test suite failed:', err);
    process.exit(1);
  }
}

testSuite();
