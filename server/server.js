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

  const logs = processTurn(roomId);
  logs.forEach(msg => io.to(roomId).emit("turn-log", msg));
  io.to(roomId).emit("turn-log", "---");

  const totalPlayers = roomData.players.length;
  let nextTurn = (roomData.playerTurn + 1) % totalPlayers;
  let safety = 0;

  while (safety < totalPlayers) {
    const player = roomData.players[nextTurn];
    const isConnected = io.sockets.sockets.get(player.socketId);
    if (isConnected) {
      roomData.playerTurn = nextTurn;
      roomData.turnCount += 1;
      roomData.actions.push([]);

      // Distribute power-ups every odd-numbered turn except turn 1
      if (roomData.turnCount % 2 === 1) {
        roomData.players.forEach(p => {
          const power = rollPowerUp();
          if (!p.powerUps[power]) p.powerUps[power] = 0;
          p.powerUps[power]++;
          io.to(p.socketId).emit("power-up-received", power);
        });
      }

      io.to(roomId).emit("next-turn", {
        turnCount: roomData.turnCount,
      });
      io.to(roomId).emit("turn-log", `Turn ${roomData.turnCount} has begun`);
      return;
    }
    nextTurn = (nextTurn + 1) % totalPlayers;
    safety++;
  }

  console.log(`No connected players left to take the next turn in room ${roomId}`);
}

function rollPowerUp() {
  const roll = Math.random();
  if (roll < 0.4) return "special";
  if (roll < 0.7) return "heal";
  if (roll < 0.85) return "cruelty";
  return "prowess";
}

