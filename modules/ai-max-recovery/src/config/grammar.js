/**
 * Grammar rules, irregular noun lists, and static keyword configurations
 * used by the search term diagnostic engine.
 */

const IRREGULAR_SINGULAR_TO_PLURAL = {
  foot: 'feet',
  goose: 'geese',
  tooth: 'teeth',
  mouse: 'mice',
  child: 'children',
  ox: 'oxen',
  person: 'people',
  medium: 'media',
  datum: 'data',
  criterion: 'criteria',
  phenomenon: 'phenomena',
  index: 'indices',
  matrix: 'matrices',
  vertex: 'vertices'
};

const IRREGULAR_PLURAL_TO_SINGULAR = Object.fromEntries(
  Object.entries(IRREGULAR_SINGULAR_TO_PLURAL).map(([s, p]) => [p, s])
);

// Words ending in -f or -fe that form plurals by simply adding -s (do not change to -ves)
const F_FE_S_ONLY = new Set([
  'chef', 'chief', 'roof', 'proof', 'belief', 'safe', 'cliff', 
  'sheriff', 'tariff', 'cuff', 'puff', 'riff', 'brief', 'grief', 'gulf'
]);

// Words ending in -o that form plurals by adding -es
const O_ES_PLURAL = new Set([
  'potato', 'tomato', 'hero', 'echo', 'torpedo', 'veto', 'cargo', 'volcano', 'buffalo'
]);

// Obvious low-intent pricing tokens used by the local rule-based classifier
const PRICE_WORDS = ['free', 'cheap', 'cheapest', 'discount', 'coupon', 'promo', 'freebie'];

// Obvious standard informational/career-oriented tokens used by the local rule-based classifier
const INFO_WORDS = [
  'job', 'jobs', 'career', 'careers', 'hiring', 'salary', 'salaries', 
  'course', 'courses', 'training', 'resume', 'intern', 'wikipedia', 'reddit', 
  'tutorial', 'tutorials', 'salary uk', 'master', 'manager', 'scrum', 'pmp', 
  'agile', 'developer', 'designer', 'director', 'certification'
];

// Comparative indicator words that suggest competitor queries
const COMPARATIVE_WORDS = ['vs', 'alternative', 'alternatives', 'review', 'reviews', 'competitor', 'comparison', 'pricing'];

// Synonym Dictionary to close the Synonym Gap and prevent semantic drift leakage
const SYNONYM_DICTIONARY = {
  free: ['freebie', 'complimentary', 'no-cost', 'gratis', 'zero-cost'],
  cheap: ['cheapest', 'inexpensive', 'bargain'],
  jobs: ['job', 'career', 'careers', 'hiring', 'employment', 'internship', 'intern', 'salary', 'salaries', 'vacancy', 'vacancies'],
  job: ['jobs', 'career', 'careers', 'hiring', 'employment', 'internship', 'intern', 'salary', 'salaries', 'vacancy', 'vacancies'],
  salary: ['jobs', 'job', 'careers', 'career', 'hiring', 'recruitment', 'vacancies', 'vacancy', 'wages', 'wage']
};

module.exports = {
  IRREGULAR_SINGULAR_TO_PLURAL,
  IRREGULAR_PLURAL_TO_SINGULAR,
  F_FE_S_ONLY,
  O_ES_PLURAL,
  PRICE_WORDS,
  INFO_WORDS,
  COMPARATIVE_WORDS,
  SYNONYM_DICTIONARY
};
