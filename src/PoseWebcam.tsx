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
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

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
  const [neckFlexion, setNeckFlexion] = useState<{angle: number, status: string, confidence: number} | null>(null);
  const [cva, setCVA] = useState<{angle: number, status: string, confidence: number} | null>(null); // CVA state
  const [fsa, setFSA] = useState<{angle: number, status: string, confidence: number} | null>(null); // FSA state
  const [calibration, setCalibration] = useState<number | null>(null);
  const calibrationRef = useRef<number | null>(null); // <-- add ref for calibration

  // Keep calibrationRef in sync with calibration state
  useEffect(() => {
    calibrationRef.current = calibration;
  }, [calibration]);

  // On mount, load calibration from localStorage if available
  useEffect(() => {
    const saved = localStorage.getItem('deskcoach-neck-calibration');
    if (saved !== null) {
      const val = parseFloat(saved);
      if (!isNaN(val)) setCalibration(val);
    }
  }, []);

  // When calibration changes, save to localStorage
  useEffect(() => {
    if (calibration !== null) {
      localStorage.setItem('deskcoach-neck-calibration', calibration.toString());
    }
  }, [calibration]);

  // Helper: calculate angle between two points and vertical (in degrees, 0° = upright)
  function angleToVertical(a: any, b: any) {
    if (!a || !b) return null;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const mag = Math.sqrt(dx*dx + dy*dy);
    if (mag === 0) return null;
    // Vertical vector is (0, -1) (upwards in image coordinates)
    const dot = (dx * 0) + (dy * -1);
    const angleRad = Math.acos(dot / mag);
    return Math.abs((angleRad * 180) / Math.PI);
  }

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
        // Calculate neck (midpoint of shoulders) for use in metrics and drawing
        let neck = null;
        const leftShoulderPt = results.poseLandmarks[11];
        const rightShoulderPt = results.poseLandmarks[12];
        if (leftShoulderPt && rightShoulderPt) {
          neck = {
            x: (leftShoulderPt.x + rightShoulderPt.x) / 2,
            y: (leftShoulderPt.y + rightShoulderPt.y) / 2,
            z: (leftShoulderPt.z + rightShoulderPt.z) / 2,
          };
        }
        // --- Head/neck flexion (pitch) ---
        // Mid-ear (average of left/right ear)
        const leftEar = results.poseLandmarks[7];
        const rightEar = results.poseLandmarks[8];
        const leftEye = results.poseLandmarks[1];
        const rightEye = results.poseLandmarks[2];
        let midEar = null, midEye = null;
        let flexionConf = 0;
        if (leftEar && rightEar) {
          midEar = {
            x: (leftEar.x + rightEar.x) / 2,
            y: (leftEar.y + rightEar.y) / 2,
          };
          // Confidence: average visibility of leftEar and rightEar
          flexionConf += (leftEar.visibility ?? 0) / 2;
          flexionConf += (rightEar.visibility ?? 0) / 2;
        }
        if (leftEye && rightEye) {
          midEye = {
            x: (leftEye.x + rightEye.x) / 2,
            y: (leftEye.y + rightEye.y) / 2,
          };
          // Confidence: average visibility of leftEye and rightEye
          flexionConf += (leftEye.visibility ?? 0) / 2;
          flexionConf += (rightEye.visibility ?? 0) / 2;
        }
        // Average over 4 landmarks
        flexionConf = flexionConf / 2;
        let flexionAngle = null;
        if (midEar && midEye) {
          flexionAngle = angleToVertical(midEar, midEye);
        }
        // --- Use calibrationRef.current for always-up-to-date calibration ---
        let calibratedAngle = flexionAngle;
        // Use calibrationRef to always get latest value
        const currentCalibration = calibrationRef.current;
        if (flexionAngle !== null && currentCalibration !== null) {
          calibratedAngle = flexionAngle - currentCalibration;
        }
        let status = '';
        if (calibratedAngle !== null) {
          if (calibratedAngle <= 15) status = 'Good';
          else if (calibratedAngle <= 20) status = 'Warn';
          else status = 'Alert';
        }
        setNeckFlexion(calibratedAngle !== null ? { angle: calibratedAngle, status, confidence: flexionConf } : null);
        // --- CVA (Cranio-Vertebral Angle) ---
        let cvaAngle = null;
        let cvaConf = 0;
        if (neck && midEar) {
          const dx = midEar.x - neck.x;
          const dy = midEar.y - neck.y;
          const mag = Math.sqrt(dx*dx + dy*dy);
          if (mag !== 0) {
            const angleRad = Math.atan2(-(dy), dx); // negative dy: y increases downward
            cvaAngle = Math.abs((angleRad * 180) / Math.PI);
          }
          // Confidence: average visibility of leftEar, rightEar, leftShoulder, rightShoulder
          const leftShoulder = results.poseLandmarks[11];
          const rightShoulder = results.poseLandmarks[12];
          let count = 0;
          let sum = 0;
          if (leftEar) { sum += leftEar.visibility ?? 0; count++; }
          if (rightEar) { sum += rightEar.visibility ?? 0; count++; }
          if (leftShoulder) { sum += leftShoulder.visibility ?? 0; count++; }
          if (rightShoulder) { sum += rightShoulder.visibility ?? 0; count++; }
          cvaConf = count > 0 ? sum / count : 0;
        }
        let cvaStatus = '';
        if (cvaAngle !== null) {
          if (cvaAngle >= 48) cvaStatus = 'Good';
          else if (cvaAngle >= 44) cvaStatus = 'Warn';
          else cvaStatus = 'Alert';
        }
        setCVA(cvaAngle !== null ? { angle: cvaAngle, status: cvaStatus, confidence: cvaConf } : null);
        // --- Forward-Shoulder Angle (FSA) ---
        let fsaAngle = null;
        let fsaConf = 0;
        let fsaCount = 0;
        // For FSA, use leftShoulder, rightShoulder (for neck), and leftHip (for visibility)
        const leftHipPt = results.poseLandmarks[23]; // Use different variable name to avoid conflict
        if (neck && leftShoulderPt) {
          // C7 is approximated as neck (midpoint of shoulders)
          // Acromion is left shoulder landmark
          const dx = leftShoulderPt.x - neck.x;
          const dy = leftShoulderPt.y - neck.y;
          const mag = Math.sqrt(dx*dx + dy*dy);
          if (mag !== 0) {
            // Vertical vector is (0, -1)
            const dot = (dx * 0) + (dy * -1);
            const angleRad = Math.acos(dot / mag);
            fsaAngle = Math.abs((angleRad * 180) / Math.PI);
          }
          // Confidence: average visibility of leftShoulder, rightShoulder, and leftHip
          const rightShoulder = results.poseLandmarks[12];
          if (leftShoulderPt) { fsaConf += leftShoulderPt.visibility ?? 0; fsaCount++; }
          if (rightShoulder) { fsaConf += rightShoulder.visibility ?? 0; fsaCount++; }
          if (leftHipPt) { fsaConf += leftHipPt.visibility ?? 0; fsaCount++; }
          fsaConf = fsaCount > 0 ? fsaConf / fsaCount : 0;
        }
        let fsaStatus = '';
        if (fsaAngle !== null) {
          if (fsaAngle <= 15) fsaStatus = 'Good';
          else if (fsaAngle <= 20) fsaStatus = 'Warn';
          else fsaStatus = 'Alert';
        }
        setFSA(fsaAngle !== null ? { angle: fsaAngle, status: fsaStatus, confidence: fsaConf } : null);
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
        const leftEarIdx = 7;
        const rightEarIdx = 8;
        const leftEyeIdx = 1;
        const rightEyeIdx = 2;
        const nose = 0;
        const leftHip = 23;
        const rightHip = 24;
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
          [leftEarIdx, rightEarIdx, leftEyeIdx, rightEyeIdx, nose].forEach(drawToNeck);
          // Draw neck to shoulders
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
      <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', mb: 2, flexDirection: 'column', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, justifyContent: 'center', alignItems: 'stretch', width: '100%', mb: 2 }}>
          <Paper sx={{ p: 2, minWidth: 160, maxWidth: 220, flex: 1, background: '#23272b', color: '#fff', textAlign: 'center', boxShadow: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Head/Neck Flexion (Pitch)</Typography>
            {neckFlexion ? (
              <>
                <Typography variant="h4" sx={{ color: neckFlexion.status === 'Good' ? '#4caf50' : neckFlexion.status === 'Warn' ? '#ff9800' : '#f44336', fontWeight: 700 }}>
                  {neckFlexion.angle.toFixed(1)}°
                </Typography>
                <Typography variant="subtitle1" sx={{ color: neckFlexion.status === 'Good' ? '#4caf50' : neckFlexion.status === 'Warn' ? '#ff9800' : '#f44336' }}>
                  {neckFlexion.status}
                </Typography>
                <Typography variant="caption" sx={{ color: '#90caf9' }}>
                  Confidence: {(neckFlexion.confidence * 100).toFixed(0)}%
                </Typography>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">Not detected</Typography>
            )}
          </Paper>
          <Paper sx={{ p: 2, minWidth: 160, maxWidth: 220, flex: 1, background: '#23272b', color: '#fff', textAlign: 'center', boxShadow: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Cranio-Vertebral Angle (CVA)</Typography>
            {cva ? (
              <>
                <Typography variant="h4" sx={{ color: cva.status === 'Good' ? '#4caf50' : cva.status === 'Warn' ? '#ff9800' : '#f44336', fontWeight: 700 }}>
                  {cva.angle.toFixed(1)}°
                </Typography>
                <Typography variant="subtitle1" sx={{ color: cva.status === 'Good' ? '#4caf50' : cva.status === 'Warn' ? '#ff9800' : '#f44336' }}>
                  {cva.status}
                </Typography>
                <Typography variant="caption" sx={{ color: '#90caf9' }}>
                  Confidence: {(cva.confidence * 100).toFixed(0)}%
                </Typography>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">Not detected</Typography>
            )}
          </Paper>
          <Paper sx={{ p: 2, minWidth: 160, maxWidth: 220, flex: 1, background: '#23272b', color: '#fff', textAlign: 'center', boxShadow: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Forward-Shoulder Angle (FSA)</Typography>
            {fsa ? (
              <>
                <Typography variant="h4" sx={{ color: fsa.status === 'Good' ? '#4caf50' : fsa.status === 'Warn' ? '#ff9800' : '#f44336', fontWeight: 700 }}>
                  {fsa.angle.toFixed(1)}°
                </Typography>
                <Typography variant="subtitle1" sx={{ color: fsa.status === 'Good' ? '#4caf50' : fsa.status === 'Warn' ? '#ff9800' : '#f44336' }}>
                  {fsa.status}
                </Typography>
                <Typography variant="caption" sx={{ color: '#90caf9' }}>
                  Confidence: {(fsa.confidence * 100).toFixed(0)}%
                </Typography>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">Not detected</Typography>
            )}
          </Paper>
        </Box>
        <Button
          variant="contained"
          color="primary"
          sx={{ mt: 1, background: '#1976d2' }}
          onClick={() => {
            // Use the latest measured flexion angle as calibration
            if (neckFlexion && neckFlexion.angle !== null && landmarks.length > 0) {
              // Recompute raw angle (not calibrated)
              const leftEar = landmarks[7];
              const rightEar = landmarks[8];
              const leftEye = landmarks[1];
              const rightEye = landmarks[2];
              let midEar = null, midEye = null;
              if (leftEar && rightEar) {
                midEar = {
                  x: (leftEar.x + rightEar.x) / 2,
                  y: (leftEar.y + rightEar.y) / 2,
                };
              }
              if (leftEye && rightEye) {
                midEye = {
                  x: (leftEye.x + rightEye.x) / 2,
                  y: (leftEye.y + rightEye.y) / 2,
                };
              }
              let flexionAngle = null;
              if (midEar && midEye) {
                flexionAngle = angleToVertical(midEar, midEye);
              }
              if (flexionAngle !== null) setCalibration(flexionAngle);
            }
          }}
        >
          Set Upright Calibration
        </Button>
        {calibration !== null && (
          <Typography variant="caption" sx={{ color: '#90caf9', mt: 1 }}>
            Upright calibrated at {calibration.toFixed(1)}°
          </Typography>
        )}
      </Box>
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
