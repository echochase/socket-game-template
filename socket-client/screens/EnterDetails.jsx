import { TextField } from "@mui/material";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export const EnterDetails = ({ socket, name, setName, room, setRoom, creating }) => {
  const navigate = useNavigate();

  const connectSocket = (e) => {
    e.preventDefault();
    if (!socket || !name.trim()) return;

    if (creating) {
      const newRoom = socket.id;
      setRoom(newRoom);
      socket.emit("create-room", newRoom, name);
      navigate(`/lobby/${newRoom}`, { state: { creating: true } });
    } else {
      socket.emit("check-room", room);
    }
  };

  useEffect(() => {
    if (!socket) return;
  
    const handleRoomExists = () => {
      socket.emit("join-room", room, name); // ✅ Do NOT navigate yet
    };
  
    const handleJoinSuccess = (roomJoined) => {
      navigate(`/lobby/${roomJoined}`, { state: { creating: false } }); // ✅ Navigate here
    };
  
    const handleRoomNotFound = () => {
      alert("Sorry, this room doesn't exist.");
      setRoom("");
    };
  
    const handleDuplicateNameError = () => {
      alert("This name is already taken in this room!");
      navigate("/join");
      setRoom("");
    };
  
    const handleStartedError = () => {
      alert("Sorry, that game has started!");
      setRoom("");
    };
  
    socket.on("room-exists", handleRoomExists);
    socket.on("join-success", handleJoinSuccess); // ✅ New listener
    socket.on("room-not-found", handleRoomNotFound);
    socket.on("started-error", handleStartedError);
    socket.on("duplicate-name-error", handleDuplicateNameError);
  
    return () => {
      socket.off("room-exists", handleRoomExists);
      socket.off("join-success", handleJoinSuccess); // ✅ Cleanup
      socket.off("room-not-found", handleRoomNotFound);
      socket.off("started-error", handleStartedError);
      socket.off("duplicate-name-error", handleDuplicateNameError);
    };
  }, [socket, room, name, navigate]);
  

  return (
    <div className="center">
      <h1>{creating ? "Create a Room" : "Join a Room"}</h1>
      <form onSubmit={connectSocket} className="center">
        {!creating && (
          <TextField
            placeholder="Enter Room Code"
            variant="standard"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            fullWidth
            sx={muiStyles}
          />
        )}
        <TextField
          placeholder="Enter Username"
          variant="standard"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          sx={muiStyles}
        />
        <div className="horizontal-box" style={{ marginTop: "30px" }}>
          <button type="button" className="menu-button" onClick={() => navigate("/")}>
            Back
          </button>
          <button type="submit" className="menu-button">
            {creating ? "Create Room" : "Join Room"}
          </button>
        </div>
      </form>
    </div>
  );
};

const muiStyles = {
  input: { color: "white" },
  "& .MuiInputBase-input::placeholder": {
    color: "lightgray",
    opacity: 1,
    fontSize: "17px",
  },
  "& .MuiInput-underline:before": {
    borderBottomColor: "lightgray",
  },
  "& .MuiInput-underline:hover:before": {
    borderBottomColor: "white",
  },
  "& .MuiInput-underline:after": {
    borderBottomColor: "gray",
  },
  width: "370px",
  padding: "5px",
};
