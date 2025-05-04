const { Server } = require('socket.io');
const io = new Server(3000, {
  cors: {
    origin: ['http://localhost:5173'],
  }
});

let rooms = {};

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

      io.to(roomId).emit('next-turn', {
        turnCount: roomData.turnCount,
        currentPlayer: player.name
      });
      return;
    }
    nextTurn = (nextTurn + 1) % totalPlayers;
    safety++;
  }

  console.log(`No connected players left to take the next turn in room ${roomId}`);
}

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('create-room', (room, playerName) => {
    rooms[room] = {
      id: room,
      players: [{ name: playerName, socketId: socket.id }],
      leader: playerName,
      started: false,
      playerTurn: 0,
      turnCount: 0
    };
    socket.join(room);
    io.to(room).emit('new-player', rooms[room].players.map(p => p.name));
    console.log(`Room ${room} created by ${playerName}`);
  });

  socket.on('join-room', (room, playerName) => {
    const roomData = rooms[room];
    if (roomData) {
      if (roomData.started) {
        socket.emit('started-error');
      } else {
        roomData.players.push({ name: playerName, socketId: socket.id });
        socket.join(room);
        io.to(room).emit('new-player', roomData.players.map(p => p.name));
        console.log(`${playerName} joined room ${room}`);
      }
    } else {
      socket.emit('non-existent-error', 'Room does not exist');
    }
  });

  socket.on('check-room', (room) => {
    const roomData = rooms[room];
    if (roomData) {
      socket.emit('room-exists', roomData.players.map(p => p.name));
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

      const firstPlayer = roomData.players[0];
      console.log(`Room ${room} started by ${name}. First player: ${firstPlayer.name}`);

      io.to(room).emit('next-turn', {
        turnCount: roomData.turnCount,
        currentPlayer: firstPlayer.name
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
      const currentPlayer = roomData.players[roomData.playerTurn]?.name ?? "";
      socket.emit("next-turn", {
        turnCount: roomData.turnCount,
        currentPlayer
      });
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
          io.to(roomId).emit('new-player', roomData.players.map(p => p.name));

          // If the disconnected player was the current turn, advance turn
          const currentPlayer = roomData.players[roomData.playerTurn];
          if (!currentPlayer || currentPlayer.socketId === socket.id) {
            emitNextTurn(roomId);
          } else if (roomData.playerTurn >= roomData.players.length) {
            // Edge case: playerTurn is now out of bounds
            roomData.playerTurn = 0;
            emitNextTurn(roomId);
          }
        }
        break;
      }
    }
  });
});
