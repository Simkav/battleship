const { default: fp } = require('fastify-plugin');

const Sentry = require('@sentry/node');
const Tracing = require('@sentry/tracing');

/**
 *
 * @param {import('fastify').FastifyInstance} fastify
 */
const socketPlugin = function (fastify, options, done) {
  Sentry.init({
    dsn: fastify.config.SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
  fastify.decorate('sentry', Sentry);
  done();
};

module.exports = fp(socketPlugin, { name: 'sentry', dependencies: ['env'] });