function processTurn(roomId) {
  const roomData = rooms[roomId];
  const turnIndex = roomData.turnCount - 1;
  if (turnIndex === 0) io.to(roomId).emit("turn-log", `[Turn 1 has begun]`);
  const currentActions = roomData.actions[turnIndex];

  const energyShields = new Set();
  const defends = new Set();
  const prowessMap = {};

  const eliminatedPlayers = new Set();
  const healedPlayers = new Set();
  const logs = [];

  // Step 1: Setup initial flags
  currentActions.forEach(action => {
    const player = roomData.players.find(p => p.name === action.playerName);
    if (!player) return;

    if (action.action === "defend") {
      defends.add(action.playerName);
      action.result = 'defended';
    }

    if (action.action === "energy-shield") {
      energyShields.add(action.playerName);
      action.result = 'shielded';
    }

    if (action.action === "prowess" && action.targetName) {
      prowessMap[action.playerName] = action.targetName;
      action.result = 'ready';
    }
  });

  // Step 2: Process heal actions (before damage)
  currentActions.forEach(action => {
    if (action.action === "heal") {
      const player = roomData.players.find(p => p.name === action.playerName);
      if (!player || player.hp <= 0) return;

      player.hp += 2;
      action.result = "healed";
      healedPlayers.add(player.name);
    }
  });

  // Step 3: Process all attacks
  currentActions.forEach(action => {
    if (!["attack", "special", "cruelty"].includes(action.action)) return;

    const attacker = roomData.players.find(p => p.name === action.playerName);
    const target = roomData.players.find(p => p.name === action.targetName);
    if (!attacker || !target) {
      action.result = 'invalid target';
      return;
    }

    if (target.hp <= 0) {
      action.result = 'but player was already eliminated!';
      return;
    }

    const wasBlockedByProwess = prowessMap[target.name] === attacker.name;
    const wasBlockedByEnergyShield = energyShields.has(target.name);
    const wasBlockedByDefend = defends.has(target.name) && action.action === 'attack';

    const damage = action.action === "attack" ? 1 : (action.action === "special" ? 2 : null);
    const isCruelty = action.action === "cruelty";

    if (wasBlockedByProwess) {
      action.result = "reflected";
      // Reflect the same damage
      const reflectedTarget = attacker;
      if (isCruelty) {
        reflectedTarget.hp = 0;
        eliminatedPlayers.add(reflectedTarget.name);
        io.to(roomId).emit("player-eliminated", reflectedTarget.name);
      } else {
        reflectedTarget.hp = Math.max(0, reflectedTarget.hp - damage);
        if (reflectedTarget.hp === 0) {
          eliminatedPlayers.add(reflectedTarget.name);
          io.to(roomId).emit("player-eliminated", reflectedTarget.name);
        }
      }
      return;
    }

    if (wasBlockedByEnergyShield || wasBlockedByDefend) {
      action.result = "blocked";
      return;
    }

    if (isCruelty) {
      target.hp = 0;
    } else {
      target.hp = Math.max(0, target.hp - damage);
    }

    action.result = "successful";
    if (target.hp === 0) {
      eliminatedPlayers.add(target.name);
      io.to(roomId).emit("player-eliminated", target.name);
    }
  });

  // Step 4: Update clients with new player state
  io.to(roomId).emit("players-update", roomData.players.map(p => ({
    name: p.name,
    hp: p.hp,
    powerUps: p.powerUps
  })));

  // Step 5: Emit turn logs
  currentActions.forEach(action => {
    const { playerName, action: act, targetName, result } = action;
    let msg = "";
    if (act === "defend") msg = `${playerName} defended`;
    else if (act === "energy-shield") msg = `${playerName} used an energy shield`;
    else if (act === "prowess") msg = `${playerName} activated prowess against ${targetName}`;
    else if (act === "heal") msg = `${playerName} healed +2 HP`;
    else if (["attack", "special", "cruelty"].includes(act)) {
      const type = act === "attack" ? "attacked" : act === "special" ? "used a special attack on" : "used cruelty on";
      msg = `${playerName} ${type} ${targetName}`;
      if (result === "blocked") msg += " (blocked)";
      else if (result === "reflected") msg += " (reflected)";
      else if (result === "successful") msg += " (successful)";
      else msg += ` (${result})`;
    }
    logs.push(msg);
  });

  eliminatedPlayers.forEach(name => logs.push(`${name} has been eliminated!`));

  const alivePlayers = roomData.players.filter(p => p.hp > 0);
  if (alivePlayers.length === 1) {
    io.to(roomId).emit("game-over", { type: "win", winner: alivePlayers[0].name });
  } else if (alivePlayers.length === 0) {
    io.to(roomId).emit("game-over", { type: "draw", winner: null });
  }

  return logs;
}

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('create-room', (room, playerName) => {
    rooms[room] = {
      id: room,
      players: [{
        name: playerName,
        socketId: socket.id,
        hp: 3,
        commands: [],
        isEliminated: false,
        powerUps: {
          cruelty: 0,
          special: 0,
          heal: 0,
          prowess: 0,
          energyShield: 0,
        }
      }],
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
        roomData.players.push({
          name: playerName,
          socketId: socket.id,
          hp: 3,
          commands: [],
          isEliminated: false,
          powerUps: {
            cruelty: 0,
            special: 0,
            heal: 0,
            prowess: 0,
            energyShield: 0,
          }
        });
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
  
    const player = roomData.players[playerIndex];
  
    // Skip command if player is eliminated
    if (player.hp <= 0) return;
  
    player.commands.push(action);
    roomData.actions[roomData.turnCount - 1].push({ playerName, action, targetName });
  
    // Only count alive players for turn completion
    const alivePlayerCount = roomData.players.filter(p => p.hp > 0).length;
    if (roomData.actions[roomData.turnCount - 1].length === alivePlayerCount) {
      emitNextTurn(room);
    }
  });
  

  socket.on("get-players", (room) => {
    const roomData = rooms[room];
    if (roomData) {
      socket.emit("players-update", roomData.players.map(p => ({ name: p.name, hp: p.hp, powerUps: p.powerUps })));
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

    io.to(room).emit("players-update", roomData.players.map(p => ({ name: p.name, hp: p.hp, powerUps: p.powerUps })));

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
