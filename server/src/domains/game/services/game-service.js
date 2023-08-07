const { default: fastify } = require('fastify');
const { OutcomingEventsEnum: EventsEnum, OutcomingEventsEnum } = require('../../../enum/event-enum');
const gameServiceEnum = require('../../../enum/game-service-enum');
const socketDataEnum = require('../../../enum/socket-data-enum');
const MatchHelper = require('../helpers/match-helper');
const { userId } = require('../../../enum/socket-data-enum');
const CustomError = require('../../../errors/CustomError');
// TODO Refactor all methods to accept obj with parametrs instead of raw params
class GameService {
  // TODO refactor redis and db to service
  /**
   *
   * @param {import('socket.io').Namespace} io
   * @param {import('@fastify/redis').FastifyRedis} redis
   * @param {import('@prisma/client').PrismaClient} db
   * @param {import('@sentry/node')} sentry
   */
  constructor(io, redis, db, sentry) {
    this._io = io;
    this._redis = redis;
    this._db = db;
    this._sentry = sentry;
    this._intervalLobbySearchId = setInterval(() => {
      const lobby = this._io.adapter.rooms.get('lobby');
      if (!lobby || lobby.size < 2) return;
      const iterator = lobby.values();
      for (let i = 0; i < lobby.size / 2; i++) {
        const ids = [iterator.next().value, iterator.next().value];
        this._startGame(ids);
      }
    }, 1000);
  }
  /**
   *
   * @param {string} matchId
   * @param {string} id
   * @param {string} position
   */
  async fire({ matchId, id, position }) {
    try {
      const matchSlugWithId = `${this._ENUM.matchSlug}${matchId}`;
      const currentPlayer = await this._redis.hget(
        matchSlugWithId,
        this._ENUM.currentPlayerKeyName
      );
      if (currentPlayer === null) throw new CustomError('Game not found');
      console.log(currentPlayer);
      if (currentPlayer !== id) throw new CustomError('Not your move');

      const lockKey = this._ENUM.lockSlug + matchSlugWithId;
      const isLocked = await this._redis.set(lockKey, '', 'EX', 2, 'NX');
      if (isLocked === null) throw new CustomError('Match locked');

      const oponentId = await this._getOponentId(matchId, id);

      const oponentData = await this._redis.hget(
        `${this._ENUM.matchSlug}${matchId}`,
        oponentId
      );

      const parsedData = JSON.parse(oponentData);
      const helper = new MatchHelper(parsedData);
      const fireResult = helper.fireAtPosition(position);

      if (fireResult.status === 'end') {
        await this.endGame(matchId, id);
        this._io
          .to(matchSlugWithId)
          .emit(EventsEnum.MatchUpdate, { update: fireResult.update });
        return;
        // TODO todo
      }

      helper.updateField(fireResult.update);
      const newOponentData = helper._getJsonData();
      fireResult.playerId = oponentId;
      const updateData = { update: fireResult, currentPlayer: oponentId, position };
      const redisUpdate = {
        [oponentId]: newOponentData,
        currentPlayer: oponentId
      }
      if (helper.isPlayerContinueShooting(fireResult.status)) {
        updateData.currentPlayer = id
        redisUpdate.currentPlayer = id
      }

      await this._redis.hset(matchSlugWithId, redisUpdate);
      await this._redis.del(lockKey);
      this._io.to(matchSlugWithId).emit(EventsEnum.MatchUpdate, updateData);
      await this._redis.set(
        this._ENUM.shadowKey + matchSlugWithId,
        '',
        'EX',
        30
      );
    } catch (error) {
      if (error instanceof CustomError) {
        this._io.to(id).emit(EventsEnum.Error, error.message, error.data);
      }
      this._sentry.captureException(error);
      console.error(error);
    }
  }

  // TODO
  async placeShipsV2(id, ships) {
    try {
      const matchHelper = new MatchHelper()
      const validatedShips = matchHelper.validateShips(ships)
      await this._redis.set(this._ENUM.ships + id, validatedShips.join(';'), 'EX', 60)
    } catch (error) {
      if (error instanceof CustomError) {
        this._io.to(id).emit(EventsEnum.Error, error.message, error.data);
      }
      this._sentry.captureException(error);
      console.error(error);
    }
  }

