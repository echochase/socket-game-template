import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, MenuItem, Modal } from "@mui/material";
import { Players } from "../components/Players";
import "../styles/game.css";
import "../styles/common.css";

export const Game = ({ socket, name, room }) => {
  const [turnCount, setTurnCount] = useState(0);
  const [players, setPlayers] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);
  const [chosenAction, setChosenAction] = useState(null);
  const [turnLogs, setTurnLogs] = useState([]);
  const [winner, setWinner] = useState("");
  const [end, setEnd] = useState(false);
  const [pendingAttackType, setPendingAttackType] = useState(null);

  const open = Boolean(anchorEl);
  const navigate = useNavigate();
  const you = players.find((p) => p.name === name);
  const isEliminated = you?.hp === 0;

  useEffect(() => {
    socket.on("player-eliminated", (name) => {
      console.log(`${name} was eliminated`);
    });

    socket.on("game-over", ({ type, winner }) => {
      if (type === "win") {
        setTurnLogs((prev) => [...prev, `🏆 ${winner} wins the game!`]);
        setWinner(winner);
        setEnd(true);
      } else if (type === "draw") {
        setTurnLogs((prev) => [...prev, `🤝 It's a draw! No players remain.`]);
        setWinner(null);
      }
    });

    return () => {
      socket.off("player-eliminated");
    };
  }, []);

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

    const handlePowerUp = (power) => {
      you.powerUps[power]++;
    };

    const updatePlayers = (playersList) => {
      setPlayers(
        playersList.map((p) => ({
          ...p,
          powerUps: p.powerUps ?? {}, // prevent undefined errors
        }))
      );
    };    

    const handleTurnLog = (message) => {
      setTurnLogs((prevLogs) => [...prevLogs, message]);
    };

    socket.on("power-up-received", handlePowerUp);
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

  const openTargetMenu = (event, attackType) => {
    setPendingAttackType(attackType);
    setAnchorEl(event.currentTarget);
  };

  const closeTargetMenu = (targetName) => {
    setAnchorEl(null);
    if (targetName && pendingAttackType) {
      setChosenAction({ type: pendingAttackType, target: targetName });
      socket.emit("send-command", room, name, pendingAttackType, targetName);
    }
    setPendingAttackType(null);
  };
  
  const chooseEnergyShield = () => {
    setChosenAction({ type: "energy-shield", target: name });
    socket.emit("send-command", room, name, "energy-shield", name);
  };

  const chooseCruelty = (event) => {
    openTargetMenu(event, "cruelty");
  };
  
  const chooseProwess = (event) => {
    openTargetMenu(event, "prowess");
  };
  
  const chooseDefend = () => {
    setChosenAction({ type: "defend", target: name });
    socket.emit("send-command", room, name, "defend", name);
  };

  const chooseHeal = () => {
    setChosenAction({ type: "heal", target: name });
    socket.emit("send-command", room, name, "heal", name);
  }

  const leaveGame = () => {
    socket.emit("leave-room", room, name);
    navigate("/");
  };

  return (
    <div className="center">
      <div className="corner-info">
        <p style={{ fontSize: "12.5px" }}>Game Room: {room}</p>
        <div className="game-info">
          <strong>Turn: {turnCount}</strong>
          <strong>You: {name}</strong>
        </div>
        <div style={{ fontSize: "14px", marginTop: "10px", color: "#ccc" }}>
          {turnLogs.map((log, index) => (
            <div key={index}>{log}</div>
          ))}
        </div>
        {winner !== "" && (
          <div className="center">
            {winner ? <h3>Result: {winner} wins</h3> : <h3>Result: Draw</h3>}
          </div>
        )}
      </div>

      <Players players={players} you={name} />

      {isEliminated ? (
        <p style={{ color: "red", marginBottom: "10px" }}>
          You have been eliminated and cannot take actions.
        </p>
      ) : (
        <div className="action-buttons">
          <button className="menu-button" onClick={(e) => openTargetMenu(e, "attack")}>
            Attack
          </button>
          <button className="menu-button" onClick={chooseDefend}>
            Defend
          </button>
          <button className="menu-button" onClick={chooseEnergyShield}>
            Energy Shield
          </button>
          {you?.powerUps?.special > 0 && (
            <button className="menu-button" onClick={(e) => openTargetMenu(e, "special")}>
              Special Attack
            </button>
          )}
          {you?.powerUps?.cruelty > 0 && (
            <button className="menu-button" onClick={chooseCruelty}>
              Cruelty
            </button>
          )}
          {you?.powerUps?.prowess > 0 && (
            <button className="menu-button" onClick={chooseProwess}>
              Prowess
            </button>
          )}
          {you?.powerUps?.heal > 0 && (
            <button className="menu-button" onClick={chooseHeal}>
              Heal
            </button>
          )}
        </div>
      )}

      {chosenAction && (
        <div
          style={{
            color: "lightgreen",
            marginBottom: "15px",
            fontSize: "18px",
          }}
        >
          You have chosen your action: <strong>{chosenAction.type}</strong>
          {["attack", "special"].includes(chosenAction.type) &&
            ` ${chosenAction.target}`}
        </div>
      )}

      <button className="menu-button" onClick={leaveGame}>
        Leave Game
      </button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => closeTargetMenu()}
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
          .filter((player) => player.name !== name)
          .map((player) => (
            <MenuItem
              key={player.name}
              onClick={() => closeTargetMenu(player.name)}
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
      <Modal open={end} onClose={() => setEnd(false)}>
        <div className="modal center">
          {winner ? (
            <div className="center">
              <h2>We have a winner!</h2>
              <p>The winner is {winner}. Well played everyone!</p>
            </div>
          ) : (
            <div className="center">
              <h2>It's a draw!</h2>
              <p>The game is over and everyone is eliminated.</p>
            </div>
          )}
          <div className="horizontal-box">
            <button onClick={() => setEnd(false)}>Done</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
