process.env.NODE_ENV = 'test';
const assert = require('assert').strict;
const path = require('path');
const fs = require('fs');

const { parseSearchTerms, parseCampaignConfig, parseBusinessContext } = require('../src/parser');
const { runStage1Diagnostics, isNegativeKeywordMatch } = require('../src/diagnostics');
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

    // Singular/Plural Grammatical Edge Cases
    const { getSingularPluralVariations } = require('../src/diagnostics');
    assert.deepEqual(getSingularPluralVariations('human'), ['human', 'humans'], 'Should not convert human to humen');
    assert.deepEqual(getSingularPluralVariations('german'), ['german', 'germans'], 'Should not convert german to germen');
    assert.deepEqual(getSingularPluralVariations('spokesman'), ['spokesman', 'spokesmen'], 'Should convert spokesman to spokesmen');
    assert.deepEqual(getSingularPluralVariations('potatoes'), ['potatoes', 'potato'], 'Should convert potatoes to potato (and not potatoe)');

    console.log('  ✅ Whole-word matching validation successful.\n');

    console.log('🎉 ALL TESTS COMPLETED SUCCESSFULLY! MODULE IS CORRECT.');
  } catch (err) {
    console.error('❌ Test suite failed:', err);
    process.exit(1);
  }
}

testSuite();
