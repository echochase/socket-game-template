import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";

export const Lobby = ({ socket, name, room, setRoom }) => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [players, setPlayers] = useState([]);

  const creating = location.state?.creating;

  const leaveLobby = () => {
    socket.emit("leave-room", roomCode, name);
    navigate("/");
  };  

  useEffect(() => {
    if (!socket || !name) {
      navigate("/");
      return;
    }
  
    if (!room) {
      setRoom(roomCode);
    }
  
    const updatePlayers = (playersList) => {
      setPlayers(playersList);
    };
  
    const handleStart = () => {
      navigate(`/play/${roomCode}`);
    };
  
    socket.emit("get-players", roomCode); // 👈 Ask server for current player list
  
    socket.on("players-update", updatePlayers); // 👈 Receive it
    socket.on("new-player", updatePlayers);     // 👈 Also update when others join/leave
    socket.on("start-confirm", handleStart);
  
    return () => {
      socket.off("players-update", updatePlayers);
      socket.off("new-player", updatePlayers);
      socket.off("start-confirm", handleStart);
    };
  }, [socket, roomCode, name]);

  const startGame = () => {
    if (players.length < 2) {
      alert("Not enough players!");
      return;
    }
    socket.emit("start-game", roomCode, name);
  };

  return (
    <div className="center">
      <h1>Welcome!</h1>
      <h2>Room: {roomCode}</h2>
      <h2>Players:</h2>
      {players.map((player, index) => (
        <div key={index}>{player.name}</div>
      ))}

      {creating && (
        <button className="menu-button" onClick={startGame}>
          Start Game
        </button>
      )}
      
      <button className="menu-button" onClick={leaveLobby}>
        Leave Lobby
      </button>
    </div>
  );
};
