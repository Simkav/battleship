const { default: fp } = require('fastify-plugin');

/**
 *
 * @param {import('fastify').FastifyInstance} fastify
 */
const socketPlugin = function (fastify, options, done) {
  const envSchema = require('../env/options');
  fastify.register(require('@fastify/env'), envSchema);
  done();
};

module.exports = fp(socketPlugin, { name: 'env' });
