# Desk Coach: Posture Tracking PWA

Desk Coach is a privacy-first desktop PWA that uses your webcam to analyze your sitting posture at your desk. All posture analysis runs locally in your browser using in-browser machine learning (TensorFlow.js or MediaPipe). No video data leaves your device.

## Features
- Real-time posture detection using your webcam
- All processing is local for maximum privacy
- Installable as a desktop PWA (macOS, Windows, Linux)
- Designed for easy addition of notifications and posture history

## Getting Started
1. Install dependencies:
   ```sh
   npm install
   ```
2. Start the development server:
   ```sh
   npm run dev
   ```
3. Open the provided local URL in your browser to test the app.

## Roadmap
- [ ] Integrate webcam access
- [ ] Add in-browser posture detection (TensorFlow.js/MediaPipe)
- [ ] Real-time feedback and notifications
- [ ] Local posture history storage

## Privacy
All posture analysis is performed locally in your browser. No video or image data is sent to any server unless you explicitly enable cloud features (future roadmap).

---

This project was bootstrapped with Vite + React + TypeScript.
