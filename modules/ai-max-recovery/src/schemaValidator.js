const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

/**
 * Validates the audit JSON output against output_schema.json
 * @param {Object} data - Output payload to validate.
 * @param {string} schemaPath - Absolute path to output_schema.json.
 * @returns {Object} Object containing { valid: boolean, errors?: Array }
 */
function validateOutput(data, schemaOrPath) {
  let schema;
  if (typeof schemaOrPath === 'string') {
    if (!fs.existsSync(schemaOrPath)) {
      throw new Error(`Schema file not found at: ${schemaOrPath}`);
    }
    const schemaContent = fs.readFileSync(schemaOrPath, 'utf8');
    schema = JSON.parse(schemaContent);
  } else if (typeof schemaOrPath === 'object' && schemaOrPath !== null) {
    schema = schemaOrPath;
  } else {
    throw new Error('Invalid schema parameter: must be a file path string or a pre-parsed JSON schema object');
  }

  // Initialize AJV with standard draft-07 support and format checks
  const ajv = new Ajv({ 
    allErrors: true, 
    strict: false,
    useDefaults: true
  });
  addFormats(ajv);

  const validate = ajv.compile(schema);
  const valid = validate(data);

  if (!valid) {
    return {
      valid: false,
      errors: validate.errors.map(err => ({
        instancePath: err.instancePath,
        message: err.message,
        params: err.params
      }))
    };
  }

  return {
    valid: true
  };
}

module.exports = {
  validateOutput
};
