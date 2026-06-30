const fs = require('fs');
const { parse } = require('csv-parse/sync');

function cleanNumber(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  // Remove currency symbols, commas, percent signs, and spaces
  const cleaned = val.toString().replace(/[$,£€%]/g, '').replace(/,/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Parses the search terms CSV file.
 * @param {string} csvPath - Path to the search terms CSV file.
 * @returns {Array<Object>} Array of parsed search term objects with typed properties.
 */
function parseSearchTerms(csvPath) {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`Search terms CSV file not found: ${csvPath}`);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf8');
  
  // Parse CSV synchronously using csv-parse
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  // Normalize column types and headers
  return records.map(rawRecord => {
    const record = {};
    Object.keys(rawRecord).forEach(key => {
      const normalizedKey = key.toLowerCase().trim()
        .replace(/[\s_.-]+/g, '_')
        .replace(/avg_cpc/, 'cpc');
      record[normalizedKey] = rawRecord[key];
    });

    return {
      search_term: record.search_term || '',
      campaign: record.campaign || '',
      ad_group: record.ad_group || '',
      match_type: (record.match_type || '').toUpperCase(),
      impressions: parseInt(cleanNumber(record.impressions || 0), 10),
      clicks: parseInt(cleanNumber(record.clicks || 0), 10),
      cost: cleanNumber(record.cost || 0),
      conversions: cleanNumber(record.conversions || 0),
      conversion_value: cleanNumber(record.conversion_value || 0),
      ctr: cleanNumber(record.ctr || 0),
      cpc: cleanNumber(record.cpc || 0)
    };
  });
}

/**
 * Parses the campaign config JSON file.
 * @param {string} jsonPath - Path to the campaign config JSON file.
 * @returns {Object} Campaign config object.
 */
function parseCampaignConfig(jsonPath) {
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Campaign config JSON file not found: ${jsonPath}`);
  }

  const content = fs.readFileSync(jsonPath, 'utf8');
  const config = JSON.parse(content);

  // Validate critical fields
  if (!config.accountName) throw new Error('Invalid campaign config: missing accountName');
  if (!config.currency) throw new Error('Invalid campaign config: missing currency');
  if (!Array.isArray(config.campaigns)) throw new Error('Invalid campaign config: missing campaigns array');

  // Normalize negatives to uppercase matchTypes
  config.campaigns = config.campaigns.map(camp => {
    if (camp.currentNegativeKeywords) {
      camp.currentNegativeKeywords = camp.currentNegativeKeywords.map(neg => ({
        keyword: neg.keyword.toLowerCase().trim(),
        matchType: neg.matchType.toUpperCase()
      }));
    } else {
      camp.currentNegativeKeywords = [];
    }
    return camp;
  });

  return config;
}

/**
 * Loads the business context text file.
 * @param {string} textPath - Path to the business context file.
 * @returns {string} Business context string.
 */
function parseBusinessContext(textPath) {
  if (!fs.existsSync(textPath)) {
    // If not provided, return a placeholder but don't crash
    return '';
  }
  return fs.readFileSync(textPath, 'utf8').trim();
}

module.exports = {
  parseSearchTerms,
  parseCampaignConfig,
  parseBusinessContext
};
