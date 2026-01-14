const streamUrlInput = document.getElementById("stream-url");
const streamElement = document.getElementById("stream");

function updateStreamUrl() {
  const streamBase = streamUrlInput.value.trim();
  if (!streamBase) return;

  // Append typical mjpg-streamer endpoint
  streamElement.src = streamBase.replace(/\/+$/, "") + "/?action=stream";
}




const DISABLE_RIGHT_CLICK = false;

if (DISABLE_RIGHT_CLICK) {
  document.addEventListener("contextmenu", (e) => e.preventDefault());
}

const roverUrlInput = document.getElementById("rover-url");
const speedInput = document.getElementById("speed");

function getRoverURL() {
  return roverUrlInput.value.trim();
}

function getSpeed() {
  const val = parseInt(speedInput.value);
  return isNaN(val) ? 0 : Math.max(0, Math.min(100, val));
}

function sendControlCommand({ speed, direction = null, turning = null }) {
  const baseUrl = getRoverURL();
  if (!baseUrl) {
    console.warn("No Rover URL set");
    return;
  }

  const fullUrl = baseUrl.replace(/\/+$/, "") + "/drive";

  fetch(fullUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      speed,
      direction,
      turning,
    }),
    keepalive: true, // important!
  }).catch((err) => {
    console.error("Failed to send request:", err);
  });
}

const controlButtons = document.querySelectorAll(".btn");

controlButtons.forEach((btn) => {
  const type = btn.getAttribute("data-type");
  const value = btn.getAttribute("data-value");

  // Skip center dot button (no data-type or value)
  if (!type || !value) return;

  const handlePress = () => {
    const speed = getSpeed();
    const payload = {
      speed,
      direction: type === "direction" ? value : null,
      turning: type === "turning" ? value : null,
    };
    sendControlCommand(payload);
  };

  const handleRelease = () => {
    const speed = getSpeed();
    sendControlCommand({
      speed,
      direction: null,
      turning: null,
    });
  };

    btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    handlePress();
    });

    btn.addEventListener("pointerup", (e) => {
    e.preventDefault();
    handleRelease();
    });


});




// Update stream on input changes
streamUrlInput.addEventListener("change", updateStreamUrl);
streamUrlInput.addEventListener("blur", updateStreamUrl);
streamUrlInput.addEventListener("keyup", (e) => {
  if (e.key === "Enter") updateStreamUrl();
});

// Load stream on first page load
window.addEventListener("DOMContentLoaded", updateStreamUrl);
