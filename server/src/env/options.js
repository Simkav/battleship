const schema = {
  type: 'object',
  //   required: ['REDIS_HOST', 'REDIS_PORT', 'REDIS_USER', 'REDIS_PASS'],
  properties: {
    REDIS_HOST: { type: 'string' },
    REDIS_PORT: { type: 'string', default: '6379' },
    REDIS_USER: { type: 'string' },
    REDIS_PASS: { type: 'string' },
    DB_HOST: { type: 'string' },
    DB_USER: { type: 'string' },
    DB_PASS: { type: 'string' },
    DB_DB: { type: 'string' },
  },
};

const options = {
  schema,
};

module.exports = options;
