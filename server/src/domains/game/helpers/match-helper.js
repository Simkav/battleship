const CustomError = require('../../../errors/CustomError');
const { FieldEnum } = require('battleship-field');
const ServerField = require('./serverField');


class MatchHelper {
  constructor(data) {
    this._field = new ServerField(data.field, data.ships);
  }

  updateField(update) {
    for (const status in update) {
      console.log(status, 'status');
      update[status].forEach((cell) => this._field._setCellField(cell, status));
    }
  }
  // TODO here
  validateShips(ship) {
    return this._field.validateShips(ships)
  }
  /**
   * @deprecated
   */
  _validateShips(ships) {
    const newShips = ships.map((ship) => this._isValidShip(ship));
    if (newShips.find((el) => el === false)) {
    }
    if (this._isShipsIntersect(newShips)) {
      console.log(ServerField.createFieldWithShips(newShips)._toPrint());
      console.log(newShips);
      throw new CustomError('Ships ships Intersect');
    }
    const fleet = newShips.reduce((acc, ship) => {
      const shipLength = ship.split(',').length;
      acc[shipLength] = acc[shipLength] + 1 || 1;
      return acc;
    }, {});
    for (const shipLength in fleet) {
      if (fleet[shipLength] !== this._shipsFleet[shipLength])
        throw new CustomError('Invalid fleet', shipLength);
    }
    return newShips;
  }

  isPlayerContinueShooting(result) {
    return [FieldEnum.dead, FieldEnum.hit].includes(result)
  }

  placeShips(ships) {
    const newShips = this._validateShips(ships);
    const field = ServerField.createFieldWithShips(newShips);
    this._field = field;
    return true;
  }

  fireAtPosition(position) {
    console.log(this._field._errorClass)
    const fireResult = this._field.fire(position);
    if (fireResult === FieldEnum.hit) {
      const ship = this._field.findShipByCell(position);
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
  /**
   * @deprecated
   */
  _isShipsIntersect = (ships) => {
    const cellsSet = new Set(this._getAreaAroundShip(ships[0]));
    for (let shipIndex = 1; shipIndex < ships.length; shipIndex++) {
      const ship = ships[shipIndex];
      const shipCells = ship.split(',');
      if (shipCells.some((cell) => cellsSet.has(cell)))
        throw new CustomError(shipCells.join(','));
      this._getAreaAroundShip(ship).forEach((cell) => cellsSet.add(cell));
    }
    return false;
  };
  /**
   * @deprecated
   */
  _isValidShip(ship) {
    if (!this._shipCheckRegexp.test(ship))
      throw new CustomError('Invalid ship', ship);
    const cells = ship.split(',');
    if (cells.length > 1) {
      let direction = null;
      if (new Set(cells.map((v) => v[0])).size === 1) direction = 1;
      if (new Set(cells.map((v) => v[1])).size === 1) direction = 0;
      if (direction === null) throw new CustomError('Invalid ship', ship);
      cells.sort((a, b) => (a[direction] > b[direction] ? 1 : -1));
      this._isShipComponentFollows(cells, direction);
      return cells.join(',');
    } else {
      return ship;
    }
  }
  /**
   * @deprecated
   */
  _isShipComponentFollows(ship, direction) {
    for (let i = 0; i < ship.length - 1; i++) {
      if (ship[i + 1][direction] - ship[i][direction] !== 1)
        throw new CustomError('Ship component not follow', ship);
    }
  }
  /**
   * @deprecated
   */
  _getAreaAroundShip(ship) {
    const shipCells = ship.split(',');
    const firstCell = shipCells[0];
    const lastCell = shipCells[shipCells.length - 1];
    const firstFormatedCell = `${Number(firstCell[0]) - 1 === -1 ? 0 : Number(firstCell[0]) - 1
      }${Number(firstCell[1]) - 1 === -1 ? 0 : Number(firstCell[1]) - 1}`;
    const lastFormatedCell = `${Number(lastCell[0]) + 1 === 10 ? 9 : Number(lastCell[0]) + 1
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

  isShipsPlaced() {
    return Boolean(this._field.ships.length);
  }

  _getJsonData() {
    return JSON.stringify(this._field._prepareDataToJson());
  }

  _getOponentJsonData() {
    return JSON.stringify({ field: this._field.prepareFieldToOponnent() });
  }

  static _getDefaultData() {
    return new ServerField().fieldToString();
  }
}

MatchHelper.prototype._shipCheckRegexp = new RegExp(
  '([0123456789]{2},)*[0123456789]{2}'
);
/* 
TODO Refactor to pass arguments
*/
MatchHelper.prototype._shipsFleet = { 5: 1, 4: 2, 3: 3, 2: 4, 1: 5 };

module.exports = MatchHelper;
