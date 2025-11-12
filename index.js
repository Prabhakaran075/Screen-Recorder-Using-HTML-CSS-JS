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

// Auto request when page loads
window.addEventListener("load", async () => {
  await initStream();
});

// Request screen + mic stream automatically
async function initStream() {
  try {
    updateStatus("Requesting access...", false);
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: true,
    });

    let finalStream = screenStream;

    // Add mic audio track
    if (audioEnabled) {
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        finalStream = new MediaStream([
          ...screenStream.getTracks(),
          ...micStream.getTracks(),
        ]);
      } catch (micError) {
        console.warn("Microphone permission denied:", micError);
      }
    }

    stream = finalStream;
    video.srcObject = stream;
    updateStatus("Ready to record", false);
  } catch (err) {
    updateStatus("Access denied. Please allow screen recording.", false);
    alert("Permission denied. Please allow screen recording.");
  }
}

// Record
recordBtn.addEventListener("click", async () => {
  if (!stream) await initStream();
  if (!stream) return alert("Cannot access stream!");

  if (!isRecording) {
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
    recordBtn.classList.add("active");
    updateStatus("Recording...", true);
    startTimer();
  } else {
    recorder.stop();
    isRecording = false;
    stopTimer();
    updateStatus("Stopped", false);
    recordBtn.classList.remove("active");
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

// Toggle Mic
micToggleBtn.addEventListener("click", async () => {
  audioEnabled = !audioEnabled;
  micToggleBtn.classList.toggle("off", !audioEnabled);
  micToggleBtn.textContent = audioEnabled ? "Mic On" : "Mic Off";

  // Refresh stream immediately
  await initStream();
});

// Timer
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

// UI Status
function updateStatus(text, active) {
  statusText.textContent = text;
  status.classList.toggle("active", active);
}
