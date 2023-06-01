const fastify = require('fastify').default({ logger: true });
const kernel = require('./domains/kernel');
const { join } = require('path');
const autoload = require('@fastify/autoload');

fastify.register(autoload, {
  dir: join(__dirname, 'plugins'),
  encapsulate: false,
});

kernel(fastify, {});



process.on('uncaughtException', () => fastify.close());
process.on('unhandledRejection', () => fastify.close());



fastify.listen({ port: 3000, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
});
