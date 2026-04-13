import { useEffect, useRef, useState } from "react";

// Simple IndexedDB helper
const DB_NAME = "waterlevel-db";
const STORE = "readings";
const MAX_RECORDS = 200;

console.log("MOINSEN")

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function addReading(data) {
  const db = await openDB();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  store.add(data);

  tx.oncomplete = async () => {
    const countTx = db.transaction(STORE, "readonly");
    const countStore = countTx.objectStore(STORE);
    const all = await countStore.getAll();

    if (all.length > MAX_RECORDS) {
      const excess = all.length - MAX_RECORDS;
      const deleteTx = db.transaction(STORE, "readwrite");
      const delStore = deleteTx.objectStore(STORE);
      for (let i = 0; i < excess; i++) {
        delStore.delete(all[i].id);
      }
    }
  };
}

export default function WaterLevelApp() {
  const [tilt, setTilt] = useState({ beta: 0, gamma: 0 });
  const intervalRef = useRef(null);

  const THRESHOLD = 10; // degrees

  useEffect(() => {
    const handleOrientation = (event) => {
      const beta = event.beta || 0;
      const gamma = event.gamma || 0;

      setTilt({ beta, gamma });

      const deviation = Math.max(Math.abs(beta), Math.abs(gamma));

      const record = {
        beta,
        gamma,
        deviation,
        ts: Date.now(),
      };

      addReading(record);

      if (deviation > THRESHOLD && navigator.vibrate) {
        navigator.vibrate(200);
      }
    };

    window.addEventListener("deviceorientation", handleOrientation);

    // fallback polling store (cyclic log every 5s)
    intervalRef.current = setInterval(() => {
      addReading({
        beta: tilt.beta,
        gamma: tilt.gamma,
        deviation: Math.max(Math.abs(tilt.beta), Math.abs(tilt.gamma)),
        ts: Date.now(),
        periodic: true,
      });
    }, 5000);

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
      clearInterval(intervalRef.current);
    };
  }, [tilt.beta, tilt.gamma]);

  const levelX = Math.max(-100, Math.min(100, tilt.gamma * 5));
  const levelY = Math.max(-100, Math.min(100, tilt.beta * 5));

  return (
    <div style={styles.container}>
      <h2>Wasserwaage PWA</h2>

      <div style={styles.levelBox}>
        <div
          style={{
            ...styles.bubble,
            transform: `translate(${levelX}px, ${levelY}px)`,
          }}
        />
      </div>

      <div style={styles.info}>
        <div>Beta: {tilt.beta.toFixed(2)}</div>
        <div>Gamma: {tilt.gamma.toFixed(2)}</div>
      </div>

      <p style={{ fontSize: 12 }}>
        Schwelle für Vibration: {THRESHOLD}°
      </p>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: "sans-serif",
    padding: 20,
    textAlign: "center",
  },
  levelBox: {
    width: 200,
    height: 200,
    border: "2px solid #333",
    borderRadius: 12,
    margin: "20px auto",
    position: "relative",
    overflow: "hidden",
  },
  bubble: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: "#4caf50",
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
  },
  info: {
    fontSize: 14,
    marginTop: 10,
  },
};
