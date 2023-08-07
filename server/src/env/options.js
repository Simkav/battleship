const schema = {
  type: 'object',
  properties: {
    REDIS_HOST: { type: 'string' },
    REDIS_PORT: { type: 'string', default: '6379' },
    REDIS_USER: { type: 'string' },
    REDIS_PASS: { type: 'string' },
    DB_URL: { type: 'string' },
  },
};

const options = {
  schema,
};

module.exports = options;
