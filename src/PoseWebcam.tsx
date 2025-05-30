import { useRef, useEffect } from 'react';
import { Pose } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';

// Indices for upper body landmarks in MediaPipe Pose
const UPPER_BODY_LANDMARKS = [
  0, 1, 2, 3, 4, // nose, eyes, ears
  5, 6, 7, 8,    // shoulders, elbows
  9, 10, 11, 12, // wrists
  23, 24         // hips
];

interface PoseWebcamProps {
  onPose?: (results: any) => void;
}

export default function PoseWebcam({ onPose }: PoseWebcamProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let camera: Camera | null = null;
    let pose: Pose | null = null;

    if (!videoRef.current || !canvasRef.current) return;

    pose = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });
    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    pose.onResults((results) => {
      if (onPose) onPose(results);
      const canvasCtx = canvasRef.current!.getContext('2d');
      canvasCtx!.save();
      canvasCtx!.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
      canvasCtx!.drawImage(results.image, 0, 0, canvasRef.current!.width, canvasRef.current!.height);
      // Draw upper body landmarks
      if (results.poseLandmarks) {
        canvasCtx!.fillStyle = '#00FF00';
        canvasCtx!.strokeStyle = '#00FF00';
        canvasCtx!.lineWidth = 2;
        for (const idx of UPPER_BODY_LANDMARKS) {
          const lm = results.poseLandmarks[idx];
          if (lm) {
            canvasCtx!.beginPath();
            canvasCtx!.arc(lm.x * canvasRef.current!.width, lm.y * canvasRef.current!.height, 5, 0, 2 * Math.PI);
            canvasCtx!.fill();
          }
        }
      }
      canvasCtx!.restore();
    });

    camera = new Camera(videoRef.current, {
      onFrame: async () => {
        await pose!.send({ image: videoRef.current! });
      },
      width: 480,
      height: 360,
    });
    camera.start();

    return () => {
      camera && camera.stop();
      pose && pose.close();
    };
  }, [onPose]);

  return (
    <div style={{ position: 'relative', width: 480, height: 360 }}>
      <video ref={videoRef} style={{ display: 'none' }} width={480} height={360} />
      <canvas ref={canvasRef} width={480} height={360} style={{ position: 'absolute', top: 0, left: 0 }} />
    </div>
  );
}
