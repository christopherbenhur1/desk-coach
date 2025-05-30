import { useEffect, useState } from 'react';
import './App.css';
import PoseWebcam from './PoseWebcam';

function App() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getWebcam = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (err) {
        setError('Unable to access webcam. Please allow camera access.');
      }
    };
    getWebcam();
  }, []);

  return (
    <div className="app-container">
      <h1>Desk Coach: Posture Tracking</h1>
      {error ? (
        <div className="error">{error}</div>
      ) : (
        <PoseWebcam />
      )}
      <p style={{ marginTop: '1rem' }}>Your webcam feed is only used locally for posture analysis. No data leaves your device.</p>
    </div>
  );
}

export default App;
