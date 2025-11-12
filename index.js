const video = document.querySelector("video");
const recordBtn = document.querySelector(".btn.record");
const captureBtn = document.querySelector(".btn.capture");
const micToggleBtn = document.querySelector(".btn.mic-toggle");
const status = document.querySelector(".status");
const statusText = document.querySelector(".status-text");
const progressBar = document.querySelector(".progress");
const timerDisplay = document.querySelector(".timer");

let recorder;
let chunks = [];
let stream;
let audioEnabled = true;
let isRecording = false;
let timer, counter = 0;

// Get screen + mic stream
async function initStream() {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: audioEnabled
    });

    // Combine mic audio with screen if mic enabled
    if (audioEnabled) {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const combined = new MediaStream([
        ...screenStream.getTracks(),
        ...audioStream.getTracks()
      ]);
      stream = combined;
    } else {
      stream = screenStream;
    }

    video.srcObject = stream;
  } catch (err) {
    alert("Screen sharing permission denied.");
  }
}

// Start or stop recording
recordBtn.addEventListener("click", async () => {
  if (!isRecording) {
    await initStream();
    recorder = new MediaRecorder(stream);
    chunks = [];

    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "recording.webm";
      a.click();
    };

    recorder.start();
    isRecording = true;
    updateStatus("Recording...", true);
    recordBtn.classList.add("active");
    startTimer();
  } else {
    recorder.stop();
    stopTimer();
    isRecording = false;
    updateStatus("Idle", false);
    recordBtn.classList.remove("active");
    stream.getTracks().forEach(track => track.stop());
  }
});

// Capture Screenshot
captureBtn.addEventListener("click", () => {
  if (!video.srcObject) return alert("Start screen sharing first!");
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const img = canvas.toDataURL("image/png");

  const a = document.createElement("a");
  a.href = img;
  a.download = "screenshot.png";
  a.click();
});

// Toggle Microphone
micToggleBtn.addEventListener("click", () => {
  audioEnabled = !audioEnabled;
  micToggleBtn.classList.toggle("off", !audioEnabled);
  micToggleBtn.textContent = audioEnabled ? "🎤 Mic On" : "🔇 Mic Off";
});

// Timer & Progress
function startTimer() {
  counter = 0;
  progressBar.style.width = "0%";
  timer = setInterval(() => {
    counter++;
    timerDisplay.textContent = formatTime(counter);
    progressBar.style.width = Math.min(counter / 600 * 100, 100) + "%";
  }, 1000);
}

function stopTimer() {
  clearInterval(timer);
  timerDisplay.textContent = "00:00:00";
  progressBar.style.width = "0%";
}

function formatTime(seconds) {
  const hrs = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${hrs}:${mins}:${secs}`;
} 

// UI Updates
function updateStatus(text, active) {
  statusText.textContent = text;
  status.classList.toggle("active", active);
}
