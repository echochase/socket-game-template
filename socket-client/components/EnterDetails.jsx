import { TextField } from "@mui/material";
import { useEffect } from "react";

export const EnterDetails = ({ socket, name, setName, setStep, room, setRoom, creating }) => {
  const connectSocket = (e) => {
    e.preventDefault();
    if (!socket || !name.trim()) return;

    if (creating) {
      const newRoom = socket.id; // Use socket.id as unique room
      setRoom(newRoom);
      socket.emit('create-room', newRoom, name);
      setStep(3);
    } else {
      socket.emit('check-room', room);
    }
  };

  useEffect(() => {
    if (!socket) return;

    const handleRoomExists = (players) => {
      console.log("Room exists, joining...");
      socket.emit('join-room', room, name);
      setStep(3);
    };

    const handleRoomNotFound = () => {
      alert("Sorry, this room doesn't exist.");
      setRoom("");
      setStep(2);
    };

    socket.on('room-exists', handleRoomExists);
    socket.on('room-not-found', handleRoomNotFound);

    return () => {
      socket.off('room-exists', handleRoomExists);
      socket.off('room-not-found', handleRoomNotFound);
    };
  }, [socket, room, name, setStep, setRoom]);

  return (
    <div className="center">
      <h1>{creating ? 'Create a Room' : 'Join a Room'}</h1>
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
          <button type="button" className="menu-button" onClick={() => setStep(1)}>Back</button>
          <button type="submit" className="menu-button">
            {creating ? 'Create Room' : 'Join Room'}
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
