const { PrismaClient } = require('@prisma/client');
const { default: fp } = require('fastify-plugin');

/**
 *
 * @param {import('fastify').FastifyInstance} fastify
 */
const prismaPlugin = async (fastify, options, done) => {
  const prisma = new PrismaClient();

  await prisma.$connect();

  // Make Prisma Client available through the fastify server instance: server.prisma
  fastify.decorate('prisma', prisma);
  fastify.addHook('onClose', async (fastify) => {
    await fastify.prisma.$disconnect();
  });
  done();
};

module.exports = fp(prismaPlugin, { name: 'prisma' });
