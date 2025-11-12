// core elements
const video = document.querySelector("video");
const recordBtn = document.querySelector(".btn.record");
const captureBtn = document.querySelector(".btn.capture");
const switchBtn = document.querySelector(".btn.switch");
const micToggleBtn = document.querySelector(".btn.mic-toggle");
const statusText = document.querySelector(".status-text");
const progress = document.querySelector(".progress");
const timerDisplay = document.querySelector(".timer");

// filter controls
const presets = document.querySelectorAll(".preset");
const controls = {
  hue: document.getElementById("hue"),
  saturate: document.getElementById("saturate"),
  brightness: document.getElementById("brightness"),
  contrast: document.getElementById("contrast"),
  grayscale: document.getElementById("grayscale"),
  sepia: document.getElementById("sepia"),
  blur: document.getElementById("blur")
};

let isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
let useFrontCamera = true;
let audioEnabled = true;
let stream = null;
let recorder = null;
let chunks = [];
let isRecording = false;
let timer, counter = 0;

// Canvas pipeline for filtered recording
const offscreenCanvas = document.createElement("canvas");
const offCtx = offscreenCanvas.getContext("2d");

// build CSS filter string from controls
function buildFilterString() {
  const h = controls.hue.value;
  const s = controls.saturate.value;
  const b = controls.brightness.value;
  const c = controls.contrast.value;
  const g = controls.grayscale.value;
  const sp = controls.sepia.value;
  const bl = controls.blur.value;
  // CSS filter for preview
  return `hue-rotate(${h}deg) saturate(${s}%) brightness(${b}%) contrast(${c}%) grayscale(${g}%) sepia(${sp}%) blur(${bl}px)`;
}

// build Canvas2D filter for drawing (ctx.filter uses same syntax)
function buildCtxFilterString() {
  return buildFilterString();
}

// apply filter to preview & remember current filter
function applyFilterToPreview() {
  const filter = buildFilterString();
  video.style.filter = filter;
}

// wire slider events
Object.values(controls).forEach(input => {
  input.addEventListener("input", () => {
    // remove preset active state since slider changed
    presets.forEach(p => p.classList.remove("active"));
    applyFilterToPreview();
  });
});

// preset shortcuts
presets.forEach(btn => {
  btn.addEventListener("click", () => {
    presets.forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    switch (btn.dataset.filter) {
      case "warm":
        controls.hue.value = 15; controls.saturate.value = 120; controls.brightness.value = 105; controls.contrast.value = 105; controls.sepia.value = 12; controls.grayscale.value = 0; controls.blur.value = 0;
        break;
      case "cool":
        controls.hue.value = 200; controls.saturate.value = 110; controls.brightness.value = 100; controls.contrast.value = 100; controls.sepia.value = 0; controls.grayscale.value = 0; controls.blur.value = 0;
        break;
      case "mono":
        controls.hue.value = 0; controls.saturate.value = 0; controls.brightness.value = 100; controls.contrast.value = 110; controls.sepia.value = 0; controls.grayscale.value = 100; controls.blur.value = 0;
        break;
      case "vivid":
        controls.hue.value = 10; controls.saturate.value = 160; controls.brightness.value = 110; controls.contrast.value = 120; controls.sepia.value = 0; controls.grayscale.value = 0; controls.blur.value = 0;
        break;
      default: // none
        controls.hue.value=0; controls.saturate.value=100; controls.brightness.value=100; controls.contrast.value=100; controls.grayscale.value=0; controls.sepia.value=0; controls.blur.value=0;
    }
    applyFilterToPreview();
  });
});

// initialization: auto request stream (desktop uses screen, mobile uses camera)
window.addEventListener("load", initStream);
async function initStream(){
  statusText.textContent = "Requesting access...";
  try {
    if (isMobile) {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: useFrontCamera ? "user":"environment" },
        audio: audioEnabled
      });
      statusText.textContent = "Camera ready";
    } else {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      if (audioEnabled) {
        // mix mic
        try {
          const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream = new MediaStream([...screenStream.getTracks(), ...mic.getTracks()]);
        } catch(_) { stream = screenStream; }
      } else stream = screenStream;
      statusText.textContent = "Screen ready";
    }
    video.srcObject = stream;
    applyFilterToPreview();
  } catch (err) {
    console.warn(err);
    statusText.textContent = "Access denied";
    alert("Permission denied or not available on this device.");
  }
}

// capture frame (uses preview filter for screenshot)
captureBtn.addEventListener("click", () => {
  if (!video.srcObject) return alert("No stream available.");
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext("2d");
  // apply ctx filter same as preview so captured image matches
  ctx.filter = buildCtxFilterString();
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a"); a.href = url; a.download = "capture.png"; a.click();
});

// switch camera (mobile)
switchBtn.addEventListener("click", async () => {
  if (!isMobile) return alert("Switch only on mobile.");
  useFrontCamera = !useFrontCamera;
  if (stream) stopTracks(stream);
  await initStream();
});

// mic toggle
micToggleBtn.addEventListener("click", async () => {
  audioEnabled = !audioEnabled;
  micToggleBtn.textContent = audioEnabled ? "Mic On" : "Mic Off";
  if (stream) stopTracks(stream);
  await initStream();
});

// recording pipeline: draw filtered frames to canvas, capture canvas stream
recordBtn.addEventListener("click", async () => {
  if (!isRecording) {
    if (!stream) { await initStream(); if (!stream) return; }

    // set canvas size
    offscreenCanvas.width = video.videoWidth || 1280;
    offscreenCanvas.height = video.videoHeight || 720;

    // draw loop to canvas (applies ctx.filter)
    let running = true;
    function drawFrame(){
      if (!running) return;
      try {
        offCtx.filter = buildCtxFilterString();
        offCtx.drawImage(video, 0, 0, offscreenCanvas.width, offscreenCanvas.height);
      } catch(e) { /* drawing may fail initially */ }
      requestAnimationFrame(drawFrame);
    }
    drawFrame();

    // mix audio: prefer existing stream audio tracks (mic + screen)
    const canvasStream = offscreenCanvas.captureStream(30); // 30fps
    // attach audio tracks to canvasStream
    stream.getAudioTracks().forEach(t => canvasStream.addTrack(t));

    recorder = new MediaRecorder(canvasStream, { mimeType: "video/webm; codecs=vp8,opus" });
    chunks = [];
    recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      running = false;
      const blob = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = (isMobile ? "camera_filtered.webm" : "screen_filtered.webm"); a.click();
    };
    recorder.start(1000); // gather every 1s
    isRecording = true;
    recordBtn.classList.add("active");
    statusText.textContent = "Recording...";
    startTimer();
  } else {
    recorder.stop();
    isRecording = false;
    recordBtn.classList.remove("active");
    statusText.textContent = "Stopped";
    stopTimer();
  }
});

// helpers
function stopTracks(s) { s.getTracks().forEach(t=>t.stop()); }
function formatTime(s){ const hh = String(Math.floor(s/3600)).padStart(2,'0'); const mm = String(Math.floor((s%3600)/60)).padStart(2,'0'); const ss = String(s%60).padStart(2,'0'); return `${hh}:${mm}:${ss}`; }

// timer/progress
function startTimer(){
  counter=0; progress.style.width='0%';
  timer = setInterval(()=>{ counter++; timerDisplay.textContent = formatTime(counter); progress.style.width = Math.min(counter/600*100,100) + '%'; },1000);
}
function stopTimer(){ clearInterval(timer); timerDisplay.textContent='00:00:00'; progress.style.width='0%'; counter=0; }
