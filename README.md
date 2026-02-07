# Driver Drowsiness Detection (Web UI)

Futuristic browser-based console for real-time driver drowsiness detection using MediaPipe FaceMesh. It tracks face/eye landmarks, computes EAR (eye aspect ratio), blink timing, PERCLOS, yawn ratio, and head turn ratio, then triggers alarms if eyes remain closed for 3+ seconds (configurable).

## Features
- Live webcam feed with AI overlay and telemetry HUD
- EAR-based blink detection + closed-eye duration
- PERCLOS window monitoring (configurable)
- Yawn + head pose heuristics
- Alarm sound with volume control and custom upload
- AI configuration panel (copy/apply JSON)
- Event log with export

## How to Run
1. Open [`index.html`](index.html:1) in a local server.
2. Allow camera permissions.
3. Click **Start Camera**.

### Quick local server (Windows cmd)
```bat
cd c:\Users\Vedant_kasaudhan\OneDrive\Desktop\JavaPractice\Driver-Drowsiness-Detection
python -m http.server 5173
```
Then open `http://localhost:5173` in Chrome/Edge.

## Configuration
Use the AI Configuration panel sliders or paste JSON. Example:
```json
{
  "earThreshold": 0.22,
  "drowsyDuration": 3,
  "blinkMax": 500,
  "perclosWindow": 60,
  "perclosThreshold": 0.4,
  "yawnThreshold": 0.35,
  "headTurnThreshold": 0.35,
  "alarmVolume": 0.6,
  "overlay": true,
  "perclosEnabled": true,
  "yawnEnabled": true,
  "headPoseEnabled": true
}
```

## Notes
- Camera access requires HTTPS or `localhost`.
- For real deployments, replace heuristics with a trained model and link to IoT alerting APIs.
