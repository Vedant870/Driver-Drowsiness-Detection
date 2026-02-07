/* global FaceMesh, Camera */
const video = document.getElementById("input-video");
const canvas = document.getElementById("output-canvas");
const ctx = canvas.getContext("2d");

const fpsValue = document.getElementById("fps-value");
const faceValue = document.getElementById("face-value");
const lightValue = document.getElementById("light-value");
const headValue = document.getElementById("head-value");
const yawnValue = document.getElementById("yawn-value");
const blinkValue = document.getElementById("blink-value");

const earValue = document.getElementById("ear-value");
const perclosValue = document.getElementById("perclos-value");
const closedValue = document.getElementById("closed-value");
const yawValue = document.getElementById("yaw-value");
const sleepinessScore = document.getElementById("sleepiness-score");
const sleepinessGauge = document.getElementById("sleepiness-gauge");
const sleepinessBadge = document.getElementById("sleepiness-badge");
const alertBanner = document.getElementById("alert-banner");
const alarmSource = document.getElementById("alarm-source");

const cameraStatus = document.getElementById("camera-status");
const trackingStatus = document.getElementById("tracking-status");
const alarmStatus = document.getElementById("alarm-status");

const startBtn = document.getElementById("start-btn");
const stopBtn = document.getElementById("stop-btn");
const calibrateBtn = document.getElementById("calibrate-btn");
const testAlarmBtn = document.getElementById("test-alarm-btn");
const alarmFile = document.getElementById("alarm-file");

const toggleOverlay = document.getElementById("toggle-overlay");
const togglePerclos = document.getElementById("toggle-perclos");
const toggleYawn = document.getElementById("toggle-yawn");
const toggleHead = document.getElementById("toggle-head");

const earThreshold = document.getElementById("ear-threshold");
const earThresholdValue = document.getElementById("ear-threshold-value");
const drowsyDuration = document.getElementById("drowsy-duration");
const drowsyDurationValue = document.getElementById("drowsy-duration-value");
const blinkMax = document.getElementById("blink-max");
const blinkMaxValue = document.getElementById("blink-max-value");
const perclosWindow = document.getElementById("perclos-window");
const perclosWindowValue = document.getElementById("perclos-window-value");
const perclosThreshold = document.getElementById("perclos-threshold");
const perclosThresholdValue = document.getElementById("perclos-threshold-value");
const yawnThreshold = document.getElementById("yawn-threshold");
const yawnThresholdValue = document.getElementById("yawn-threshold-value");
const headThreshold = document.getElementById("head-threshold");
const headThresholdValue = document.getElementById("head-threshold-value");
const alarmVolume = document.getElementById("alarm-volume");
const alarmVolumeValue = document.getElementById("alarm-volume-value");

const copyConfigBtn = document.getElementById("copy-config");
const applyConfigBtn = document.getElementById("apply-config");
const configJson = document.getElementById("config-json");
const exportLogsBtn = document.getElementById("export-logs");
const logList = document.getElementById("log-list");

const DEFAULT_CONFIG = {
  earThreshold: 0.22,
  drowsyDuration: 3.0,
  blinkMax: 500,
  perclosWindow: 60,
  perclosThreshold: 0.4,
  yawnThreshold: 0.35,
  headTurnThreshold: 0.35,
  alarmVolume: 0.5,
  overlay: false,
  perclosEnabled: true,
  yawnEnabled: true,
  headPoseEnabled: true,
};

const state = {
  config: { ...DEFAULT_CONFIG },
  calibrated: false,
  baselineEar: null,
  lastFrameTs: performance.now(),
  fps: 0,
  facePresent: false,
  blinkCount: 0,
  eyeClosedSince: null,
  lastBlinkTs: null,
  alertActive: false,
  perclosBuffer: [],
  yawnActive: false,
  headTurned: false,
  audioCtx: null,
  alarmAudio: null,
  alarmBuffer: null,
  alarmLabel: "Default (beep)",
  log: [],
  camera: null,
};

const LEFT_EYE = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380];
const MOUTH = [13, 14, 78, 308];

const setChip = (element, value, tone = "accent") => {
  element.querySelector("span").textContent = value;
  if (tone === "danger") {
    element.style.borderColor = "rgba(255, 77, 109, 0.6)";
    element.style.color = "#ff8fa3";
  } else if (tone === "success") {
    element.style.borderColor = "rgba(24, 255, 160, 0.6)";
    element.style.color = "#7dffd3";
  } else {
    element.style.borderColor = "rgba(128, 159, 255, 0.2)";
    element.style.color = "#d6e1ff";
  }
};

