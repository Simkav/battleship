const { default: fastifyRedis } = require('@fastify/redis');
const { default: fp } = require('fastify-plugin');

/**
 *
 * @param {import('fastify').FastifyInstance} fastify
 */
const redisPlugin = async (fastify, options, done) => {
  const { REDIS_PASS, REDIS_HOST } = fastify.config;
  await fastify.register(fastifyRedis, {
    host: REDIS_HOST,
    password: REDIS_PASS,
    namespace: 'expire_sub',
  });
  await fastify.register(fastifyRedis, {
    host: REDIS_HOST,
    password: REDIS_PASS,
    namespace: 'pub',
  });

  fastify.decorate('redisExpire', fastify.redis.expire_sub);
  fastify.decorate('redisDefault', fastify.redis.pub);

  done();

  fastify.addHook('onClose', async () => {
    await fastify.redisExpire.quit();
    await fastify.redisDefault.quit();
  });
};

module.exports = fp(redisPlugin, { name: 'redis', dependencies: ['env'] });