  async placeShip(matchId, id, ships) {
    try {
      console.log('matchId', matchId)
      console.log('id', id)
      console.log('ships', ships)

      const matchSlugWithId = `${this._ENUM.matchSlug}${matchId}`;
      const currentPlayer = (await this._redis.hget(
        matchSlugWithId,
        this._ENUM.currentPlayerKeyName
      ));

      if (currentPlayer === 0) {
        this._io.to(id).emit(EventsEnum.GameNotFound);
        return;
      }

      if (currentPlayer !== id) {
        this._io.to(id).emit(EventsEnum.NotYourMove);
        return;
      }

      const shipsPlacedPlayers = (
        await this._redis.hget(matchSlugWithId, this._ENUM.shipsPlacedKeyName)
      )
        .split(',')
        .filter(Boolean);
      console.log(shipsPlacedPlayers, 'ships1234')
      if (
        shipsPlacedPlayers.length === 2 ||
        shipsPlacedPlayers.includes(String(id))
      ) {
        throw new CustomError('Ships already placed');
      }
      const playerData = await this._redis.hget(matchSlugWithId, String(id));
      const matchHelper = new MatchHelper(JSON.parse(playerData));
      const lockKey = this._ENUM.lockSlug + matchSlugWithId;
      const isLocked = await this._redis.set(lockKey, '', 'EX', 5, 'NX');
      if (isLocked === null) throw new Error('Match locked');
      const isPlaced = matchHelper.placeShips(ships);
      const data = matchHelper._getJsonData();
      console.log(await this._redis.hgetall(matchSlugWithId), 'BEFORE');
      const oponentId = await this._getOponentId(matchId, id);
      await this._redis.hset(matchSlugWithId, {
        [id]: data,
        [this._ENUM.currentPlayerKeyName]: oponentId,
        [this._ENUM.shipsPlacedKeyName]: shipsPlacedPlayers.length
          ? shipsPlacedPlayers[0] + ',' + id
          : id + ',',
      });
      console.log(await this._redis.hgetall(matchSlugWithId), 'AFTER');
      await this._redis.del(lockKey);
      this._io.to(id).emit(EventsEnum.ShipsSucsPlaced);
      const [userSocket] = this._io.adapter.rooms.get(id);
      this._io.sockets.get(userSocket).data[socketDataEnum.isShipsPlaced] = true
      console.log(shipsPlacedPlayers, 'ADASDASDQWEQWEQWEQWE')
      if (!shipsPlacedPlayers.includes(String(oponentId))) {
        this._io.to(oponentId).emit(EventsEnum.AskToPlaceShip);
      } else {
        const match = this._io.adapter.rooms.get(matchSlugWithId);
        for (const id of match.values()) this._io.sockets.get(id).data[socketDataEnum.isMatchStarted] = true
        this._io
          .to(String(matchSlugWithId))
          .emit(EventsEnum.StartGame, { currentPlayer: oponentId });
      }
      await this._redis.set(
        this._ENUM.shadowKey + matchSlugWithId,
        '',
        'EX',
        30
      );
    } catch (error) {
      console.log(error, `dsadas
      asdasd
      asdasd
      asd`)
      if (error instanceof CustomError) {
        this._io.to(id).emit(EventsEnum.Error, error.message, error.data);
      }
      this._sentry.captureException(error);
      console.error(error);
    }
  }


  async _getOponentId(matchId, id) {
    const players = await this._redis.hget(
      this._ENUM.matchSlug + matchId,
      this._ENUM.playersKeyName
    );
    const oponentId = players.split(';').find((el) => el !== String(id));
    return oponentId;
  }

  async expireGame(matchId) {
    try {
      const matchSlugWithId = `${this._ENUM.matchSlug}${matchId}`;
      const currentPlayer = await this._redis.hget(
        matchSlugWithId,
        this._ENUM.currentPlayerKeyName
      );
      const oponentId = await this._getOponentId(matchId, currentPlayer);
      await this.endGame(matchId, oponentId);
    } catch (e) {
      console.log(e);
    }
  }

  async endGame(matchId, winnerId) {
    const keysPrefixToDelete = [
      this._ENUM.lockSlug + this._ENUM.matchSlug,
      this._ENUM.matchSlug,
      this._ENUM.shadowKey + this._ENUM.matchSlug,
    ];
    const keysToDelete = keysPrefixToDelete.map(
      (keyPrefix) => keyPrefix + matchId
    );
    await this._clearLocks(keysToDelete);
    await this._db.game.update({
      where: { id: matchId },
      data: { isEnded: true, winnerId: winnerId },
    });
    console.log(`Match : ${matchId} ended, winner : ${winnerId}`);
    const matchSlugWithId = this._ENUM.matchSlug + matchId;
    this._io
      .to(String(matchSlugWithId))
      .emit(EventsEnum.EndGame, { winner: winnerId });
  }

