import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, MenuItem } from "@mui/material";
import { Players } from "../components/Players";
import "../styles/game.css";

export const Game = ({ socket, name, room }) => {
  const [turnCount, setTurnCount] = useState(0);
  const [players, setPlayers] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);
  
  const open = Boolean(anchorEl);
  
  const navigate = useNavigate();

  useEffect(() => {
    if (!socket || !room || !name) {
      navigate("/");
      return;
    }

    const handleNextTurn = ({ turnCount }) => {
      setTurnCount(turnCount);
    };

    const handleRejoin = (gameState) => {
      setTurnCount(gameState.turnCount);
    };

    const updatePlayers = (playersList) => {
      setPlayers(playersList);
    };

    socket.on("next-turn", handleNextTurn);
    socket.on("rejoin-game", handleRejoin);
    socket.on("players-update", updatePlayers);

    // Ask server for the current turn and rejoin state when component mounts
    socket.emit("get-current-turn", room, name);
    socket.emit("get-players", room);

    return () => {
      socket.off("next-turn", handleNextTurn);
      socket.off("rejoin-game", handleRejoin);
      socket.off("players-update", updatePlayers);
    };
  }, [socket, room, name, navigate]);

  const openAttackMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const closeAttackMenu = (targetName) => {
    setAnchorEl(null);
    socket.emit("send-command", room, name, "attack", targetName);
  };

  const leaveGame = () => {
    socket.emit("leave-room", room, name);
    navigate("/");
  };

  return (
    <div className="center">
      <div className="corner-info">
        <p>Game Room: {room}</p>
        <h2>Turn: {turnCount}</h2>
        <h2>You: {name}</h2>
      </div>

      <Players players={players} you={name} />
      {/* () => socket.emit("attack", room, name) */}
      <div className="action-buttons">
        <button className="menu-button" onClick={(e) => openAttackMenu(e)}>
          Attack
        </button>
        <button className="menu-button" onClick={() => socket.emit("send-command", room, name, "defend", name)}>
          Defend
        </button>
      </div>
      
      <button className="menu-button" onClick={leaveGame}>
        Leave Game
      </button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => closeAttackMenu()}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              backgroundColor: "black",
              color: "white",
            },
          },
        }}
      >
        {players.map((player) => <MenuItem
          onClick={() => closeAttackMenu(player.name)}
          sx={{
            "&:hover": {
              opacity: 0.7,
              transform: "scale(0.95)",
            },
            transition: "all 0.2s ease",
          }}
        >
          {player.name}
        </MenuItem>)}
      </Menu>
    </div>
  );
};
