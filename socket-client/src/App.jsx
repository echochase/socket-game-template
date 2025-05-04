import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Lobby } from "../components/Lobby";
import { Game } from "../components/Game";
import { EnterDetails } from "../components/EnterDetails";
import { LandingPage } from "../components/LandingPage";
import "./App.css"

export default function App() {
  const socketRef = useRef();
  const [step, setStep] = useState(1);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    socketRef.current = io("http://localhost:3000");

    socketRef.current.on("new-player", (playerList) => {
      setPlayers(playerList);
    });

    return () => socketRef.current.disconnect();
  }, []);

  return (
    <div className="center">
      {step === 1 && <LandingPage {...{ setStep, setCreating }} />}
      {step === 2 && (
        <EnterDetails
          socket={socketRef.current}
          {...{ name, setName, setStep, room, setRoom, creating }}
        />
      )}
      {step === 3 && (
        <Lobby
          socket={socketRef.current}
          {...{
            name,
            creating,
            room,
            players,
            setStep,
          }}
        />
      )}
      {step === 4 && (
        <Game
          socket={socketRef.current}
          {...{
            name,
            room,
            players,
          }}
        />
      )}
    </div>
  );
}