  async checkIfPlayerAlreadyPlaying(playerId) {
    const res = await this._db.game.findFirst({
      where: {
        OR: [{ firstPlayerId: playerId }, { secondPlayerId: playerId }],
        isEnded: false
      },
    });
    console.log(res, 'res');
    if (res === null) return false;
    const { id: matchId } = res;
    const matchSlugWithId = `${this._ENUM.matchSlug}${matchId}`;
    const matchData = await this._redis.hgetall(matchSlugWithId);
    console.log(matchData);
    console.log(matchData, 'data');
    const { currentPlayer, players } = matchData
    const oponentId = players
      .split(';')
      .find((el) => el !== String(playerId));
    const playerMatchHelper = new MatchHelper(JSON.parse(matchData[playerId]));
    const oponentMatchHelper = new MatchHelper(
      JSON.parse(matchData[oponentId])
    );
    const playerData = playerMatchHelper._getJsonData()
    const oponentData = oponentMatchHelper._getOponentJsonData()
    const shipsPlacedPlayers =
      matchData[this._ENUM.shipsPlacedKeyName]
        .split(',')
        .filter(Boolean)

    const socketData = {
      [socketDataEnum.matchId]: matchSlugWithId, [socketDataEnum.isMatchStarted]: shipsPlacedPlayers.length === 2,
      [socketDataEnum.isShipsPlaced]: shipsPlacedPlayers.includes(String(userId))
    }
    const returnedData = { currentPlayer: currentPlayer, playerData, oponentData, matchId }
    return [returnedData, socketData]
  }

  _clearInterval() {
    clearInterval(this._intervalLobbySearchId);
  }

  /**
   *
   * @param {String[]} locks
   */
  async _clearLocks(locks) {
    await this._redis.del(locks);
  }

  /**
   *
   * @param {string[]} socketsId
   */
  async _startGame(socketsId) {
    try {
      console.log(socketsId);
      const sockets = socketsId.map((id) => this._io.sockets.get(id));
      if (
        sockets.some((socket) => socket === undefined || socket.disconnected)
      ) {
        console.log('Something goes wrong, socketsId', socketsId);
        console.dir(sockets);
        return;
      }
      const userIds = sockets.map((socket) => socket.data.userId);
      console.log(userIds)
      const { id } = await this._db.game.create({
        data: {
          firstPlayerId: userIds[0],
          secondPlayerId: userIds[1],
        },
        select: { id: true },
      });
      const matchSlugWithId = this._ENUM.matchSlug + id;
      console.log(`createdGame with id ${matchSlugWithId}, players:${userIds}`);
      sockets.forEach((socket) => {
        socket.leave('lobby');
        socket.join(matchSlugWithId);
        socket.data[socketDataEnum.matchId] = id;
      });

      const data = {
        [sockets[0].data.userId]: this._initData,
        [sockets[1].data.userId]: this._initData,
        [this._ENUM.currentPlayerKeyName]: sockets[0].data.userId,
        [this._ENUM.playersKeyName]: [
          sockets.map((socket) => socket.data.userId).join(';'),
        ],
        [this._ENUM.shipsPlacedKeyName]: '',
      };
      sockets.forEach((socket) => (socket.data[socketDataEnum.matchId] = id));
      await this._redis.hset(matchSlugWithId, data);
      await this._redis.set(
        this._ENUM.shadowKey + matchSlugWithId,
        '',
        'EX',
        30
      );

      sockets.forEach((socket) => {
        socket.emit(EventsEnum.MatchCreated, {
          id,
          currentPlayer: userIds[0],
        });
      });
      const firstSocket = sockets.find((socket) =>
        socket.data.userId == userIds[0]
      )
      firstSocket.emit(OutcomingEventsEnum.AskToPlaceShip)
      console.log('game started');
    } catch (e) {
      console.log(e);
    }
  }
}

GameService.prototype._ENUM = gameServiceEnum;
GameService.prototype._initData = JSON.stringify({
  ships: [],
  field: MatchHelper._getDefaultData(),
});
GameService.prototype._keysPrefixToDelete = [
  GameService.prototype._ENUM.matchSlug,
  GameService.prototype._ENUM.lockSlug,
  GameService.prototype._ENUM.shadowKey,
];

module.exports = GameService;
