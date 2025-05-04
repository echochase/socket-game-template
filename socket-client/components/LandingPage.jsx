export const LandingPage = ({ setStep, setCreating }) => {
  const handleStep = (creating) => {
    setCreating(creating);
    setStep(2);
  }

  return (
    <div className="center">
      <h1>Welcome to the App!</h1>
      <button className="menu-button" onClick={() => handleStep(true)}>Create Room</button>
      <button className="menu-button" onClick={() => handleStep(false)}>Join Room</button>
    </div>
  )
}