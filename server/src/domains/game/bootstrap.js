const autoLoad = require('@fastify/autoload');
const { join } = require('path');

module.exports = async function (rootServer, rootServerOpts) {
  /**
   * @param {import ('fastify').FastifyInstance} childServer
   */
  return async function privateContext(childServer) {
    // register plugins
    childServer.register(autoLoad, {
      dir: join(__dirname, 'plugins'),
      encapsulate: false,
    });

    // register socket gateway
    childServer.register(autoLoad, {
      dir: join(__dirname, 'gateway'),
      encapsulate: false,
    });
  };
};
