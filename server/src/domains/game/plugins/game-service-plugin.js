const { default: fp } = require('fastify-plugin');
const GameService = require('../services/game-service');
const { PrismaClient } = require('@prisma/client');

/**
 *
 * @param {import('fastify').FastifyInstance} fastify
 */
const gamePlugin = async (fastify, options, done) => {
  const gameSerivce = new GameService(
    fastify.gameNamespace,
    fastify.redisDefault,
    fastify.prisma,
    fastify.sentry
  );
  fastify.decorate('gameService', gameSerivce);
  
  fastify.addHook('onClose', async () => {
    gameSerivce._clearInterval();
  });
  done();

  // TODO conflict with expire redis shadow keys
  // fastify.addHook('onReady', async () => {
  //   const client = fastify.prisma
  //   const unEndedGamesIds = (await client.game.findMany({ where: { isEnded: false } })).map(game => game.id)
  //   await client.game.deleteMany({ where: { id: { in: unEndedGamesIds } } })
  //   console.log(unEndedGamesIds);
  // })
};

module.exports = fp(gamePlugin, {
  name: 'gameService',
  dependencies: ['prisma', 'redis', 'socket', 'sentry'],
});
