const firstPlayerId = 'aboba25123';
const secondPlayerId = 'Bigchkoloatamazafaka';

const dataSample = {
  field:
    '0000000000,0000000000,0000000000,0000000000,0000000000,0000000000,0000000000,0000000000,0000000000,0000000000',
  ships: [
    '00,01,02,03,04',
    '06,07,08,09',
    '21,22,23,24',
    '26,27,28',
    '35,36,37',
    '40,41,42',
    '60,61',
    '63,64',
    '66,67',
    '70,71',
    '81',
    '83',
    '85',
    '87',
    '89',
  ],
};
class GameService {
  // TODO refactor redis and db to service
  /**
   *
   * @param {import('socket.io').Server} io
   * @param {import('@fastify/redis').FastifyRedis} redis
   * @param {import('@prisma/client').PrismaClient} db
   */
  constructor(io, redis, db) {
    this._io = io;
    this._redis = redis;
    this._db = db;
    this._intervalLobbySearchId = setInterval(() => {
      const lobby = this._io.of('/').adapter.rooms.get('lobby');
      if (lobby.size < 2) return;
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
  async fire(matchId, id, position) {
    try {
      const currentPlayer = await this._redis.hget(
        this._ENUM.matchSlug + matchId,
        this._ENUM.currentPlayerKeyName
      );
      if (currentPlayer === null) {
        throw new Error('game not found');
      }
      if (currentPlayer !== id) {
        throw new Error('Not your move');
      }

      const matchSlugWithId = `${this._ENUM.matchSlug}${matchId}`;
      const lockKey = this._ENUM.lockSlug + matchSlugWithId;
      const isLocked = await this._redis.set(lockKey, '', 'EX', 5, 'NX');
      if (isLocked === null) {
        throw new Error('Match locked');
      }

      const players = await this._redis.hget(
        matchSlugWithId,
        this._ENUM.playersKeyName
      );

      const oponentId = players.split(';').find((el) => el.id !== id);

      const oponentData = await this._redis.hget(
        `${this._matchSlug}${matchId}`,
        oponentId
      );
      const parsedData = JSON.parse(oponentData);
      const helper = new MatchHelper(parsedData);
      const field = new Field(parsedData.field);

      const fireResult = helper.fireAtPosition(field, position);

      helper.updateField(fireResult);

      const newOponentData = helper._getData();

      await this._redis.hset(matchSlugWithId, {
        [oponentId]: newOponentData,
        currentPlayer,
      });
      if (fireResult.status === 'end') {
      }
      fireResult.playerId = oponentId;
      const updateData = { update: fireResult, currentPlayer: oponentId };
      // TODO update time shadowkey
      await this._redis.del(lockKey);
      this._io.to(matchSlugWithId).emit('update', updateData);
      await this._redis.set(
        this._ENUM.shadowKey + matchSlugWithId,
        '',
        'EX',
        30
      );
    } catch (error) {
      console.error(error);
      this._io.to(id).emit('error', error);
    }

    // cur = redis.hget matchId currentPlayer
    // if cur != id return error
    // set lock if(err) with expire time(on case shutdown)  return error else set lock
    // matchService.fire
    // return
    // finaly release lock
  }

  async placeShip(matchId, id, ships) {
    try {
      const matchSlugWithId = `${this._ENUM.matchSlug}${matchId}`;

      const currentPlayer = await this._redis.hget(
        matchSlugWithId,
        this._ENUM.currentPlayerKeyName
      );
      if (currentPlayer === null) {
        throw new Error('game not found');
      }
      if (currentPlayer !== id) {
        throw new Error('Not your move');
      }
      const lockKey = this._ENUM.lockSlug + matchSlugWithId;
      const isLocked = await this._redis.set(lockKey, '', 'EX', 5, 'NX');
      if (isLocked === null) {
        throw new Error('Match locked');
      }
      const playerData = await this._redis.hget(matchSlugWithId, String(id));
      const matchHelper = new MatchHelper(JSON.parse(playerData));
      const isPlaced = matchHelper.placeShips(ships);
      const data = matchHelper._getData();
      await this._redis.hset(matchSlugWithId, { id: data });
      await this._redis.del(lockKey);
      this._io.to(id).emit('ships-placed');
      const players = await this._redis.hget(
        matchSlugWithId,
        this._ENUM.playersKeyName
      );
      const oponentId = players.split(';').find((el) => el.id !== id);
      this._io.to(oponentId).emit('place-ship');
      await this._redis.set(
        this._ENUM.shadowKey + matchSlugWithId,
        '',
        'EX',
        30
      );
    } catch (error) {
      console.error(error);
      this._io.to(id).emit('error', error);
    }
    /* 
    ack id that place shiped
    ask oponentId that need to place ship
    */
  }

  async endGame(matchId, winnerId, isEnded = true) {
    const keysPrefixToDelete = [
      this._ENUM.matchSlug,
      this._ENUM.lockSlug,
      this._ENUM.shadowKey,
    ];
    const keysToDelete = keysPrefixToDelete.map(
      (keyPrefix) => keyPrefix + matchId
    );
    await this._redis.del(keysToDelete);
    await this._db.game.update({
      where: { id: matchId },
      data: { isEnded: true, winnerId: winnerId },
    });
    this._io.to(matchId).emit('game-end', { winner: winnerId });
  }

  _clearInterval() {
    clearInterval(this._intervalLobbySearchId);
  }
  /**
   *
   * @param {string[]} socketsId
   */
  async _startGame(socketsId) {
    const sockets = socketsId.map((id) => this._io.of('/').sockets.get(id));
    if (sockets.some((socket) => socket === undefined || socket.disconnected()))
      return;
    const userIds = sockets.map((socket) => socket.data.userId);
    const { id } = await this._db.game.create({
      data: {
        firstPlayerId: Number(userIds[0]),
        secondPlayerId: Number(userIds[1]),
      },
      select: { id: true },
    });
    const matchSlugWithId = this._ENUM.matchSlug + id;

    sockets.forEach((socket) => {
      socket.leave('lobby');
      socket.join(matchSlugWithId);
    });

    const data = {
      [sockets[0].data.userId]: this._initData,
      [sockets[1].data.userId]: this._initData,
      [this._currentPlayerKeyname]: sockets[0].data.userId,
      [this._playersKeyName]: [
        sockets.map((socket) => socket.data.userId).join(';'),
      ],
    };
    sockets.forEach((socket) => (socket.data.matchId = id));
    await this._redis.hset(matchSlugWithId, data);
    await this._redis.set(this._ENUM.shadowKey + matchSlugWithId, '', 'EX', 30);

    sockets.forEach((socket) => {
      socket.emit('game-started', {
        id,
        currentPlayer: Number(userIds[0]),
      });
    });
  }
}

GameService.prototype._matchSlug = 'match:';
GameService.prototype._ENUM = {
  lockSlug: 'lock:',
  matchSlug: 'match:',
  currentPlayerKeyName: 'currentPlayer',
  playersKeyName: 'players',
  shadowKey: 'shadow:',
};
GameService.prototype._initData = JSON.stringify({
  ships: [],
  field: new Field().fieldToString(),
});
GameService.prototype._currentPlayerKeyname = 'currentPlayer';
GameService.prototype._playersKeyName = 'players';

class MatchHelper {
  constructor(data = dataSample) {
    this._field = new Field(data.field);
    this._ships = data.ships;
  }

  updateField(update) {
    for (const status in update) {
      update[status].forEach((cell) => this._field._setCellField(cell, status));
    }
  }

  _validateShips(ships) {
    const newShips = ships.map((ship) => this._isValidShip(ship));
    if (this._isShipsIntersect(newShips))
      throw new Error('Ships ships Intersect');
    const fleet = newShips.reduce((acc, ship) => {
      const shipLength = ship.split(',').length;
      acc[shipLength] = acc[shipLength] + 1 || 1;
      return acc;
    }, {});
    for (const shipLength in fleet) {
      if (fleet[shipLength] !== this._shipsFleet[shipLength])
        throw new Error('Invalid fleet');
    }
    return newShips;
  }

  placeShips(ships) {
    try {
      const newShips = this._validateShips(ships);
      const field = Field.createFieldWithShips(newShips);
      this._ships = ships;
      this._field = field;
      return true;
    } catch (e) {
      console.log(e);
      return false;
    }
  }

  fireAtPosition(position) {
    const fireResult = this._field.fire(position);
    if (fireResult === FieldEnum.hit) {
      const ship = this._field.findShipByCell(position, this._ships);
      if (this._field.isShipDestroyedByCell(ship)) {
        if (this._field.isAllShipDestroyed())
          return { status: 'end', update: { [FieldEnum.dead]: [position] } };
        const blockedArea = new Set(this._getAreaAroundShip(ship));
        const shipCells = ship.split(',');
        shipCells.forEach((cell) => blockedArea.delete(cell));
        return {
          status: FieldEnum.dead,
          update: {
            [FieldEnum.dead]: shipCells,
            [FieldEnum.blockedzone]: [...blockedArea],
          },
        };
      }
    }
    return { status: fireResult, update: { [fireResult]: [position] } };
  }

  _isShipsIntersect = (ships) => {
    const cellsSet = new Set(this._getAreaAroundShip(ships[0]));
    for (let shipIndex = 1; shipIndex < ships.length; shipIndex++) {
      const ship = ships[shipIndex];
      const shipCells = ship.split(',');
      if (shipCells.some((cell) => cellsSet.has(cell))) return true;
      this._getAreaAroundShip(ship).forEach((cell) => cellsSet.add(cell));
    }
    return false;
  };

  _isValidShip(ship) {
    if (!this._shipCheckRegexp.test(ship)) throw new Error('Invalid ship');
    const cells = ship.split(',');
    if (cells.length > 1) {
      let direction = null;
      if (new Set(cells.map((v) => v[0])).size === 1) direction = 1;
      if (new Set(cells.map((v) => v[1])).size === 1) direction = 0;
      if (direction === null) throw new Error('Invalid ship');
      cells.sort((a, b) => (a[direction] > b[direction] ? 1 : -1));
      this._isShipComponentFollows(cells, direction);
      return cells.join(',');
    } else {
      return ship;
    }
  }

  _isShipComponentFollows(ship, direction) {
    for (let i = 0; i < ship.length - 1; i++) {
      if (ship[i + 1][direction] - ship[i][direction] !== 1)
        throw new Error('ShipComponentsNotFollow');
    }
  }

  _getAreaAroundShip(ship) {
    const shipCells = ship.split(',');
    const firstCell = shipCells[0];
    const lastCell = shipCells[shipCells.length - 1];
    const firstFormatedCell = `${
      Number(firstCell[0]) - 1 === -1 ? 0 : Number(firstCell[0]) - 1
    }${Number(firstCell[1]) - 1 === -1 ? 0 : Number(firstCell[1]) - 1}`;
    const lastFormatedCell = `${
      Number(lastCell[0]) + 1 === 10 ? 9 : Number(lastCell[0]) + 1
    }${Number(lastCell[1]) + 1 === 10 ? 9 : Number(lastCell[1]) + 1}`;
    const horizontal = Number(lastFormatedCell[0] - firstFormatedCell[0]);
    const vertical = Number(lastFormatedCell[1] - firstFormatedCell[1]);
    return new Array(horizontal + 1)
      .fill(null)
      .map((v, i) => `${Number(firstFormatedCell[0]) + i}`)
      .map((v) =>
        new Array(vertical + 1)
          .fill(null)
          .map((_, i) => `${v}${Number(firstFormatedCell[1]) + i}`)
      )
      .flat();
  }

  _getData() {
    return JSON.stringify({
      ships: this._ships,
      field: this._field.fieldToString(),
    });
  }
}

MatchHelper.prototype._shipCheckRegexp = new RegExp(
  '([0123456789]{2},)*[0123456789]{2}'
);
MatchHelper.prototype._shipsFleet = { 5: 1, 4: 1, 3: 1, 2: 1, 1: 1 };

// for testings
const formatField = (field) => field.split(',').join('\n');

// fn('10,00,20,50,40'); =>
// console.log('--------------------');
// isValidShip('50,54,53,52,51');

// getAreaOfShip('50,51,52,53,54');
/* x=>
2222200000 
0020200000
0020000000
0020200000
0000000000
0000022222
0000000000
0000200000  
0000200000 II
0000200000 y
*/

const FieldEnum = {
  free: '0',
  missed: '1',
  ship: '2',
  hit: '3',
  dead: '4',
  blockedzone: '5',
};

/* 
  blockedzone = 0 after all 2 turn to 4 
*/

class Field {
  constructor(
    field = '0000000000,0000000000,0000000000,0000000000,0000000000,0000000000,0000000000,0000000000,0000000000,0000000000',
    ships
  ) {
    /* 
    // Start check valid field
    if (typeof field !== 'string' || field.length !== 109)
      throw new Error('invalid field');
    const regExp = new RegExp(`[${Object.values(FieldEnum).join('')},]`, 'g');
    if (field.replace(regExp, '').length !== 0)
      throw new Error('invalid field');
    //  End check valid field 
    */
    this.fields = field.split(',');
    this.possibleShots = [FieldEnum.free, FieldEnum.ship];
    this.ships = ships;
  }

  fire(position) {
    if (
      typeof position !== 'string' ||
      position.length !== 2 ||
      position.replaceAll(/\D/g, '').length !== 2
    ) {
      throw new Error('invalid position');
    }

    const cellValue = this._getCellField(position);
    if (!this.possibleShots.includes(cellValue)) {
      throw new Error('Stupid shot');
    }
    const cellStatus =
      cellValue === FieldEnum.ship ? FieldEnum.hit : FieldEnum.missed;
    this._setCellField(position, cellStatus);
    return cellStatus;
  }

  _getCellField(position) {
    return this.fields[position[1]][position[0]];
  }

  _setCellField(position, status) {
    const [x, y] = position;
    const verticalPart = this.fields[y].split('');
    verticalPart[x] = status;
    this.fields[y] = verticalPart.join('');
  }

  /**
   *
   * @param {string[]} ships
   */
  placeShips(ships) {
    const cells = ships.join(this._cellSeparator).split(this._cellSeparator);
    cells.forEach((cell) => this._setCellField(cell, FieldEnum.ship));
  }

  /**
   *
   * @param {string[]} ships
   */
  isShipDestroyedByCell(ship) {
    return ship
      .split(',')
      .every((shipCell) => this._getCellField(shipCell) === FieldEnum.hit);
  }

  findShipByCell(cell, ships) {
    return ships.find((ship) => ship.includes(cell));
  }

  prepareFieldToOponnent() {
    return this.fieldToString().replaceAll('2', '0');
  }

  isAllShipDestroyed() {
    return !this.fieldToString().includes('2');
  }

  fieldToString() {
    return this.fields.join(',');
  }

  static createFieldWithShips(ships) {
    const field = new Field();
    field.placeShips(ships);
    return field.fieldToString();
  }
}

Field.prototype._cellSeparator = ',';

// const test = '99';
// const shipField = new Field();

// test.split(',').forEach((v) => shipField.fire(v));

// const field = new Field();

// getAreaAroundShip(test).forEach((v) => field.fire(v));

// console.log(formatField(shipField.fieldToString()));
// console.log('------------------------');
// console.log(formatField(field.fieldToString()));

const ships = [
  '00,10,20,30,40',
  '60,70,80,90',
  '02,12,22,32,42',
  '99',
  '65,55,45,75',
  '09',
  '78',
  '04,05',
];

const data = {
  players: [
    {
      id: firstPlayerId,
      field:
        '0000000000,0000000000,0000000000,0000000000,0000000000,0000000000,0000000000,0000000000,0000000000,0000000000',
      ships: [],
    },
    {
      id: secondPlayerId,
      field:
        '0000000000,0000000000,0000000000,0000000000,0000000000,0000000000,0000000000,0000000000,0000000000,0000000000',
      ships: [],
    },
  ],
  currentPlayer: firstPlayerId,
};

const firstShips = ['00,10,20,30,40', '06,07,08,09', '26,27,28', '60,61', '83'];

const secondShips = [
  '00,10,20,30,40',
  '06,07,08,09',
  '26,27,28',
  '60,61',
  '83',
];

let service = new MatchHelper(data);

const firstValidatedShips = service.validateShips(firstShips);
const secondValidatedShips = service.validateShips(secondShips);

service.placeShips(firstValidatedShips, firstPlayerId);
service.placeShips(secondValidatedShips, secondPlayerId);

const hit = (pos) => {
  console.log('fire at ' + pos);
  const result = service.fireAtPosition(firstPlayerId, pos);
  console.log(result, 'result');
  service.updateField(firstPlayerId, result.update);
  if (result.status === 'end') console.log('end');
};

['00,10,20,30,40', '06,07,08,09', '26,27,28', '60,61', '83']
  .join(',')
  .split(',')
  .forEach((cell) => hit(cell));

// '00,10,20,30,40'.split(',').forEach((cell) => hit(cell));

console.log(formatField(service.getPlayerDataById(secondPlayerId).field));
