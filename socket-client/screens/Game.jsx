import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, MenuItem } from "@mui/material";
import { Players } from "../components/Players";
import "../styles/game.css";

export const Game = ({ socket, name, room }) => {
  const [turnCount, setTurnCount] = useState(0);
  const [players, setPlayers] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);
  const [chosenAction, setChosenAction] = useState(null);
  const [turnLogs, setTurnLogs] = useState([]);

  const open = Boolean(anchorEl);
  const navigate = useNavigate();

  useEffect(() => {
    if (!socket || !room || !name) {
      navigate("/");
      return;
    }

    const handleNextTurn = ({ turnCount }) => {
      setTurnCount(turnCount);
      setChosenAction(null); // Clear action at new turn
    };

    const handleRejoin = (gameState) => {
      setTurnCount(gameState.turnCount);
    };

    const updatePlayers = (playersList) => {
      setPlayers(playersList);
    };

    const handleTurnLog = (message) => {
      setTurnLogs((prevLogs) => [...prevLogs, message]);
    };

    socket.on("next-turn", handleNextTurn);
    socket.on("rejoin-game", handleRejoin);
    socket.on("players-update", updatePlayers);
    socket.on("turn-log", handleTurnLog);

    // Ask server for current game state
    socket.emit("get-current-turn", room, name);
    socket.emit("get-players", room);

    return () => {
      socket.off("next-turn", handleNextTurn);
      socket.off("rejoin-game", handleRejoin);
      socket.off("players-update", updatePlayers);
      socket.off("turn-log", handleTurnLog);
    };
  }, [socket, room, name, navigate]);

  const openAttackMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const closeAttackMenu = (targetName) => {
    setAnchorEl(null);
    if (targetName) {
      setChosenAction({ type: "attack", target: targetName });
      socket.emit("send-command", room, name, "attack", targetName);
    }
  };

  const chooseDefend = () => {
    setChosenAction({ type: "defend", target: name });
    socket.emit("send-command", room, name, "defend", name);
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
        <div style={{ fontSize: "14px", marginTop: "10px", color: "#ccc" }}>
          {turnLogs.map((log, index) => (
            <div key={index}>{log}</div>
          ))}
        </div>
      </div>

      <Players players={players} you={name} />

      <div className="action-buttons">
        <button className="menu-button" onClick={(e) => openAttackMenu(e)}>
          Attack
        </button>
        <button className="menu-button" onClick={chooseDefend}>
          Defend
        </button>
      </div>

      {chosenAction && (
        <div style={{ color: "lightgreen", marginBottom: "15px", fontSize: "18px" }}>
          You have chosen your action:{" "}
          <strong>{chosenAction.type}</strong>
          {chosenAction.type === "attack" && ` ${chosenAction.target}`}
        </div>
      )}

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
        {players
          .filter((player) => player.name !== name) // Exclude self from the menu
          .map((player) => (
            <MenuItem
              key={player.name}
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
            </MenuItem>
          ))}
      </Menu>
    </div>
  );
};
