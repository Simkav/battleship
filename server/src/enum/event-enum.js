const ClientEventsEnum = {
  JoinLobby: 'join-lobby',
  Fire: 'fire',
  PlaceShips: 'place-ship',
};
const ServerEventsEnum = {
  GameNotFound: 'game-not-found',
  NotYourMove: 'not-your-move',
  UserAlreadyJoined: 'user-already-joined',
  JoinedLobby: 'joined-lobby',
  MatchUpdate: 'update',
  Error: 'error',
  ShipsSucsPlaced: 'ships-placed',
  AskToPlaceShip: 'place-ship',
  MatchCreated: 'match-created',
  StartGame: 'game-start',
  EndGame: 'game-end',
  ReconectToGame: 'reconect-to-game',
  UserNotFound: 'user-not-found'
};

module.exports = { IncomingEventsEnum: ClientEventsEnum, OutcomingEventsEnum: ServerEventsEnum };
