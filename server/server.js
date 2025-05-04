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
 *   roomId: string,
 *   contents: {
 *     players: [
 *       {
 *         name: string,
 *         socketId: string,
 *         hp: number,
 *         commands: ["attack", "defend", ...]
 *       }
 *     ],
 *     turnCount: number,
 *     actions: [
 *       {
 *         playerName: string,
 *         action: string,
 *         targetName: string
 *       }[]
 *     ]
 *   }
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
      io.to(roomId).emit('next-turn', {
        turnCount: roomData.turnCount,
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

  // Track who is defending
  const defendingPlayers = new Set();
  currentActions.forEach(({ playerName, action }) => {
    if (action === 'defend') {
      defendingPlayers.add(playerName);
    }
  });

  // Apply attack damage
  currentActions.forEach(({ playerName, action, targetName }) => {
    if (action === 'attack') {
      const target = roomData.players.find(p => p.name === targetName);
      if (target && !defendingPlayers.has(targetName)) {
        target.hp = Math.max(0, target.hp - 1);
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

  socket.on('join-room', (room, playerName) => {
    const roomData = rooms[room];
    if (roomData) {
      if (roomData.started) {
        socket.emit('started-error');
      } else {
        roomData.players.push({ name: playerName, socketId: socket.id, hp: 3, commands: [] });
        socket.join(room);
        io.to(room).emit('new-player', roomData.players.map(p => ({ name: p.name, hp: p.hp })));
        console.log(`${playerName} joined room ${room}`);
      }
    } else {
      socket.emit('non-existent-error', 'Room does not exist');
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
      processTurn(room); // Apply game logic
      emitNextTurn(room); // Then go to next turn
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
