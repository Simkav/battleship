const fs = require('fs');
const path = require('path');

module.exports = function init(rootServer, rootServerOpts) {
  fs.readdirSync(__dirname)
    .filter((file) => file !== 'kernel.js')
    .forEach((file) => {
      console.log(file, 'filetsr');
      console.log(path.join(__dirname, file, 'bootstrap.js'));
      try {
        const bootstrap = require(path.join(__dirname, file, 'bootstrap.js'))(
          rootServer,
          rootServerOpts
        );
        rootServer.register(bootstrap);
      } catch (e) {
        console.error(e);
        return false;
      }
    });
};
