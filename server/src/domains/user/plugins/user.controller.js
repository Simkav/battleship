const { PrismaClient } = require('@prisma/client');
const { default: fp } = require('fastify-plugin');

/**
 *
 * @param {import('fastify').FastifyInstance} fastify
 */
const userController = async (fastify, options, done) => {
    const service = fastify.userService
    fastify.post('/auth/login', {
        schema: {
            body: {
                type: 'object', properties:
                    { email: { type: 'string' }, password: { type: 'string' } }
            }
        }
    }, async (request, reply) => {
        const user = await service.login(request.body)
        request.session.user = user
        reply.code(200).send({ user })
    })
    fastify.post('/auth/register', {
        schema: {
            body: {
                type: 'object', properties:
                    { email: { type: 'string' }, password: { type: 'string' } }
            }
        }
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
