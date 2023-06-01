const { Field, FieldEnum } = require("battleship-field");
const CustomError = require("../../../errors/CustomError");

class ServerField extends Field {
    constructor(field, ships) {
        super(field, ships)
    }

    isShipDestroyedByCell(ship) {
        return ship
            .split(',')
            .every((shipCell) => this._getCellField(shipCell) === FieldEnum.hit);
    }

    findShipByCell(cell) {
        return this.ships.find((ship) => ship.includes(cell));
    }

    prepareFieldToOponnent() {
        return this.fieldToString().replaceAll(FieldEnum.ship, FieldEnum.free);
    }

    isAllShipDestroyed() {
        return !this.fieldToString().includes(FieldEnum.ship);
    }

    _prepareDataToJson() {
        return { field: this.fieldToString(), ships: this.ships };
    }

    static createFieldWithShips(ships) {
        const field = new ServerField();
        field.placeShips(ships);
        return field;
    }
}
Field.prototype._errorClass = CustomError
ServerField.prototype._shipsFleet = { 5: 1, 4: 2, 3: 3, 2: 4, 1: 5 };

module.exports = ServerField