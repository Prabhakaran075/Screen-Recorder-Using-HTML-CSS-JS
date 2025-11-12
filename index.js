const video = document.querySelector("video");
const recordBtn = document.querySelector(".btn.record");
const captureBtn = document.querySelector(".btn.capture");
const switchBtn = document.querySelector(".btn.switch");
const micToggleBtn = document.querySelector(".btn.mic-toggle");
const status = document.querySelector(".status");
const statusText = document.querySelector(".status-text");
const progress = document.querySelector(".progress");
const timerDisplay = document.querySelector(".timer");

let recorder, chunks = [], stream;
let audioEnabled = true, isRecording = false, timer, counter = 0;
let useFrontCamera = true;

// Detect if mobile
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// Initialize right away
window.addEventListener("load", initStream);

// 🎥 Initialize Stream
async function initStream() {
  try {
    updateStatus("Requesting access...", false);

    if (isMobile) {
      // Camera mode for mobile
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: useFrontCamera ? "user" : "environment" },
        audio: audioEnabled,
      });
    } else {
      // Screen mode for desktop
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });

      if (audioEnabled) {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream = new MediaStream([...screenStream.getTracks(), ...micStream.getTracks()]);
      } else {
        stream = screenStream;
      }
    }

    video.srcObject = stream;
    updateStatus(isMobile ? "Camera ready" : "Screen ready", false);
  } catch (err) {
    console.error(err);
    updateStatus("Access denied", false);
    alert("Permission denied. Please enable camera/screen access.");
  }
}

// 🧭 Update status
function updateStatus(text, active) {
  statusText.textContent = text;
  status.classList.toggle("active", active);
}

// 🎥 Record
recordBtn.addEventListener("click", async () => {
  if (!stream) await initStream();
  if (!stream) return;

  if (!isRecording) {
    recorder = new MediaRecorder(stream);
    chunks = [];

    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = isMobile ? "camera_recording.webm" : "screen_recording.webm";
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

// 📸 Capture image
captureBtn.addEventListener("click", () => {
  if (!video.srcObject) return alert("Start stream first!");
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const img = canvas.toDataURL("image/png");

  const a = document.createElement("a");
  a.href = img;
  a.download = isMobile ? "photo.png" : "screenshot.png";
  a.click();
});

// 🔄 Switch camera (mobile only)
switchBtn.addEventListener("click", async () => {
  if (!isMobile) return alert("Switch camera only available on mobile.");
  useFrontCamera = !useFrontCamera;
  await initStream();
});

// 🎤 Toggle mic
micToggleBtn.addEventListener("click", async () => {
  audioEnabled = !audioEnabled;
  micToggleBtn.classList.toggle("off", !audioEnabled);
  micToggleBtn.textContent = audioEnabled ? "🎤 Mic On" : "🔇 Mic Off";
  await initStream();
});

// ⏱ Timer logic
function startTimer() {
  counter = 0;
  progress.style.width = "0%";
  timer = setInterval(() => {
    counter++;
    timerDisplay.textContent = formatTime(counter);
    progress.style.width = Math.min(counter / 600 * 100, 100) + "%";
  }, 1000);
}

function stopTimer() {
  clearInterval(timer);
  timerDisplay.textContent = "00:00:00";
  progress.style.width = "0%";
}

function formatTime(seconds) {
  const hrs = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${hrs}:${mins}:${secs}`;
}
