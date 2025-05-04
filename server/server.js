const { Server } = require('socket.io');
const io = new Server(3000, {
  cors: {
    origin: ['http://localhost:5173'],
  }
});

let rooms = {};

/**
 * ROOM STRUCTURE
 * rooms = {
 *   [roomId]: {
 *     id: string,
 *     players: [
 *       {
 *         name: string,
 *         socketId: string,
 *         hp: number,
 *         commands: string[]
 *       }
 *     ],
 *     leader: string,
 *     started: boolean,
 *     playerTurn: number,
 *     turnCount: number,
 *     actions: Array<Array<{
 *       playerName: string,
 *       action: string,
 *       targetName: string,
 *       result?: string
 *     }>>
 *   }
 * }
 */

function emitNextTurn(roomId) {
  const roomData = rooms[roomId];
  if (!roomData || roomData.players.length === 0) return;

  const totalPlayers = roomData.players.length;
  let nextTurn = (roomData.playerTurn + 1) % totalPlayers;

  let safety = 0;
  while (safety < totalPlayers) {
    const player = roomData.players[nextTurn];
    const isConnected = io.sockets.sockets.get(player.socketId);
    if (isConnected) {
      roomData.playerTurn = nextTurn;
      roomData.turnCount += 1;
      roomData.actions.push([]); // New turn's actions

      // Emit turn count and log
      io.to(roomId).emit("next-turn", {
        turnCount: roomData.turnCount,
      });
      io.to(roomId).emit("turn-log", `Turn ${roomData.turnCount} has begun`);

      // Log action results from previous turn
      const previousTurnActions = roomData.actions[roomData.turnCount - 2] || [];
      previousTurnActions.forEach((action) => {
        if (action.action === "defend") {
          io.to(roomId).emit("turn-log", `${action.playerName} defended`);
        } else if (action.action === "attack") {
          let msg = `${action.playerName} attacked ${action.targetName}`;
          if (action.result === "blocked") msg += " (attack was blocked)";
          else if (action.result === "successful") msg += " (attack successful)";
          else msg += " (attack failed)";
          io.to(roomId).emit("turn-log", msg);
        }
      });

      return;
    }
    nextTurn = (nextTurn + 1) % totalPlayers;
    safety++;
  }

  console.log(`No connected players left to take the next turn in room ${roomId}`);
}

function processTurn(roomId) {
  const roomData = rooms[roomId];
  const currentActions = roomData.actions[roomData.turnCount - 1];

  const defendingPlayers = new Set();
  currentActions.forEach(action => {
    if (action.action === 'defend') {
      defendingPlayers.add(action.playerName);
      action.result = 'defended';
    }
  });

  currentActions.forEach(action => {
    if (action.action === 'attack') {
      const target = roomData.players.find(p => p.name === action.targetName);
      if (target) {
        if (defendingPlayers.has(action.targetName)) {
          action.result = 'blocked';
        } else {
          target.hp = Math.max(0, target.hp - 1);
          action.result = 'successful';
        }
      } else {
        action.result = 'invalid';
      }
    }
  });

  io.to(roomId).emit("players-update", roomData.players.map(p => ({ name: p.name, hp: p.hp })));
}

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('create-room', (room, playerName) => {
    rooms[room] = {
      id: room,
      players: [{ name: playerName, socketId: socket.id, hp: 3, commands: [] }],
      leader: playerName,
      started: false,
      playerTurn: 0,
      turnCount: 0,
      actions: [[]],
    };
    socket.join(room);
    io.to(room).emit('new-player', rooms[room].players.map(p => ({ name: p.name, hp: p.hp })));
    console.log(`Room ${room} created by ${playerName}`);
  });

  socket.on("join-room", (room, playerName) => {
    const roomData = rooms[room];
    if (roomData) {
      if (roomData.started) {
        socket.emit("started-error");
      } else if (roomData.players.some(p => p.name === playerName)) {
        socket.emit("duplicate-name-error");
      } else {
        roomData.players.push({ name: playerName, socketId: socket.id, hp: 3, commands: [] });
        socket.join(room);
        io.to(room).emit("new-player", roomData.players.map(p => ({ name: p.name, hp: p.hp })));
        socket.emit("join-success", room);
        console.log(`${playerName} joined room ${room}`);
      }
    } else {
      socket.emit("non-existent-error");
    }
  });

  socket.on('check-room', (room) => {
    const roomData = rooms[room];
    if (roomData) {
      socket.emit('room-exists', roomData.players.map(p => ({ name: p.name, hp: p.hp })));
    } else {
      socket.emit('room-not-found');
    }
  });

  socket.on('start-game', (room, name) => {
    const roomData = rooms[room];
    if (roomData && roomData.players.length >= 2 && name === roomData.leader) {
      roomData.started = true;
      roomData.playerTurn = 0;
      roomData.turnCount = 1;
      roomData.actions = [[]];
      io.to(room).emit('start-confirm');
      console.log(`Room ${room} started by ${name}.`);
      io.to(room).emit('next-turn', {
        turnCount: roomData.turnCount,
      });
    }
  });

  socket.on('end-turn', (room) => {
    const roomData = rooms[room];
    if (!roomData || !roomData.started) return;
    emitNextTurn(room);
  });

  socket.on("get-current-turn", (room) => {
    const roomData = rooms[room];
    if (roomData && roomData.started) {
      socket.emit("next-turn", {
        turnCount: roomData.turnCount,
      });
    }
  });

  socket.on('send-command', (room, playerName, action, targetName) => {
    const roomData = rooms[room];
    if (!roomData) return;
    const playerIndex = roomData.players.findIndex(p => p.name === playerName);
    if (playerIndex === -1) return;

    roomData.players[playerIndex].commands.push(action);
    roomData.actions[roomData.turnCount - 1].push({ playerName, action, targetName });

    if (roomData.actions[roomData.turnCount - 1].length === roomData.players.length) {
      processTurn(room);
      emitNextTurn(room);
    }
  });

  socket.on("get-players", (room) => {
    const roomData = rooms[room];
    if (roomData) {
      socket.emit("players-update", roomData.players.map(p => ({ name: p.name, hp: p.hp })));
    }
  });

  socket.on("leave-room", (room, playerName) => {
    const roomData = rooms[room];
    if (!roomData) return;

    const playerIndex = roomData.players.findIndex(p => p.name === playerName);
    if (playerIndex === -1) return;

    const [removedPlayer] = roomData.players.splice(playerIndex, 1);
    console.log(`${removedPlayer.name} left room ${room}`);

    if (roomData.players.length === 0) {
      delete rooms[room];
      console.log(`Room ${room} deleted as it became empty`);
      return;
    }

    if (roomData.playerTurn >= roomData.players.length) {
      roomData.playerTurn = 0;
    }

    io.to(room).emit("players-update", roomData.players.map(p => ({ name: p.name, hp: p.hp })));

    if (roomData.started) {
      emitNextTurn(room);
    }
  });

  socket.on('disconnect', () => {
    for (const [roomId, roomData] of Object.entries(rooms)) {
      const index = roomData.players.findIndex(p => p.socketId === socket.id);
      if (index !== -1) {
        const [removedPlayer] = roomData.players.splice(index, 1);
        console.log(`${removedPlayer.name} disconnected from room ${roomId}`);

        if (roomData.players.length === 0) {
          delete rooms[roomId];
          console.log(`Room ${roomId} deleted as it became empty`);
        } else {
          io.to(roomId).emit('new-player', roomData.players.map(p => ({ name: p.name, hp: p.hp })));
        }
        break;
      }
    }
  });
});
