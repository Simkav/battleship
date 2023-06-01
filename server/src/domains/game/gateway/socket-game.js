const { default: fp } = require('fastify-plugin');
const {
  IncomingEventsEnum: EventsEnum,
  OutcomingEventsEnum,
} = require('../../../enum/event-enum');
const socketDataEnum = require('../../../enum/socket-data-enum');

const baseSocketData = Object.fromEntries(Object.keys(socketDataEnum).map(key => [key, null]))


/**
 *
 * @param {import('fastify').FastifyInstance} fastify
 */
const socketPlugin = function (fastify, options, done) {
  const namespace = fastify.gameNamespace;
  const gameService = fastify.gameService;
  namespace.on('connect', (socket) => {
    socket.data = { ...baseSocketData }
    console.log('new socket' + socket.id);
    const userId = socket.handshake.auth.userId;
    console.log(userId);
    socket.data.userId = userId;
    // TODO validattion
    const connectedUserId = namespace.adapter.rooms.get(userId);
    if (connectedUserId !== undefined && connectedUserId.size >= 1) {
      socket.emit(OutcomingEventsEnum.UserAlreadyJoined);
      socket.disconnect();
      return;
    }
    socket.join(userId);
    socket.on(EventsEnum.JoinLobby, async (ships) => {
      /* 
      gameService.placeShip(socket.data[socketDataEnum.matchId], userId, ships);
      */
      gameService.placeShip(socket.data[socketDataEnum.matchId], userId);
      const gameData = await gameService.checkIfPlayerAlreadyPlaying(userId)
      if (gameData) {
        const [obj, socketData] = gameData
        socket.join(socketData.matchId)
        const fieldToUpdate = [socketDataEnum.isMatchStarted, socketDataEnum.isShipsPlaced]
        for (let i = 0; i < fieldToUpdate.length; i++) {
          socket.data[fieldToUpdate[i]] = socketData[fieldToUpdate[i]]
        }
        socket.data[socketDataEnum.matchId] = obj.matchId
        socket.emit(OutcomingEventsEnum.ReconectToGame, obj)
      } else {
        socket.join('lobby');
        socket.emit(OutcomingEventsEnum.JoinedLobby);
      }
    });
    socket.on(EventsEnum.Fire, (args) => {
      const { matchId, isMatchStarted, isShipsPlaced } = socketDataEnum
      const data = socket.data
      console.log(data)
      if (!data[matchId]) {
        socket.emit(OutcomingEventsEnum.Error, `Not in match`)
        return
      }
      if (!data[isShipsPlaced]) {
        socket.emit(OutcomingEventsEnum.Error, `Ships not placed`)
        return
      }
      if (!data[isMatchStarted]) {
        socket.emit(OutcomingEventsEnum.Error, 'Oponent ships not placed')
        return
      }
      gameService.fire({
        matchId: socket.data[socketDataEnum.matchId],
        id: socket.data[socketDataEnum.userId],
        position: args,
      });

    });
    socket.on(EventsEnum.PlaceShips, (args) => {
      console.log('aboba')
      gameService.placeShip(socket.data[socketDataEnum.matchId], userId, args);
    });
  });

  done();
};

module.exports = fp(socketPlugin, { dependencies: ['gameService'] });
