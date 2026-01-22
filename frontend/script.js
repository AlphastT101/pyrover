const streamElement = document.getElementById("stream");
const connectionStatus = document.getElementById("connection-status");

let peerConnection = null;
let reconnectTimeout = null;
let isConnecting = false;

function updateConnectionStatus(status) {
  connectionStatus.textContent = status === "connected" ? "●" : "○";
  connectionStatus.className = `status-indicator ${status}`;
}

async function connectWebRTC() {
  if (isConnecting) return;
  
  const baseUrl = getRoverURL();
  if (!baseUrl) {
    console.warn("No Rover URL set");
    updateConnectionStatus("disconnected");
    return;
  }

  isConnecting = true;
  updateConnectionStatus("connecting");

  try {
    // Close existing connection if any
    if (peerConnection) {
      peerConnection.close();
    }

    // Create new peer connection
    peerConnection = new RTCPeerConnection({
      iceServers: [] // No STUN/TURN for local network
    });

    // Add transceiver to receive video - required for aiortc
    peerConnection.addTransceiver('video', { direction: 'recvonly' });

    // Handle incoming stream
    peerConnection.ontrack = (event) => {
      console.log("Received track");
      streamElement.srcObject = event.streams[0];
      updateConnectionStatus("connected");
      isConnecting = false;
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log("Connection state:", peerConnection.connectionState);
      if (peerConnection.connectionState === "failed" || 
          peerConnection.connectionState === "disconnected" ||
          peerConnection.connectionState === "closed") {
        updateConnectionStatus("disconnected");
        isConnecting = false;
        // Attempt reconnection after 2 seconds
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(() => {
          if (peerConnection.connectionState !== "connected") {
            connectWebRTC();
          }
        }, 2000);
      } else if (peerConnection.connectionState === "connected") {
        updateConnectionStatus("connected");
        isConnecting = false;
      }
    };

    // Handle ICE candidates (not needed for local network, but good practice)
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("ICE candidate:", event.candidate);
      }
    };

    // Create offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Send offer to server
    const offerUrl = baseUrl.replace(/\/+$/, "") + "/offer";
    const response = await fetch(offerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sdp: offer.sdp,
        type: offer.type,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const answer = await response.json();
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(answer)
    );

  } catch (error) {
    console.error("WebRTC connection error:", error);
    updateConnectionStatus("disconnected");
    isConnecting = false;
    // Attempt reconnection after 3 seconds
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    reconnectTimeout = setTimeout(() => {
      connectWebRTC();
    }, 3000);
  }
}

function disconnectWebRTC() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (streamElement.srcObject) {
    streamElement.srcObject.getTracks().forEach(track => track.stop());
    streamElement.srcObject = null;
  }
  updateConnectionStatus("disconnected");
  isConnecting = false;
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




// Connect WebRTC when rover URL changes
roverUrlInput.addEventListener("change", () => {
  disconnectWebRTC();
  connectWebRTC();
});
roverUrlInput.addEventListener("blur", () => {
  if (!peerConnection || peerConnection.connectionState !== "connected") {
    connectWebRTC();
  }
});

// Connect on page load
window.addEventListener("DOMContentLoaded", () => {
  // Initialize connection status
  updateConnectionStatus("disconnected");
  // Small delay to ensure DOM is ready
  setTimeout(() => {
    connectWebRTC();
  }, 500);
});

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  disconnectWebRTC();
});
