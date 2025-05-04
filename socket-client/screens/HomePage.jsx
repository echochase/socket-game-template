import { useNavigate } from "react-router-dom";
import { useState } from "react";
import "../styles/common.css";

export const HomePage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  
  return (
    <div className="center">
      <h1>Double Bluff</h1>
      {step === 1 ? (
        <div className="center">
          <button className="menu-button" onClick={() => setStep(2)}>Play</button>
          <button className="menu-button" onClick={() => navigate("/settings")}>Settings</button>
          <button className="menu-button" onClick={() => navigate("/about")}>About</button>
        </div>
      ) : (
        <div className="center">
          <button className="menu-button" onClick={() => navigate("/create")}>Create Room</button>
          <button className="menu-button" onClick={() => navigate("/join")}>Join Room</button>
        </div>
      )}
    </div>
  );
};
