const { default: fp } = require('fastify-plugin');

/**
 *
 * @param {import('fastify').FastifyInstance} fastify
 */
const socketPlugin = async function (fastify, options, done) {
  await fastify.register(require('fastify-socket.io'));
  fastify.addHook('onClose', async () => {
    // fastify.io.close();
  });
  const gameNamespace = fastify.io.of('/games');
  fastify.decorate('gameNamespace', gameNamespace);
  done();
};

module.exports = fp(socketPlugin, { name: 'socket' });
