import { useRef, useEffect, useState } from 'react';
import './App.css';

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setError('Unable to access webcam. Please allow camera access.');
      }
    };
    getWebcam();
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="app-container">
      <h1>Desk Coach: Posture Tracking</h1>
      {error ? (
        <div className="error">{error}</div>
      ) : (
        <video ref={videoRef} autoPlay playsInline style={{ width: '480px', borderRadius: '8px', border: '2px solid #ccc' }} />
      )}
      <p style={{ marginTop: '1rem' }}>Your webcam feed is only used locally for posture analysis. No data leaves your device.</p>
    </div>
  );
}

export default App;
