import "../styles/players.css";

export const Players = ({ players, you }) => {
  const radius = 250;

  const angleMap = {
    2: [180, 0],
    3: [270, 150, 30],
    4: [270, 0, 90, 180],
    5: [270, 342, 54, 126, 198],
  };

  const playerCount = players.length;
  const angles = angleMap[playerCount] || [];

  return (
    <div className="players-circle">
      {players.map((player, index) => {
        const { name, hp } = player;
        const angleDeg = angles[index];
        const angleRad = (angleDeg * Math.PI) / 180;
        const x = radius * Math.cos(angleRad);
        const y = radius * Math.sin(angleRad);

        let className = "player-tile";
        if (name === you) {
          className += " you";
        } else {
          className += " other";
        }
        if (hp <= 0) {
          className += " eliminated";
        }
        
        return (
          <div key={name} className={className} style={{
            transform: `translate(${x}px, ${y}px)`
          }}>
            <div>{name}</div>
            <div className="healthbar">
              {[0, 1, 2].map(i => (
                <div key={i} className={`hp-segment ${i < hp ? 'filled' : 'empty'}`} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
