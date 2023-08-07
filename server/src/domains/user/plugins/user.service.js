const { PrismaClient } = require('@prisma/client');
const { default: fp } = require('fastify-plugin');
const UserService = require('../service/user.service');

/**
 *
 * @param {import('fastify').FastifyInstance} fastify
 */
const userServicePlugin = async (fastify, options, done) => {
    const prisma = fastify.prisma
    const userService = new UserService(prisma)
    fastify.decorate('userService', userService)
    done();
};

module.exports = fp(userServicePlugin, { name: 'userService', });
