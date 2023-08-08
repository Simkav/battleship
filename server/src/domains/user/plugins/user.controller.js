const { PrismaClient } = require('@prisma/client');
const { default: fp } = require('fastify-plugin');
const { userAuthSchema } = require('../schemas/userAuthSchema');

/**
 *
 * @param {import('fastify').FastifyInstance} fastify
 */
const userController = async (fastify, options, done) => {
    const service = fastify.userService
    fastify.post('/auth/login', {
        schema: userAuthSchema
    }, async (request, reply) => {
        const user = await service.login(request.body)
        request.session.user = user
        reply.code(200).send({ user })
    })
    fastify.post('/auth/register', {
        schema: userAuthSchema
    }, async (request, reply) => {
        const user = await service.register(request.body)
        request.session.user = user
        reply.code(201).send({ user })
    })
    fastify.post('/auth/logout', async (request, reply) => {
        await request.session.destroy()
        reply.code(200).send({ status: 'ok' })
    })


    done();
};

module.exports = fp(userController, { name: 'userController', dependencies: ['userService'] });
