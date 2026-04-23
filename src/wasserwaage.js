import { useEffect, useRef, useState } from "react";

const DB_NAME = "waterlevel-db";
const STORE = "readings";
const MAX_RECORDS = 800;

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
  dbBox: {
    marginTop: 20,
    textAlign: "left",
    maxWidth: 320,
    marginInline: "auto",
  },
  list: {
    fontSize: 12,
    maxHeight: 200,
    overflowY: "auto",
    border: "1px solid #ddd",
    padding: 8,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: 6,
    padding: "2px 0",
    fontFamily: "monospace",
  },
};

async function getAllReadings() {
  const db = await openDB();
  const tx = db.transaction(STORE, "readonly");
  const store = tx.objectStore(STORE);

  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function addReading(data, onUpdate) {
  const db = await openDB();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);

  store.add(data);

  tx.oncomplete = async () => {
    const all = await getAllReadings();

    if (all.length > MAX_RECORDS) {
      const excess = all.length - MAX_RECORDS;
      const deleteTx = db.transaction(STORE, "readwrite");
      const delStore = deleteTx.objectStore(STORE);

      for (let i = 0; i < excess; i++) {
        delStore.delete(all[i].id);
      }
    }

    if (onUpdate) {
      const updated = await getAllReadings();
      onUpdate(updated);
    }
  };
}

export default function WaterLevelApp() {
  const [tilt, setTilt] = useState({ beta: 0, gamma: 0 });
  const [targetTilt, setTargetTilt] = useState({ beta: 0, gamma: 0 });

  const [targetAngleBeta, setTargetAngleBeta] = useState(0);
  const [targetAngleGamma, setTargetAngleGamma] = useState(0);

  const [readings, setReadings] = useState([]);
  const [isRecording, setIsRecording] = useState(true);
  const isRecordingRef = useRef(true);

  const [installPrompt, setInstallPrompt] = useState(null);

  const tiltRef = useRef({ beta: 0, gamma: 0 });
  const targetRef = useRef({ beta: 0, gamma: 0 });

  const THRESHOLD = 10;

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    targetRef.current = {
      beta: targetAngleBeta,
      gamma: targetAngleGamma,
    };
  }, [targetAngleBeta, targetAngleGamma]);

  useEffect(() => {
    getAllReadings().then(setReadings);

    const handleInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    const handleOrientation = (event) => {
      const beta = event.beta || 0;
      const gamma = event.gamma || 0;

      const { beta: tB, gamma: tG } = targetRef.current;

      const relBeta = beta - tB;
      const relGamma = gamma - tG;

      setTilt({ beta, gamma });
      setTargetTilt({ beta: relBeta, gamma: relGamma });

      tiltRef.current = { beta, gamma };

      const deviation = Math.max(
        Math.abs(relBeta),
        Math.abs(relGamma)
      );

      if (deviation > THRESHOLD && navigator.vibrate) {
        navigator.vibrate(200);
      }
    };

    window.addEventListener("deviceorientation", handleOrientation);
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isRecordingRef.current) return;

      const { beta, gamma } = tiltRef.current;

      addReading(
        {
          beta,
          gamma,
          deviation: Math.max(Math.abs(beta), Math.abs(gamma)),
          ts: Date.now(),
          periodic: true,
        },
        setReadings
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleTargetAngleChange = (value, isBeta) => {
    let newBeta = targetAngleBeta;
    let newGamma = targetAngleGamma;

    if (isBeta) {
      newBeta = value;
      setTargetAngleBeta(value);
    } else {
      newGamma = value;
      setTargetAngleGamma(value);
    }

    setTargetTilt({
      beta: tilt.beta - newBeta,
      gamma: tilt.gamma - newGamma,
    });
  };

  const handleInstallClick = async () => {
    if (!installPrompt) return;

    installPrompt.prompt();
    const choice = await installPrompt.userChoice;

    if (choice?.outcome === "accepted") {
      setInstallPrompt(null);
    }
  };

  const levelX = Math.max(-100, Math.min(100, targetTilt.gamma * 5));
  const levelY = Math.max(-100, Math.min(100, targetTilt.beta * 5));

  return (
    <div style={styles.container}>
      <h2>Wasserwaage</h2>

      <button
        onClick={() => setIsRecording((p) => !p)}
        style={{ padding: "8px 12px", marginBottom: 10 }}
      >
        Recording: {isRecording ? "ON" : "OFF"}
      </button>

      {installPrompt && (
        <button
          onClick={handleInstallClick}
          style={{ padding: "8px 12px", marginBottom: 10, marginLeft: 10 }}
        >
          Jetzt als PWA installieren
        </button>
      )}

      <div>
        <h5>Normal-Winkel Beta {targetAngleBeta}</h5>
        <input
          type="range"
          min="-90"
          max="90"
          value={targetAngleBeta}
          onChange={(e) =>
            handleTargetAngleChange(Number(e.target.value), true)
          }
        />

        <h5>Normal-Winkel Gamma {targetAngleGamma}</h5>
        <input
          type="range"
          min="-90"
          max="90"
          value={targetAngleGamma}
          onChange={(e) =>
            handleTargetAngleChange(Number(e.target.value), false)
          }
        />
      </div>

      <div style={styles.levelBox}>
        <div
          style={{
            ...styles.bubble,
            transform: `translate(${levelX}px, ${levelY}px)`,
          }}
        />
      </div>

      <div style={styles.info}>
        <div>Beta Absolut: {tilt.beta.toFixed(2)}</div>
        <div>Gamma Absolut: {tilt.gamma.toFixed(2)}</div>
        <div>Beta Relativ: {targetTilt.beta.toFixed(2)}</div>
        <div>Gamma Relativ: {targetTilt.gamma.toFixed(2)}</div>
      </div>

      <p style={{ fontSize: 12 }}>
        Schwelle für Vibration: {THRESHOLD}°
      </p>

      <div style={styles.dbBox}>
        <h4>Gespeicherte Werte</h4>
        <div style={styles.list}>
          {readings.slice(-100).reverse().map((r) => (
            <div key={r.id} style={styles.row}>
              <span>{new Date(r.ts).toLocaleTimeString()}</span>
              <span>B:{r.beta.toFixed(1)}</span>
              <span>G:{r.gamma.toFixed(1)}</span>
              <span>D:{r.deviation.toFixed(1)}</span>
              {r.periodic ? <span>•</span> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}