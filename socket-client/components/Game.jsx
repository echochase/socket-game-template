import { useEffect, useState } from "react";

export const Game = ({ socket, name, room }) => {
  const [turnCount, setTurnCount] = useState(0);
  const [currentPlayer, setCurrentPlayer] = useState("");

  useEffect(() => {
    socket.on("next-turn", ({ turnCount, currentPlayer }) => {
      console.log("Next turn:", turnCount, currentPlayer);
      setTurnCount(turnCount);
      setCurrentPlayer(currentPlayer);
    });
  
    // Ask the server for current turn when component mounts
    socket.emit("get-current-turn", room);
  
    return () => {
      socket.off("next-turn");
    };
  }, [socket, room]);  

  const isMyTurn = currentPlayer === name;

  const endTurn = () => {
    socket.emit("end-turn", room);
  };

  return (
    <div className="center">
      <h1>Game Room: {room}</h1>
      <h2>Turn: {turnCount}</h2>
      <h2>Current Player: {currentPlayer}</h2>
      <h2>You: {name}</h2>

      {isMyTurn ? (
        <button onClick={endTurn}>End My Turn</button>
      ) : (
        <p>Waiting for {currentPlayer}...</p>
      )}
    </div>
  );
};