const logEvent = (type, detail) => {
  const stamp = new Date().toLocaleTimeString();
  const entry = { stamp, type, detail };
  state.log.unshift(entry);
  if (state.log.length > 80) state.log.pop();
  renderLogs();
};

const renderLogs = () => {
  logList.innerHTML = "";
  state.log.slice(0, 18).forEach((entry) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${entry.type}</span><span>${entry.detail}</span>`;
    logList.appendChild(li);
  });
};

const initAudio = async () => {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (!state.alarmBuffer) {
    state.alarmBuffer = buildBeepBuffer(state.audioCtx);
    state.alarmLabel = "Default (beep)";
    alarmSource.textContent = state.alarmLabel;
  }
};

const buildBeepBuffer = (audioCtx) => {
  const duration = 0.9;
  const sampleRate = audioCtx.sampleRate;
  const frameCount = sampleRate * duration;
  const buffer = audioCtx.createBuffer(1, frameCount, sampleRate);
  const data = buffer.getChannelData(0);
  const startFreq = 760;
  const endFreq = 520;
  for (let i = 0; i < frameCount; i += 1) {
    const t = i / sampleRate;
    const freq = startFreq + (endFreq - startFreq) * (t / duration);
    const envelope = Math.sin(Math.PI * Math.min(1, t / duration));
    data[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.6;
  }
  return buffer;
};

const playAlarm = async () => {
  await initAudio();
  if (state.alarmAudio) {
    state.alarmAudio.stop();
  }
  const source = state.audioCtx.createBufferSource();
  source.buffer = state.alarmBuffer;
  const gain = state.audioCtx.createGain();
  gain.gain.value = state.config.alarmVolume;
  source.connect(gain).connect(state.audioCtx.destination);
  source.start(0);
  state.alarmAudio = source;
  setChip(alarmStatus, "Active", "danger");
};

const stopAlarm = () => {
  if (state.alarmAudio) {
    state.alarmAudio.stop();
    state.alarmAudio = null;
  }
  setChip(alarmStatus, "Standby", "success");
};

const updateGauge = (score) => {
  const clamped = Math.max(0, Math.min(100, score));
  const circumference = 2 * Math.PI * 46;
  const offset = circumference * (1 - clamped / 100);
  sleepinessGauge.style.strokeDasharray = `${circumference.toFixed(2)}`;
  sleepinessGauge.style.strokeDashoffset = `${offset.toFixed(2)}`;
  if (clamped > 70) {
    sleepinessGauge.style.stroke = "#ff4d6d";
  } else if (clamped > 40) {
    sleepinessGauge.style.stroke = "#ffb84d";
  } else {
    sleepinessGauge.style.stroke = "#5bf0ff";
  }
  sleepinessScore.textContent = Math.round(clamped);
};

const updateBadge = (level) => {
  sleepinessBadge.textContent = level;
  sleepinessBadge.classList.remove("warn", "danger");
  if (level === "Warning") {
    sleepinessBadge.classList.add("warn");
  }
  if (level === "Critical") {
    sleepinessBadge.classList.add("danger");
  }
};

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const eyeEAR = (landmarks, eye) => {
  const p1 = landmarks[eye[0]];
  const p2 = landmarks[eye[1]];
  const p3 = landmarks[eye[2]];
  const p4 = landmarks[eye[3]];
  const p5 = landmarks[eye[4]];
  const p6 = landmarks[eye[5]];
  const vertical = distance(p2, p6) + distance(p3, p5);
  const horizontal = distance(p1, p4);
  return vertical / (2.0 * horizontal);
};

const mouthRatio = (landmarks) => {
  const top = landmarks[MOUTH[0]];
  const bottom = landmarks[MOUTH[1]];
  const left = landmarks[MOUTH[2]];
  const right = landmarks[MOUTH[3]];
  return distance(top, bottom) / distance(left, right);
};

const headYawRatio = (landmarks) => {
  const left = landmarks[234];
  const right = landmarks[454];
  const nose = landmarks[1];
  const leftDist = distance(nose, left);
  const rightDist = distance(nose, right);
  return Math.abs(leftDist - rightDist) / Math.max(leftDist, rightDist);
};

const updateConfigUI = () => {
  earThreshold.value = state.config.earThreshold;
  earThresholdValue.textContent = state.config.earThreshold.toFixed(2);
  drowsyDuration.value = state.config.drowsyDuration;
  drowsyDurationValue.textContent = state.config.drowsyDuration.toFixed(1);
  blinkMax.value = state.config.blinkMax;
  blinkMaxValue.textContent = `${state.config.blinkMax}`;
  perclosWindow.value = state.config.perclosWindow;
  perclosWindowValue.textContent = `${state.config.perclosWindow}`;
  perclosThreshold.value = state.config.perclosThreshold;
  perclosThresholdValue.textContent = state.config.perclosThreshold.toFixed(2);
  yawnThreshold.value = state.config.yawnThreshold;
  yawnThresholdValue.textContent = state.config.yawnThreshold.toFixed(2);
  headThreshold.value = state.config.headTurnThreshold;
  headThresholdValue.textContent = state.config.headTurnThreshold.toFixed(2);
  alarmVolume.value = state.config.alarmVolume;
  alarmVolumeValue.textContent = state.config.alarmVolume.toFixed(2);
  toggleOverlay.checked = state.config.overlay;
  togglePerclos.checked = state.config.perclosEnabled;
  toggleYawn.checked = state.config.yawnEnabled;
  toggleHead.checked = state.config.headPoseEnabled;
  configJson.value = JSON.stringify(state.config, null, 2);
};

const applyConfigFromInputs = () => {
  state.config.earThreshold = parseFloat(earThreshold.value);
  state.config.drowsyDuration = parseFloat(drowsyDuration.value);
  state.config.blinkMax = parseInt(blinkMax.value, 10);
  state.config.perclosWindow = parseInt(perclosWindow.value, 10);
  state.config.perclosThreshold = parseFloat(perclosThreshold.value);
  state.config.yawnThreshold = parseFloat(yawnThreshold.value);
  state.config.headTurnThreshold = parseFloat(headThreshold.value);
  state.config.alarmVolume = parseFloat(alarmVolume.value);
  state.config.overlay = toggleOverlay.checked;
  state.config.perclosEnabled = togglePerclos.checked;
  state.config.yawnEnabled = toggleYawn.checked;
  state.config.headPoseEnabled = toggleHead.checked;
  updateConfigUI();
};

const updatePerclos = (isClosed, timestamp) => {
  const windowMs = state.config.perclosWindow * 1000;
  state.perclosBuffer.push({ isClosed, timestamp });
  state.perclosBuffer = state.perclosBuffer.filter(
    (entry) => timestamp - entry.timestamp <= windowMs
  );
  const closedCount = state.perclosBuffer.filter((e) => e.isClosed).length;
  return closedCount / Math.max(1, state.perclosBuffer.length);
};

const updateDrowsinessAlert = (score, closedDuration, perclos) => {
  const drowsy =
    closedDuration >= state.config.drowsyDuration ||
    (state.config.perclosEnabled && perclos >= state.config.perclosThreshold);
  if (drowsy && !state.alertActive) {
    state.alertActive = true;
    alertBanner.classList.add("active");
    playAlarm();
    logEvent("ALERT", `Drowsy detected (${closedDuration.toFixed(1)}s)`);
  }
  if (!drowsy && state.alertActive) {
    state.alertActive = false;
    alertBanner.classList.remove("active");
    stopAlarm();
    logEvent("RECOVER", "Alert cleared");
  }
  return drowsy;
};

const updateMetrics = (data) => {
  earValue.textContent = data.ear.toFixed(3);
  perclosValue.textContent = `${Math.round(data.perclos * 100)}%`;
  closedValue.textContent = `${data.closedDuration.toFixed(1)}s`;
  yawValue.textContent = data.yawRatio.toFixed(2);
  blinkValue.textContent = `${state.blinkCount}`;
  headValue.textContent = data.headTurned ? "Turn" : "Centered";
  yawnValue.textContent = data.yawning ? "Yes" : "No";
  faceValue.textContent = data.facePresent ? "Yes" : "No";
  lightValue.textContent = data.lightScore;
};

const updateStatusChips = (isTracking) => {
  if (isTracking) {
    setChip(trackingStatus, "Online", "success");
  } else {
    setChip(trackingStatus, "Offline", "danger");
  }
};

const updateSleepinessScore = (data) => {
  let score = 0;
  score += Math.min(60, data.closedDuration * 15);
  score += data.perclos * 40;
  score += data.yawning ? 15 : 0;
  score += data.headTurned ? 10 : 0;
  updateGauge(score);
  if (score > 70) {
    updateBadge("Critical");
  } else if (score > 40) {
    updateBadge("Warning");
  } else {
    updateBadge("Normal");
  }
  return score;
};

const updateFPS = () => {
  const now = performance.now();
  const delta = now - state.lastFrameTs;
  state.fps = 1000 / delta;
  state.lastFrameTs = now;
  fpsValue.textContent = state.fps.toFixed(0);
};

const drawOverlay = (results) => {
  if (!state.config.overlay) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
  if (results.multiFaceLandmarks?.length) {
    const face = results.multiFaceLandmarks[0];
    const { xMin, xMax, yMin, yMax } = face.reduce(
      (acc, point) => ({
        xMin: Math.min(acc.xMin, point.x * canvas.width),
        xMax: Math.max(acc.xMax, point.x * canvas.width),
        yMin: Math.min(acc.yMin, point.y * canvas.height),
        yMax: Math.max(acc.yMax, point.y * canvas.height),
      }),
      { xMin: canvas.width, xMax: 0, yMin: canvas.height, yMax: 0 }
    );
    ctx.strokeStyle = "rgba(91, 240, 255, 0.8)";
    ctx.lineWidth = 2;
    ctx.strokeRect(xMin - 10, yMin - 20, xMax - xMin + 20, yMax - yMin + 30);
  }
  ctx.restore();
};

const estimateLight = () => {
  const sampleSize = 16;
  ctx.drawImage(video, 0, 0, sampleSize, sampleSize);
  const data = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
  }
  const avg = sum / (sampleSize * sampleSize);
  if (avg < 60) return "Low";
  if (avg < 140) return "Medium";
  return "High";
};

const onResults = (results) => {
  updateFPS();
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const facePresent = results.multiFaceLandmarks?.length > 0;
  state.facePresent = facePresent;
  updateStatusChips(facePresent);

  if (!facePresent) {
    faceValue.textContent = "No";
    alertBanner.classList.remove("active");
    stopAlarm();
    return;
  }

  const landmarks = results.multiFaceLandmarks[0];
  const leftEAR = eyeEAR(landmarks, LEFT_EYE);
  const rightEAR = eyeEAR(landmarks, RIGHT_EYE);
  const ear = (leftEAR + rightEAR) / 2;
  const yawRatio = mouthRatio(landmarks);
  const headTurnRatio = headYawRatio(landmarks);

  if (state.calibrated && state.baselineEar) {
    state.config.earThreshold = Math.max(0.14, state.baselineEar * 0.72);
    earThreshold.value = state.config.earThreshold;
    earThresholdValue.textContent = state.config.earThreshold.toFixed(2);
  }

  const isClosed = ear < state.config.earThreshold;
  if (isClosed) {
    if (!state.eyeClosedSince) {
      state.eyeClosedSince = performance.now();
    }
  } else {
    if (state.eyeClosedSince) {
      const closedMs = performance.now() - state.eyeClosedSince;
      if (closedMs < state.config.blinkMax) {
        state.blinkCount += 1;
      }
      state.eyeClosedSince = null;
    }
  }

  const closedDuration = state.eyeClosedSince
    ? (performance.now() - state.eyeClosedSince) / 1000
    : 0;
  const perclos = updatePerclos(isClosed, performance.now());
  const yawning = state.config.yawnEnabled && yawRatio > state.config.yawnThreshold;
  const headTurned =
    state.config.headPoseEnabled && headTurnRatio > state.config.headTurnThreshold;

  if (yawning && !state.yawnActive) {
    logEvent("YAWN", "Possible yawn detected");
    state.yawnActive = true;
  }
  if (!yawning) state.yawnActive = false;

  if (headTurned && !state.headTurned) {
    logEvent("HEAD", "Head turned away");
    state.headTurned = true;
  }
  if (!headTurned) state.headTurned = false;

  const lightScore = estimateLight();
  const metrics = {
    ear,
    perclos,
    closedDuration,
    yawRatio,
    yawning,
    headTurned,
    facePresent,
    lightScore,
  };

  updateMetrics(metrics);
  updateSleepinessScore(metrics);
  updateDrowsinessAlert(updateSleepinessScore(metrics), closedDuration, perclos);
  drawOverlay(results);
};

const setupFaceMesh = () => {
  const faceMesh = new FaceMesh({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  });
  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  faceMesh.onResults(onResults);
  return faceMesh;
};

const startCamera = async () => {
  try {
    const faceMesh = setupFaceMesh();
    state.camera = new Camera(video, {
      onFrame: async () => {
        await faceMesh.send({ image: video });
      },
      width: 1280,
      height: 720,
    });
    await state.camera.start();
    setChip(cameraStatus, "Active", "success");
    logEvent("SYSTEM", "Camera started");
  } catch (error) {
    console.error(error);
    setChip(cameraStatus, "Error", "danger");
    logEvent("ERROR", "Camera permissions blocked");
  }
};

const stopCamera = () => {
  if (state.camera) {
    state.camera.stop();
    state.camera = null;
  }
  setChip(cameraStatus, "Idle", "accent");
  setChip(trackingStatus, "Offline", "danger");
  stopAlarm();
  logEvent("SYSTEM", "Camera stopped");
};

const calibrateEyes = () => {
  state.calibrated = true;
  state.baselineEar = parseFloat(earValue.textContent);
  logEvent("CALIBRATE", `Baseline EAR ${state.baselineEar.toFixed(3)}`);
};

const handleAlarmFile = (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    if (!state.audioCtx) {
      state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    state.alarmBuffer = await state.audioCtx.decodeAudioData(reader.result);
    state.alarmLabel = file.name;
    alarmSource.textContent = state.alarmLabel;
    logEvent("ALARM", "Custom alarm uploaded");
  };
  reader.readAsArrayBuffer(file);
};

earThreshold.addEventListener("input", () => {
  earThresholdValue.textContent = parseFloat(earThreshold.value).toFixed(2);
  applyConfigFromInputs();
});
drowsyDuration.addEventListener("input", () => {
  drowsyDurationValue.textContent = parseFloat(drowsyDuration.value).toFixed(1);
  applyConfigFromInputs();
});
blinkMax.addEventListener("input", () => {
  blinkMaxValue.textContent = blinkMax.value;
  applyConfigFromInputs();
});
perclosWindow.addEventListener("input", () => {
  perclosWindowValue.textContent = perclosWindow.value;
  applyConfigFromInputs();
});
perclosThreshold.addEventListener("input", () => {
  perclosThresholdValue.textContent = parseFloat(perclosThreshold.value).toFixed(2);
  applyConfigFromInputs();
});
yawnThreshold.addEventListener("input", () => {
  yawnThresholdValue.textContent = parseFloat(yawnThreshold.value).toFixed(2);
  applyConfigFromInputs();
});
headThreshold.addEventListener("input", () => {
  headThresholdValue.textContent = parseFloat(headThreshold.value).toFixed(2);
  applyConfigFromInputs();
});
alarmVolume.addEventListener("input", () => {
  alarmVolumeValue.textContent = parseFloat(alarmVolume.value).toFixed(2);
  applyConfigFromInputs();
});
toggleOverlay.addEventListener("change", applyConfigFromInputs);
togglePerclos.addEventListener("change", applyConfigFromInputs);
toggleYawn.addEventListener("change", applyConfigFromInputs);
toggleHead.addEventListener("change", applyConfigFromInputs);

copyConfigBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(configJson.value);
  logEvent("CONFIG", "Configuration copied");
});

applyConfigBtn.addEventListener("click", () => {
  try {
    const parsed = JSON.parse(configJson.value);
    state.config = { ...state.config, ...parsed };
  updateConfigUI();
  logEvent("CONFIG", "Configuration applied");
} catch (error) {
  logEvent("CONFIG", "Invalid JSON");
}
});

exportLogsBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state.log, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "drowsiness-logs.json";
  link.click();
  URL.revokeObjectURL(url);
  logEvent("EXPORT", "Logs exported");
});

startBtn.addEventListener("click", async () => {
  await initAudio();
  startCamera();
});
stopBtn.addEventListener("click", stopCamera);
calibrateBtn.addEventListener("click", calibrateEyes);
testAlarmBtn.addEventListener("click", () => {
  playAlarm();
  setTimeout(stopAlarm, 1200);
});
alarmFile.addEventListener("change", handleAlarmFile);

updateConfigUI();
alarmSource.textContent = state.alarmLabel;
setChip(cameraStatus, "Idle", "accent");
setChip(trackingStatus, "Offline", "danger");
setChip(alarmStatus, "Standby", "success");
logEvent("SYSTEM", "Console ready");
