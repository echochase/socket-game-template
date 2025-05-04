import { useEffect } from "react";

export const Lobby = ({ socket, name, creating, room, players, setStep }) => {
  const startGame = () => {
    if (players.length < 2) {
      alert("Not enough players!");
      return;
    }
    socket.emit("start-game", room, name);
  };

  useEffect(() => {
    const handleStart = () => {
      setStep(4); // move to game view
    };

    socket.on("start-confirm", handleStart);

    return () => {
      socket.off("start-confirm", handleStart);
    };
  }, [socket]);

  return (
    <div className="center">
      <h1>Welcome!</h1>
      <h2>Room: {room}</h2>
      <h2>Players:</h2>
      {players.map((player, index) => (
        <div key={index}>{player}</div>
      ))}
      {creating && (
        <button className="menu-button" onClick={startGame}>
          Start Game
        </button>
      )}
      <a className="menu-button" href="/">
        Leave Lobby
      </a>
    </div>
  );
};
