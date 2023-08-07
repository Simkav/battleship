const { default: fp } = require('fastify-plugin');
const fastifyCookie = require('@fastify/cookie');

const cookiePlugin = async (fastify, options, done) => {
    fastify.register(fastifyCookie);
    done();
};

module.exports = fp(cookiePlugin, { name: 'cookie' });
