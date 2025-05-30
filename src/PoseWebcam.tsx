import { useRef, useEffect, useState } from 'react';
import { Pose } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';

// Indices for upper body landmarks in MediaPipe Pose
const UPPER_BODY_LANDMARKS = [
  0, 1, 2, 3, 4, // nose, eyes, ears
  5, 6, 7, 8,    // shoulders, elbows
  9, 10, 11, 12, // wrists
  23, 24         // hips
];

// MediaPipe Pose landmark names (33 total)
const LANDMARK_NAMES = [
  'nose', 'left_eye_inner', 'left_eye', 'left_eye_outer', 'right_eye_inner', 'right_eye', 'right_eye_outer',
  'left_ear', 'right_ear', 'mouth_left', 'mouth_right',
  'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
  'left_wrist', 'right_wrist', 'left_pinky', 'right_pinky',
  'left_index', 'right_index', 'left_thumb', 'right_thumb',
  'left_hip', 'right_hip', 'left_knee', 'right_knee',
  'left_ankle', 'right_ankle', 'left_heel', 'right_heel',
  'left_foot_index', 'right_foot_index'
];

interface PoseWebcamProps {
  onPose?: (results: any) => void;
}

export default function PoseWebcam({ onPose }: PoseWebcamProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [landmarks, setLandmarks] = useState<any[]>([]);

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
        setLandmarks(results.poseLandmarks);
        canvasCtx!.fillStyle = '#00FF00';
        canvasCtx!.strokeStyle = '#00FF00';
        canvasCtx!.lineWidth = 2;
        // Draw circles for each landmark
        for (const idx of UPPER_BODY_LANDMARKS) {
          const lm = results.poseLandmarks[idx];
          if (lm) {
            canvasCtx!.beginPath();
            canvasCtx!.arc(lm.x * canvasRef.current!.width, lm.y * canvasRef.current!.height, 5, 0, 2 * Math.PI);
            canvasCtx!.fill();
          }
        }
        // Draw simple solid lines for spine and head/neck connections
        // Define indices for neck, ears, eyes, shoulders, hips
        const leftEar = 7;
        const rightEar = 8;
        const leftEye = 1;
        const rightEye = 2;
        const nose = 0;
        const leftShoulder = 11;
        const rightShoulder = 12;
        const leftHip = 23;
        const rightHip = 24;
        // Approximate neck as midpoint between shoulders
        const neck = (() => {
          const l = results.poseLandmarks[leftShoulder];
          const r = results.poseLandmarks[rightShoulder];
          if (l && r) {
            return {
              x: (l.x + r.x) / 2,
              y: (l.y + r.y) / 2,
              z: (l.z + r.z) / 2,
            };
          }
          return null;
        })();
        // Draw lines: ears/eyes/nose to neck, neck to shoulders, neck to hips
        if (neck) {
          const drawToNeck = (idx: number) => {
            const pt = results.poseLandmarks[idx];
            if (pt) {
              canvasCtx!.save();
              canvasCtx!.strokeStyle = '#2196f3';
              canvasCtx!.lineWidth = 4;
              canvasCtx!.beginPath();
              canvasCtx!.moveTo(pt.x * canvasRef.current!.width, pt.y * canvasRef.current!.height);
              canvasCtx!.lineTo(neck.x * canvasRef.current!.width, neck.y * canvasRef.current!.height);
              canvasCtx!.stroke();
              canvasCtx!.restore();
            }
          };
          [leftEar, rightEar, leftEye, rightEye, nose].forEach(drawToNeck);
          // Draw neck to shoulders
          const leftShoulderPt = results.poseLandmarks[leftShoulder];
          const rightShoulderPt = results.poseLandmarks[rightShoulder];
          if (leftShoulderPt) {
            canvasCtx!.save();
            canvasCtx!.strokeStyle = '#2196f3';
            canvasCtx!.lineWidth = 4;
            canvasCtx!.beginPath();
            canvasCtx!.moveTo(neck.x * canvasRef.current!.width, neck.y * canvasRef.current!.height);
            canvasCtx!.lineTo(leftShoulderPt.x * canvasRef.current!.width, leftShoulderPt.y * canvasRef.current!.height);
            canvasCtx!.stroke();
            canvasCtx!.restore();
          }
          if (rightShoulderPt) {
            canvasCtx!.save();
            canvasCtx!.strokeStyle = '#2196f3';
            canvasCtx!.lineWidth = 4;
            canvasCtx!.beginPath();
            canvasCtx!.moveTo(neck.x * canvasRef.current!.width, neck.y * canvasRef.current!.height);
            canvasCtx!.lineTo(rightShoulderPt.x * canvasRef.current!.width, rightShoulderPt.y * canvasRef.current!.height);
            canvasCtx!.stroke();
            canvasCtx!.restore();
          }
          // Draw neck to hips
          const leftHipPt = results.poseLandmarks[leftHip];
          const rightHipPt = results.poseLandmarks[rightHip];
          if (leftHipPt) {
            canvasCtx!.save();
            canvasCtx!.strokeStyle = '#2196f3';
            canvasCtx!.lineWidth = 4;
            canvasCtx!.beginPath();
            canvasCtx!.moveTo(neck.x * canvasRef.current!.width, neck.y * canvasRef.current!.height);
            canvasCtx!.lineTo(leftHipPt.x * canvasRef.current!.width, leftHipPt.y * canvasRef.current!.height);
            canvasCtx!.stroke();
            canvasCtx!.restore();
          }
          if (rightHipPt) {
            canvasCtx!.save();
            canvasCtx!.strokeStyle = '#2196f3';
            canvasCtx!.lineWidth = 4;
            canvasCtx!.beginPath();
            canvasCtx!.moveTo(neck.x * canvasRef.current!.width, neck.y * canvasRef.current!.height);
            canvasCtx!.lineTo(rightHipPt.x * canvasRef.current!.width, rightHipPt.y * canvasRef.current!.height);
            canvasCtx!.stroke();
            canvasCtx!.restore();
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

  // Table of all landmarks and their raw values
  return (
    <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start', justifyContent: 'center', flexWrap: 'wrap', width: '100%' }}>
      <div style={{ position: 'relative', width: 480, height: 360, flex: '0 0 auto' }}>
        <video ref={videoRef} style={{ display: 'none' }} width={480} height={360} />
        <canvas ref={canvasRef} width={480} height={360} style={{ position: 'absolute', top: 0, left: 0 }} />
      </div>
      <TableContainer component={Paper} sx={{ maxHeight: 360, minWidth: 480, width: 520, flex: '0 1 520px', background: '#222', boxShadow: 3 }}>
        <Table stickyHeader size="small" aria-label="pose landmarks table">
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: '#fff', background: '#222', borderColor: '#444' }}>Part</TableCell>
              <TableCell sx={{ color: '#fff', background: '#222', borderColor: '#444' }}>x</TableCell>
              <TableCell sx={{ color: '#fff', background: '#222', borderColor: '#444' }}>y</TableCell>
              <TableCell sx={{ color: '#fff', background: '#222', borderColor: '#444' }}>z</TableCell>
              <TableCell sx={{ color: '#fff', background: '#222', borderColor: '#444' }}>visibility</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {landmarks.map((lm, i) => (
              <TableRow key={i} sx={{ background: i % 2 ? '#333' : '#222' }}>
                <TableCell sx={{ color: '#fff', borderColor: '#444' }}>{LANDMARK_NAMES[i] || i}</TableCell>
                <TableCell sx={{ color: '#fff', borderColor: '#444' }}>{lm.x?.toFixed(4)}</TableCell>
                <TableCell sx={{ color: '#fff', borderColor: '#444' }}>{lm.y?.toFixed(4)}</TableCell>
                <TableCell sx={{ color: '#fff', borderColor: '#444' }}>{lm.z?.toFixed(4)}</TableCell>
                <TableCell sx={{ color: '#fff', borderColor: '#444' }}>{lm.visibility?.toFixed(4)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}
