const { default: fp } = require('fastify-plugin');

/**
 *
 * @param {import('fastify').FastifyInstance} fastify
 */
const redisExpirePlugin = async (fastify, options, done) => {
  fastify.redisExpire.psubscribe('__keyevent@*__:expired', () => {});
  fastify.redisExpire.on('pmessage', (_, __, msg) => {
    console.log(msg);
    if (msg.startsWith('shadow:match')) {
      const matchId = msg.split(':').pop();
      fastify.gameService.expireGame(matchId);
    }
  });
  done();
};

module.exports = fp(redisExpirePlugin, {
  name: 'redisExpirePlugin',
  dependencies: ['gameService', 'prisma', 'redis', 'socket'],
});
