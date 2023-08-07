const { default: fp } = require('fastify-plugin');
const fastifySession = require('@fastify/session');

const sessionPlugin = async (fastify, options, done) => {
    fastify.register(fastifySession, { secret: 'asdasqweqweADSQWEQWEQWDASDASDQWAEQWEQWDSADASDWQEQWEQWEASDDZXC' }); // TODO secret from env
    done();
};

module.exports = fp(sessionPlugin, { name: 'session', dependencies: ['cookie', 'env'] });
