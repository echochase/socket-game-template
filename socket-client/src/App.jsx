import { BrowserRouter, Routes, Route } from "react-router-dom";
import "../styles/common.css";
import "./App.css";
import { HomePage } from "../screens/HomePage";
import { EnterDetails } from "../screens/EnterDetails";
import { Lobby } from "../screens/Lobby";
import { Game } from "../screens/Game";
import { io } from "socket.io-client";
import { useEffect, useState } from "react";

export default function App() {
  const [socket, setSocket] = useState(null);
  const [name, setName] = useState(localStorage.getItem("name") || "");
  const [room, setRoom] = useState(localStorage.getItem("room") || "");

  useEffect(() => {
    const newSocket = io("http://localhost:3000");
    setSocket(newSocket);

    return () => newSocket.disconnect();
  }, []);

  useEffect(() => {
    localStorage.setItem("name", name);
  }, [name]);

  useEffect(() => {
    localStorage.setItem("room", room);
  }, [room]);

  const sharedProps = { socket, name, setName, room, setRoom };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/create" element={<EnterDetails {...sharedProps} creating={true} />} />
        <Route path="/join" element={<EnterDetails {...sharedProps} creating={false} />} />
        <Route path="/lobby/:roomCode" element={<Lobby {...sharedProps} />} />
        <Route path="/play/:roomCode" element={<Game {...sharedProps} />} />
      </Routes>
    </BrowserRouter>
  );
}
