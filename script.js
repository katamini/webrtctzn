import { joinRoom, selfId } from "https://esm.run/trystero";
import quickLru from 'https://cdn.skypack.dev/quick-lru@6.1.2';
const lru = new quickLru({maxSize: 1000});

var doc = {};

// YouTube player state - module level to be accessible by API callback
let youtubePlayer = null;
let currentVideoId = null;
let isSyncingYouTube = false;
let lastSeekTime = 0;
let seekCheckInterval = null;
let youtubeCallbacks = {}; // Store callbacks from start() function

// YouTube IFrame API ready callback - must be at module level
window.onYouTubeIframeAPIReady = function() {
  console.log('YouTube IFrame API ready');
  
  if (typeof YT === 'undefined' || !YT.Player) {
    console.error('YouTube API not loaded properly');
    return;
  }
  
  youtubePlayer = new YT.Player('youtube-player', {
    height: '100%',
    width: '100%',
    videoId: '', // Start with no video
    playerVars: {
      autoplay: 0,
      controls: 1,
      modestbranding: 1,
      rel: 0,
      fs: 1
    },
    events: {
      onReady: (event) => {
        console.log('YouTube player ready');
        if (youtubeCallbacks.startYouTubeSeekTracking) {
          youtubeCallbacks.startYouTubeSeekTracking();
        }
      },
      onStateChange: (event) => {
        if (youtubeCallbacks.handleYouTubePlayerStateChange) {
          youtubeCallbacks.handleYouTubePlayerStateChange(event);
        }
      }
    }
  });
};

var start = function() {
  const byId = document.getElementById.bind(document);
  const canvas = byId("canvas");
  const whiteboard = byId("whiteboard");
  const ctx = whiteboard.getContext("2d");
  const drawSurface = byId("draw-surface");
  const mainGrid = byId("main-grid");
  const outerHandles = document.querySelectorAll(".resize-layer.outer .resize-handle.col");
  const rowHandles = document.querySelectorAll(".resize-layer.outer .resize-handle.row");
  const videoToggle = byId("video-toggle");
  const videoFeed = byId("video-feed");
  const chatSend = byId("chat-send");
  const audioViz = byId("audio-visualizer");
  const tiles = Array.from(document.querySelectorAll(".tile"));
  const mobileTabs = document.querySelectorAll(".mobile-tab");
  const mobileQuery = window.matchMedia("(max-width: 980px)");
  let isMobile = mobileQuery.matches;
  let activeMobile = "chat";
  const whoList = null;
  const peerAvatar = {};

  const circle = null;
  const chat = byId("chat");
  const chatbox = byId("chatbox");
  const talkbutton = byId("talkbutton");
  const mutebutton = byId("mutebutton");
  const shareButton = byId("share-button");
  const shareScreenButton = byId("share-screen");
  const shareView = byId("shareview");
  const peerGrid = byId("peer-grid");
  var features = { audio: true, video: false };
  
  // Restore video preference from localStorage if available
  const savedVideoPreference = localStorage.getItem("videoPreference");
  if (savedVideoPreference !== null) {
    features.video = savedVideoPreference === "true";
  }

  const getMediaConstraints = () => {
    const baseVideo = {
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 30, max: 30 }
    };
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn && conn.downlink && conn.downlink < 1.5) {
      baseVideo.width = { ideal: 640, max: 1280 };
      baseVideo.height = { ideal: 360, max: 720 };
      baseVideo.frameRate = { ideal: 24, max: 24 };
    }
    return { audio: true, video: features.video ? baseVideo : false };
  };

  document.addEventListener("visibilitychange", function(event) {
    if (sendCmd) {
      sendCmd({ peerId: peerId, cmd: "hand", focus: document.visibilityState });
    }
  });
  
  var userStroke = "#c2c2c2";
  const colorPicker = byId("favcolor");
  colorPicker.addEventListener("change", function(event){
    userStroke = event.target.value;
    closeNav();
  }, false);

  function setWhiteboardSize() {
    if (!drawSurface) return;
    const rect = drawSurface.getBoundingClientRect();
    whiteboard.width = rect.width;
    whiteboard.height = rect.height;
  }
  setWhiteboardSize();

  function resizeAudioViz() {
    if (!audioViz) return;
    audioViz.width = audioViz.clientWidth;
    audioViz.height = audioViz.clientHeight || 90;
  }
  resizeAudioViz();

  function stopAudioViz() {
    if (vizRaf) cancelAnimationFrame(vizRaf);
    vizRaf = null;
    if (vizSource) {
      try { vizSource.disconnect(); } catch (e) {}
    }
    vizSource = null;
    if (audioViz) {
      const ctx = audioViz.getContext("2d");
      ctx.clearRect(0, 0, audioViz.width, audioViz.height);
    }
  }

  function startAudioViz(stream) {
    if (!audioViz || !stream) return;
    stopAudioViz();
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioCtx) audioCtx = new AudioCtx();
    if (audioCtx.state === "suspended") audioCtx.resume();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    vizData = new Uint8Array(analyser.frequencyBinCount);
    vizSource = audioCtx.createMediaStreamSource(stream);
    vizSource.connect(analyser);

    const ctx = audioViz.getContext("2d");
    const bars = 16;
    const draw = () => {
      vizRaf = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(vizData);
      const width = audioViz.width || 1;
      const height = audioViz.height || 1;
      ctx.clearRect(0, 0, width, height);
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, "#777");
      grad.addColorStop(0.5, "#444");
      grad.addColorStop(1, "#111");
      const slice = Math.max(1, Math.floor(vizData.length / bars));
      const barWidth = width / bars;
      for (let i = 0; i < bars; i++) {
        const v = vizData[i * slice] / 255;
        const barHeight = v * height;
        ctx.fillStyle = grad;
        const gap = 2;
        const usableWidth = barWidth - gap;
        ctx.fillRect(i * barWidth + gap / 2, height - barHeight, usableWidth, barHeight);
      }
    };
    draw();
  }

  const defaultColPerc = [25, 25, 25, 25];
  const defaultRowPerc = [60, 40];
  let colPerc = [...defaultColPerc];
  let rowPerc = [...defaultRowPerc];
  const minCol = 10;
  const minRow = 15;
  let expandedTile = null;
  let savedPerc = null;
  let audioCtx = null;
  let analyser = null;
  let vizSource = null;
  let vizData = null;
  let vizRaf = null;
  let restarting = false;

  function applyGrid() {
    if (mainGrid) {
      mainGrid.style.setProperty("--col-1", colPerc[0] + "%");
      mainGrid.style.setProperty("--col-2", colPerc[1] + "%");
      mainGrid.style.setProperty("--col-3", colPerc[2] + "%");
      mainGrid.style.setProperty("--col-4", colPerc[3] + "%");
      mainGrid.style.setProperty("--row-1", rowPerc[0] + "%");
      mainGrid.style.setProperty("--row-2", rowPerc[1] + "%");
    }

    if (outerHandles && outerHandles.length) {
      const totalCols = colPerc.reduce((a, b) => a + b, 0);
      outerHandles.forEach(handle => {
        const idx = Number(handle.dataset.index);
        const acc = colPerc.slice(0, idx + 1).reduce((a, b) => a + b, 0);
        handle.style.left = (acc / totalCols) * 100 + "%";
      });
    }

  if (rowHandles && rowHandles.length) {
    const totalRows = rowPerc.reduce((a, b) => a + b, 0);
    rowHandles.forEach(handle => {
      const idx = Number(handle.dataset.index);
      const rowAcc = rowPerc.slice(0, idx + 1).reduce((a, b) => a + b, 0);
      handle.style.top = (rowAcc / totalRows) * 100 + "%";
    });
  }
}
applyGrid();

  function setMobileActive(target) {
    if (!isMobile) return;
    if (!target) target = activeMobile || "chat";
    activeMobile = target;
    tiles.forEach(tile => {
      if (tile.dataset.tile === target) tile.classList.add("mobile-active");
      else tile.classList.remove("mobile-active");
    });
    mobileTabs.forEach(tab => {
      tab.classList.toggle("active", tab.dataset.target === target);
    });
  }

  if (isMobile) {
    setMobileActive(activeMobile);
  }

  mobileQuery.addEventListener("change", e => {
    isMobile = e.matches;
    if (isMobile) {
      setMobileActive(activeMobile || "chat");
    } else {
      tiles.forEach(tile => tile.classList.remove("mobile-active"));
      mobileTabs.forEach(tab => tab.classList.remove("active"));
    }
  });

  mobileTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      activeMobile = tab.dataset.target;
      setMobileActive(activeMobile);
    });
  });

  function expandTile(tile) {
    if (isMobile) {
      if (tile && tile.dataset.tile) {
        setMobileActive(tile.dataset.tile);
      }
      return;
    }
    if (!tile) return;
    const tiles = Array.from(document.querySelectorAll(".tile"));
    const idx = tiles.indexOf(tile);
    if (idx === -1) return;
    const colIdx = idx % 4;
    const rowIdx = Math.floor(idx / 4);

    if (expandedTile === tile && savedPerc) {
      colPerc = [...savedPerc.col];
      rowPerc = [...savedPerc.row];
      expandedTile = null;
      savedPerc = null;
      applyGrid();
      setWhiteboardSize();
      resizeAudioViz();
      return;
    }

    savedPerc = { col: [...colPerc], row: [...rowPerc] };
    expandedTile = tile;

    const small = 15;
    const large = 55;
    colPerc = [small, small, small, small];
    colPerc[colIdx] = large;
    const colTotal = colPerc.reduce((a, b) => a + b, 0);
    colPerc = colPerc.map(v => (v / colTotal) * 100);

    if (rowIdx === 0) {
      rowPerc = [75, 25];
    } else {
      rowPerc = [25, 75];
    }

    applyGrid();
    setWhiteboardSize();
    resizeAudioViz();
  }

  function bindResize(handle) {
    const idx = Number(handle.dataset.index);
    const isCol = handle.classList.contains("col");
    handle.addEventListener("pointerdown", e => {
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const startCols = [...colPerc];
      const startRows = [...rowPerc];
      const gridWidth = mainGrid ? mainGrid.clientWidth : window.innerWidth;
      const gridHeight = mainGrid ? mainGrid.clientHeight : window.innerHeight;
      function onMove(evt) {
        if (isCol) {
          const deltaPx = evt.clientX - startX;
          const deltaPercent = (deltaPx / gridWidth) * 100;
          let a = startCols[idx] + deltaPercent;
          let b = startCols[idx + 1] - deltaPercent;
          if (a < minCol) { b -= minCol - a; a = minCol; }
          if (b < minCol) { a -= minCol - b; b = minCol; }
          colPerc[idx] = a;
          colPerc[idx + 1] = b;
        } else {
          const deltaPx = evt.clientY - startY;
          const deltaPercent = (deltaPx / gridHeight) * 100;
          let a = startRows[idx] + deltaPercent;
          let b = startRows[idx + 1] - deltaPercent;
          if (a < minRow) { b -= minRow - a; a = minRow; }
          if (b < minRow) { a -= minRow - b; b = minRow; }
          rowPerc[idx] = a;
          rowPerc[idx + 1] = b;
        }
        const colTotal = colPerc.reduce((p, c) => p + c, 0);
        const rowTotal = rowPerc.reduce((p, c) => p + c, 0);
        const colScale = 100 / colTotal;
        const rowScale = 100 / rowTotal;
        colPerc = colPerc.map(v => v * colScale);
        rowPerc = rowPerc.map(v => v * rowScale);
        applyGrid();
        setWhiteboardSize();
        resizeAudioViz();
      }
      function onUp() {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      }
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  }

  outerHandles.forEach(bindResize);
  rowHandles.forEach(bindResize);
  window.addEventListener("resize", () => {
    applyGrid();
    setWhiteboardSize();
    resizeAudioViz();
  });
  document.querySelectorAll(".tile-head").forEach(head => {
    head.addEventListener("dblclick", e => {
      e.preventDefault();
      e.stopPropagation();
      const tile = head.closest(".tile");
      expandTile(tile);
    });
    head.addEventListener("click", () => {
      if (!isMobile) return;
      const tile = head.closest(".tile");
      if (tile && tile.dataset.tile) {
        setMobileActive(tile.dataset.tile);
      }
    });
  });

  //const peerInfo = byId("peer-info");
  //const noPeersCopy = peerInfo.innerText;
  const config = { appId: "ctzn-glitch" };
  const cursors = {};
  const roomCap = 33;
  const avatars = [
    "static/avatars/avatar_1.png",
    "static/avatars/avatar_2.png",
    "static/avatars/avatar_3.png",
    "static/avatars/avatar_4.png",
    "static/avatars/avatar_5.png",
    "static/avatars/avatar_6.png",
    "static/avatars/avatar_7.png",
    "static/avatars/avatar_8.png",
    "static/avatars/avatar_9.png",
    "static/avatars/avatar_10.png"
  ];
  const peerAvatar = {};

  let mouseX = 0;
  let mouseY = 0;
  let room;
  let rooms;
  let sendMove;
  let sendChat;
  let sendPeer;
  let sendCmd;
  let sendPic;
  let sendYouTubeAction;

  const peerAlias = {};

  var streams = [];
  var screens = [];
  // sidepeer for calls only
  var peerId = selfId + "_call";
  var userName = false;
  var roomName = false;
  var userAvatar = null; // User's selected avatar

  // Stream health monitoring variables - declared before init()
  let healthCheckInterval = null;
  let peerHealthStatus = {};

  // Room Selector
  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);
  if (urlParams.has("room")) {
    roomName = urlParams.get("room");
    init(roomName);
  } else {
    // No room specified - prompt user for room name
    // getRoomName() will redirect page with room parameter, so we exit early
    // to prevent errors from using undefined roomName in URL formatting below
    getRoomName();
    return; // Exit early - getRoomName will redirect the page
  }
  // URL parameters override localStorage preferences
  if (urlParams.has("video")) {
    features.video = true;
    talkbutton.innerHTML =
      '<i class="fa fa-video fa-2x" aria-hidden="true"></i>';
  }
  if (urlParams.has("audio")) {
    features.video = false;
    talkbutton.innerHTML =
      '<i class="fa fa-phone fa-2x" aria-hidden="true"></i>';
  }
  // Update button icon based on current video preference
  if (!urlParams.has("video") && !urlParams.has("audio") && features.video) {
    talkbutton.innerHTML =
      '<i class="fa fa-video fa-2x" aria-hidden="true"></i>';
  }

  if (urlParams.has("username")) {
    userName = urlParams.get("username");
    //console.log("set localstorage");
    localStorage.setItem("username", userName);
  } else {
    if (localStorage.getItem("username")) {
      userName = localStorage.getItem("username");
    } else {
      //userName = prompt("Whats your name, stranger?") || selfId;
      getUserName();
      //localStorage.setItem("username", userName);
    }
  }
  
  // Load user's avatar from localStorage
  userAvatar = localStorage.getItem("userAvatar");
  if (!userAvatar && avatars.length > 0) {
    // Default to first avatar if none selected
    userAvatar = avatars[0];
    localStorage.setItem("userAvatar", userAvatar);
  }

  // Store room name in localStorage for reconnection
  localStorage.setItem("lastRoom", roomName);

  // reformat URL for easy sharing
  var refresh =
      window.location.protocol +
      "//" +
      window.location.host +
      window.location.pathname +
      "?room=" +
      roomName;
  window.history.pushState({ path: refresh }, "", refresh);
  
  
  // focus on chat input all the time
  var focus = function() {
    document.getElementById("chatbox").focus();
  };
  focus();
  window.addEventListener("focus", focus);

  document.documentElement.className = "ready";
  addCursor(selfId, true);

  var isDrawing = false;
  var plots = [];
  function getDrawPoint(evt) {
    if (!drawSurface) return false;
    const rect = drawSurface.getBoundingClientRect();
    const point = evt.touches ? evt.touches[0] : evt;
    return {
      x: (point.clientX - rect.left) / rect.width,
      y: (point.clientY - rect.top) / rect.height
    };
  }

  function endDraw() {
    if (!isDrawing) return;
    isDrawing = false;
    if (sendCmd && plots.length) {
      sendCmd({ peerId: selfId, cmd: "draw", plots: plots, color: userStroke });
    }
    plots = [];
  }

  function moveDraw(evt) {
    if (evt.touches && evt.cancelable) evt.preventDefault();
    if (!isDrawing) return;
    const point = getDrawPoint(evt);
    if (!point) return;
    if (plots.length > 50) {
      if (sendCmd) {
        sendCmd({ peerId: selfId, cmd: "draw", plots: plots, color: userStroke });
      }
      plots = [];
    }
    plots.push(point);
    drawOnCanvas(userStroke, plots, true);
  }

  function startDraw(evt) {
    if (evt.touches && evt.cancelable) evt.preventDefault();
    isDrawing = true;
    plots = [];
    const point = getDrawPoint(evt);
    if (point) plots.push(point);
  }

  if (drawSurface) {
    drawSurface.addEventListener("mousedown", startDraw);
    drawSurface.addEventListener("mousemove", moveDraw);
    drawSurface.addEventListener("mouseleave", endDraw);
    drawSurface.addEventListener("touchstart", startDraw, { passive: false });
    drawSurface.addEventListener("touchmove", moveDraw, { passive: false });
    drawSurface.addEventListener("touchend", endDraw);
  }

  window.addEventListener("mouseup", endDraw);

  window.addEventListener("mousemove", ({ clientX, clientY }) => {
    mouseX = clientX / window.innerWidth;
    mouseY = clientY / window.innerHeight;
    moveCursor([mouseX, mouseY], selfId);
    if (room) {
      sendMove([mouseX, mouseY]);
    }
  });
  

  window.chat = function(msg) {
    if (!msg || msg.length < 1) return;
    updateChat({ msg: msg, username: userName }, selfId);
    if (room) sendChat({ msg: msg, username: userName });
    return;
  };
  chatbox.addEventListener("keypress", function(e) {
    if (e.keyCode == 13) {
      window.chat(chatbox.value);
      chatbox.value = "";
      return false;
    }
  });
  if (chatSend) {
    chatSend.addEventListener("click", () => {
      window.chat(chatbox.value);
      chatbox.value = "";
    });
  }

  var streaming = false;
  var muted = false;
  const storedVideoPref = localStorage.getItem("videoPreference");
  if (storedVideoPref !== null) {
    features.video = storedVideoPref === "true";
  }
  
  // Helper function to start streaming with common setup
  async function startStreaming(autoReconnect = false) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints());
      room.addStream(stream);
      handleStream(stream, selfId);
      streaming = stream;
      startAudioViz(stream);
      monitorStreamHealth(stream, 'media');
      muted = false;
      // Hide avatar when streaming starts
      const selfAvatar = byId("avatar_" + selfId);
      if (selfAvatar && features.video) selfAvatar.style.display = "none";
      talkbutton.innerHTML = !features.video
        ? '<i class="fa fa-phone fa-2x" aria-hidden="true" style="color:white;"></i>'
        : '<i class="fa fa-video fa-2x" aria-hidden="true" style="color:white;"></i>';
      talkbutton.style.background = "red";
      // Save streaming state for auto-reconnect
      localStorage.setItem("wasStreaming", "true");
      // notify network
      if (sendCmd) {
        sendCmd({ peerId: peerId, cmd: "hand", state: true });
      }
      mutebutton.disabled = false;
      
      if (autoReconnect) {
        console.log("Auto-reconnection successful");
        notifyMe("Automatically reconnected to your previous call");
      }
      return true;
    } catch (error) {
      console.error('Failed to get user media:', error);
      if (autoReconnect) {
        // Clear the flag if auto-reconnect fails
        localStorage.removeItem("wasStreaming");
      } else {
        notifyMe('Failed to access microphone/camera. Please check permissions.');
      }
      return false;
    }
  }
  
  const updateVideoToggle = () => {
    if (!videoToggle) return;
    videoToggle.innerText = features.video ? "Video on" : "Enable video";
    videoToggle.title = features.video ? "Video enabled" : "Audio-only by default";
    videoToggle.classList.toggle("active", !!features.video);
  };
  updateVideoToggle();

  async function restartStreamingForToggle() {
    if (!streaming) return;
    const wasMuted = muted;
    room.removeStream(streaming);
    streaming.getTracks().forEach(track => track.stop());
    streaming = null;
    await startStreaming(false);
    if (streaming && wasMuted) {
      streaming.getAudioTracks().forEach(track => track.enabled = false);
      mutebutton.innerHTML =
        '<i class="fa fa-microphone-slash fa-2x" aria-hidden="true"></i>';
      muted = true;
    }
  }

  if (videoToggle) {
    videoToggle.addEventListener("click", () => {
      features.video = !features.video;
      // Save video preference to localStorage
      localStorage.setItem("videoPreference", features.video.toString());
      updateVideoToggle();
      if (streaming) {
        restartStreamingForToggle();
      }
    });
  }

  talkbutton.addEventListener("click", async () => {
    //console.log("call button");
    if (!streaming) {
      await startStreaming(false);
    } else {
      room.removeStream(streaming);
      var tracks = streaming.getTracks();
      tracks.forEach(function(track) {
        track.stop();
      });
      var el = byId("vid_" + selfId);
      if (el) el.srcObject = null;
      streaming = null;
      // Clear streaming state - user manually disconnected
      localStorage.removeItem("wasStreaming");
      // Show avatar when streaming stops
      const selfAvatar = byId("avatar_" + selfId);
      if (selfAvatar) selfAvatar.style.display = "flex";
      // reset mute
      mutebutton.innerHTML =
        '<i class="fa fa-microphone fa-2x" aria-hidden="true"></i>';
      muted = false;
      // reset call button
      talkbutton.innerHTML = !features.video
        ? '<i class="fa fa-phone fa-2x" aria-hidden="true" style="color:green;"></i>'
        : '<i class="fa fa-video fa-2x" aria-hidden="true"></i>';
      talkbutton.style.background = "";
      stopAudioViz();
      // notify network
      if (sendCmd) {
        sendCmd({ peerId: peerId, cmd: "stop_video" });
        sendCmd({ peerId: peerId, cmd: "hand", state: false });
      }
    }
    mutebutton.disabled = streaming ? false : true;
  });

  mutebutton.addEventListener("click", async () => {
    if (!streaming) return;
    var state = streaming.getAudioTracks()[0].enabled;
    if (!muted) {
      mutebutton.innerHTML =
        '<i class="fa fa-microphone-slash fa-2x" aria-hidden="true"></i>';
      muted = true;
      streaming.getAudioTracks()[0].enabled = false;
    } else {
      mutebutton.innerHTML =
        '<i class="fa fa-microphone fa-2x" aria-hidden="true"></i>';
      muted = false;
      streaming.getAudioTracks()[0].enabled = true;
    }
  });

  
  async function init(n) {
    const ns = "room" + n;
    const members = 1;

  let getMove;
  let getChat;
  let getPeer;
  let getCmd;
  let getPic;
  let getYouTubeAction;

    if (members === roomCap) {
      return init(n + 1);
    }

    room = joinRoom(config, ns);
    window.room = room;
    window.roomId = n;
    window.self = selfId;
    [sendMove, getMove] = room.makeAction("mouseMove");
    [sendChat, getChat] = room.makeAction("chat");
    [sendCmd, getCmd] = room.makeAction("cmd");
    [sendPic, getPic] = room.makeAction("pic");
    [sendYouTubeAction, getYouTubeAction] = room.makeAction("youtube");

    byId("room-num").innerText = "#" + n;
    room.onPeerJoin(joiningPeerId => {
      console.log('Peer joined:', joiningPeerId);
      addCursor(joiningPeerId);
      
      // Send username immediately to new peer
      if (userName && sendCmd) {
        sendCmd({ peerId: selfId, cmd: "username", username: userName }, joiningPeerId);
      }
      
      // Send existing stream to new peer (Trystero best practice)
      // Call addStream directly without delay - Trystero handles connection setup
      if (streaming) {
        console.log('Sending media stream to new peer:', joiningPeerId);
        room.addStream(streaming, joiningPeerId);
        // Also send the hand command to indicate streaming state
        if (sendCmd) {
          sendCmd({ peerId: peerId, cmd: "hand", state: true }, joiningPeerId);
        }
      }
      
      // Send screenshare to new peer if active
      if (screenSharing) {
        console.log('Sending screen share to new peer:', joiningPeerId);
        room.addStream(screenSharing, joiningPeerId);
        if (sendCmd) {
          sendCmd({
            peerId: selfId + "_screen",
            cmd: "screenshare",
            stream: screenSharing.id
          }, joiningPeerId);
        }
      }
      
      // Send YouTube video state to new peer
      if (currentVideoId && youtubePlayer && sendYouTubeAction) {
        try {
          const currentTime = youtubePlayer.getCurrentTime();
          const playerState = youtubePlayer.getPlayerState();
          
          sendYouTubeAction({
            action: 'videoLoad',
            videoId: currentVideoId,
            time: currentTime,
            state: playerState
          }, joiningPeerId);
        } catch (e) {
          console.log('Could not send YouTube state to new peer:', e);
        }
      }
    });
    room.onPeerLeave(removeCursor);
    room.onPeerStream(handleStream);
    getMove(moveCursor);
    getChat(updateChat);
    getCmd(handleCmd);
    getPic(handlePic);
    getYouTubeAction(handleYouTubeAction);

    // mappings
    window.ctl = { sendCmd: sendCmd, sendPic: sendPic, peerId: selfId };
    
    // Setup stream health monitoring and keepalive
    setupStreamHealthMonitoring();
    
    // Initialize YouTube player
    initYouTubePlayer();
    
    // Auto-reconnect if user was previously streaming
    // Delay ensures room, actions, and handlers are fully initialized
    setTimeout(() => {
      attemptAutoReconnect();
    }, 500);
  }
  
  // Auto-reconnect function to restore previous streaming state
  async function attemptAutoReconnect() {
    const wasStreaming = localStorage.getItem("wasStreaming");
    const lastRoom = localStorage.getItem("lastRoom");
    
    // Only auto-reconnect if:
    // 1. User was streaming in their last session
    // 2. They're rejoining the same room
    // 3. They're not already streaming
    if (wasStreaming === "true" && lastRoom === roomName && !streaming) {
      console.log("Auto-reconnecting to previous stream...");
      await startStreaming(true);
    }
  }
  
  function setupStreamHealthMonitoring() {
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
    }
    
    // Only setup monitoring if room has ping capability
    if (!room || typeof room.ping !== 'function') {
      console.log('Room ping not available, skipping health monitoring');
      return;
    }
    
    // Monitor connection health every 30 seconds
    healthCheckInterval = setInterval(async () => {
      if (!room) return;
      
      const peers = room.getPeers();
      for (const peerId of peers) {
        try {
          const latency = await room.ping(peerId);
          
          // Track peer health
          if (!peerHealthStatus[peerId]) {
            peerHealthStatus[peerId] = { failures: 0, lastSuccess: Date.now() };
          }
          
          if (latency > 0) {
            // Successful ping
            peerHealthStatus[peerId].failures = 0;
            peerHealthStatus[peerId].lastSuccess = Date.now();
          } else {
            // Failed ping
            peerHealthStatus[peerId].failures++;
          }
          
          // If connection is degraded, try to reinitialize stream
          if (peerHealthStatus[peerId].failures >= 3 && streaming) {
            console.log(`Connection to peer ${peerId} degraded, reinitializing stream...`);
            try {
              // Re-add stream to this specific peer
              room.addStream(streaming, peerId);
              peerHealthStatus[peerId].failures = 0;
            } catch (error) {
              console.error(`Failed to reinitialize stream for peer ${peerId}:`, error);
            }
          }
        } catch (error) {
          console.error(`Health check failed for peer ${peerId}:`, error);
          if (!peerHealthStatus[peerId]) {
            peerHealthStatus[peerId] = { failures: 0, lastSuccess: Date.now() };
          }
          peerHealthStatus[peerId].failures++;
        }
      }
      
      // Clean up health status for peers that left
      Object.keys(peerHealthStatus).forEach(peerId => {
        if (!peers.includes(peerId)) {
          delete peerHealthStatus[peerId];
        }
      });
    }, 30000); // Check every 30 seconds
  }
  
  // Monitor for stream errors and attempt recovery
  function monitorStreamHealth(stream, streamType = 'media') {
    if (!stream) return;
    
    stream.getTracks().forEach(track => {
      track.addEventListener('ended', () => {
        console.log(`${streamType} track ended unexpectedly, attempting recovery...`);
        if (streaming && streamType === 'media') {
          // Attempt to recover the stream
          handleStreamError();
        }
      });
      
      track.addEventListener('mute', () => {
        console.log(`${streamType} track muted unexpectedly`);
      });
    });
  }
  
  // Handle stream errors with auto-recovery
  async function handleStreamError() {
    if (!streaming) return;
    
    console.log('Attempting to recover media stream...');
    
    try {
      // Try to get a new stream
      const newStream = await navigator.mediaDevices.getUserMedia(features);
      
      // Remove old stream
      room.removeStream(streaming);
      const oldTracks = streaming.getTracks();
      oldTracks.forEach(track => track.stop());
      
      // Add new stream
      room.addStream(newStream);
      handleStream(newStream, selfId);
      streaming = newStream;
      startAudioViz(newStream);
      monitorStreamHealth(newStream, 'media');
      
      console.log('Media stream recovered successfully');
    } catch (error) {
      console.error('Failed to recover media stream:', error);
      // Notify user of the failure
      notifyMe('Connection lost. Please rejoin the call.');
    }
  }
  
  // EXPERIMENTAL ROOM INDEXING!
  async function allrooms(n) {
    const ns = "rooms";
    rooms = joinRoom({ appId: "ctzn-glitch-index" }, ns);
    window.rooms = rooms;
    rooms.onPeerJoin(addRooms);
    rooms.onPeerLeave(removeRooms);
  }
  function addRooms(id, isSelf){
    console.log('new room created', id);
    // add div
  }
  function removeRooms(id){
    console.log('room destroyed', id)
    // remove div
  }
  

  // binary pic handler
  function handlePic(data, id, meta) {
    if (id == selfId) return;
    //console.log("got imagery", id, meta);
    var img = document.createElement("img");
    img.src = URL.createObjectURL(new Blob([data]));
    img.onload = function() {
      //console.log("img.src", img.src);
      ctx.drawImage(
        img,
        meta.pos.x * window.innerWidth,
        meta.pos.y * window.innerHeight
      );
    };
  }
  // command handler
  function handleCmd(data, id) {
    if (id == selfId) return;
    //console.log("got cmd", data, id);
    if (data) {
      if (data.cmd == "stop_video" && data.peerId) {
        var el = byId("vid_" + id);
        if (el) el.srcObject = null;
        const av = byId("avatar_" + id);
        if (av) av.style.display = "flex";
        // which one is it? :)
        el = byId("vid_" + peerId);
        if (el) el.srcObject = null;
        const av2 = byId("avatar_" + peerId);
        if (av2) av2.style.display = "flex";
      } else if (data.cmd == "hand") {
        if (data.focus) {
          // handle focus
          var el = byId("cursor_" + id);
          if (el) {
            if (data.focus == "hidden") el.classList.add("handoff");
            else el.classList.remove("handoff");
          }
        } else {
          // handle state
          var el = byId("hand_" + id);
          if (el) {
            if (data.state) el.classList.add("handgreen");
            else el.classList.remove("handgreen");
          }
        }
      } else if (data.cmd == "username" && data.username) {
        var label = byId("label_" + id);
        if (label) label.innerText = data.username;
      } else if (data.cmd == "img" && data) {
        //console.log("got image", data);
        //displayImageOnCanvas(data.img, data.pos);
      } else if (data.cmd == "draw" && data.plots) {
        if (data.plots && data.color) drawOnCanvas(data.color, data.plots);
      } else if (data.cmd == "clear") {
        if (whiteboard) whiteboard.width = whiteboard.width;
      } else if (data.cmd == "screenshare") {
        //console.log("remote screenshare session incoming", data);
        shareScreenButton.disabled = true;
        screens[data.stream] = true;
      } else if (data.cmd == "stop_screenshare") {
        //console.log("remote screenshare session stop", data);
        shareScreenButton.disabled = false;
        screens[data.stream] = false;
        shareView.srcObject = null;
      }

      // whiteboard.width = whiteboard.width;
    }
  }

  function handleStream(stream, peerId, meta) {
    //console.log('got stream!', peerId, stream)
    if (stream && screens[stream.id]) {
      // screensharing payload
      var el = shareView;
      setTimeout(function() {
        el.setAttribute("autoplay", true);
        el.setAttribute("inline", true);
        //el.setAttribute("height", 240);
        el.setAttribute("width", "100%");
        el.srcObject = stream;
      }, 200);
    } else {
      // videocall payload
      //console.log("handling stream", stream, peerId);
      if (peerId == selfId) {
        var selfStream = stream;
        stream = new MediaStream(selfStream.getVideoTracks());
      }
      var el = byId("vid_" + peerId);
      if (!el) console.error("target video frame not found!", peerId);
      //console.log('received stream', stream, peerId, el);
      setTimeout(function() {
        el.setAttribute("autoplay", true);
        el.setAttribute("inline", true);
        el.setAttribute("height", 240);
        el.setAttribute("width", 480);
        el.srcObject = stream;
        const av = byId("avatar_" + peerId);
        // Hide avatar when stream is active, show when stream stops
        if (av) av.style.display = stream && stream.getVideoTracks().length > 0 ? "none" : "flex";
      }, 200);
    }
  }

  function moveCursor([x, y], id) {
    const el = cursors[id];

    if (el) {
      el.style.left = x * window.innerWidth + "px";
      el.style.top = y * window.innerHeight + "px";
    }
  }

  function addCursor(id, isSelf) {
    const el = document.createElement("div");
    el.id = "cursor_" + id;
    const img = document.createElement("img");
    img.id = "hand_" + id;
    const video = document.createElement("video");
    video.id = "vid_" + id;
    video.playsInline = true;
    video.muted = isSelf ? true : false;

    el.style.float = "left";
    el.className = `cursor${isSelf ? " self" : ""}`;
    el.style.left = el.style.top = "-99px";
    img.src = "static/hand.png";
    el.appendChild(img);
    if (isSelf) {
      img.style.display = "none";
    }
    canvas.appendChild(el);
    cursors[id] = el;

    if (videoFeed) {
      const frame = document.createElement("div");
      frame.className = "video-frame";
      frame.id = "frame_" + id;
      const avatarWrap = document.createElement("div");
      avatarWrap.className = "video-avatar";
      const avatarImg = document.createElement("img");
      // Use stored avatar for self, random for others
      const pick = isSelf && userAvatar ? userAvatar : avatars[Math.floor(Math.random() * avatars.length)];
      peerAvatar[id] = pick;
      avatarImg.src = pick;
      avatarWrap.appendChild(avatarImg);
      const label = document.createElement("div");
      label.className = "video-label";
      label.id = "label_" + id;
      label.innerText = isSelf ? (userName || "you") : id.slice(0, 8);
      avatarWrap.id = "avatar_" + id;
      frame.appendChild(avatarWrap);
      frame.appendChild(video);
      frame.appendChild(label);
      videoFeed.appendChild(frame);
    }

    if (!isSelf) {
      updatePeerInfo();
    }

    if (userName && sendCmd) {
      sendCmd({ peerId: selfId, cmd: "username", username: userName });
      const selfLabel = byId("label_" + selfId);
      if (selfLabel) selfLabel.innerText = userName;
    }

    // are we sharing?
    if (screenSharing){
       console.log('wea re still screensharing!',screenSharing.id)
       if (sendCmd) {
         sendCmd({
           peerId: selfId + "_screen",
           cmd: "screenshare",
           stream: screenSharing.id
         });
       }
    }

    return el;
  }

  function removeCursor(id) {
    console.log('Peer left:', id);
    if (cursors[id]) {
      canvas.removeChild(cursors[id]);
      delete cursors[id];
    }
    const vid = byId("vid_" + id);
    if (vid && vid.parentNode) {
      vid.parentNode.removeChild(vid);
    }
    const av = byId("avatar_" + id);
    if (av && av.parentNode) av.parentNode.removeChild(av);
    if (streams[id]) {
      room.removeStream(streams[id], id);
      delete streams[id];
    }
    
    // Clean up peer health tracking
    if (peerHealthStatus[id]) {
      delete peerHealthStatus[id];
    }

    const frame = byId("frame_" + id);
    if (frame && frame.parentNode) {
      frame.parentNode.removeChild(frame);
    }

    updatePeerInfo();
  }

  function updatePeerInfo() {
    const count = room.getPeers().length;
    byId("room-num").innerText = "#" + window.roomId + ` (${count})`;
    if (userName && sendCmd) {
      sendCmd({ peerId: selfId, cmd: "username", username: userName });
    }
    /*
    peerInfo.innerHTML = count
      ? `Right now <em>${count}</em> other peer${
          count === 1 ? " is" : "s are"
        } connected with you. Send them some fruit.`
      : noPeersCopy;
    */
  }

  function updateChat(data, id) {
    var msg = data.msg;
    var user = data.username || id;

    if (isValidHttpUrl(msg) && id != selfId) {
      //var open = window.confirm(user + " is sharing a url. Trust it?");
      //if (open) {
      //console.log("opening remote link.");
      window.open(msg, "_blank");
      chat.innerHTML =
        user +
        ": <a href='" +
        msg +
        "' target='_blank' style='color:blue;'>" +
        msg +
        "</a><br/>" +
        chat.innerHTML;
      //}
    } else {
      chat.innerHTML = user + ": " + msg + "<br/>" + chat.innerHTML;
    }
  }

  function isValidHttpUrl(string) {
    let url;
    try {
      url = new URL(string);
    } catch (_) {
      return false;
    }
    return url.protocol === "http:" || url.protocol === "https:";
  }

  /* globals for compatibility */

  window.clearCanvas = function() {
    if (whiteboard) whiteboard.width = whiteboard.width;
    if (sendCmd) {
      sendCmd({ peerId: selfId, cmd: "clear" });
    }
  };

  window.shareUrl = function() {
    if (!window.getSelection) {
      alert("Clipboard not available, sorry!");
      return;
    }
    const dummy = document.createElement("p");
    dummy.textContent = window.location.href;
    document.body.appendChild(dummy);

    const range = document.createRange();
    range.setStartBefore(dummy);
    range.setEndAfter(dummy);

    const selection = window.getSelection();
    // First clear, in case the user already selected some other text
    selection.removeAllRanges();
    selection.addRange(range);

    document.execCommand("copy");
    document.body.removeChild(dummy);

    notifyMe("link shared to clipboard");
    if (shareButton) {
      shareButton.innerHTML =
        '<i class="fa fa-share-alt-square fa-1x" aria-hidden="true"></i><span>Copied</span>';
      setTimeout(function() {
        shareButton.innerHTML =
          '<i class="fa fa-share-alt fa-1x" aria-hidden="true"></i><span>Copy link</span>';
      }, 1000);
    }
    
  };
  
  function notifyMe(msg) {
    // Let's check if the browser supports notifications
    if (!("Notification" in window)) {
      alert(msg);
    }

    // Let's check whether notification permissions have already been granted
    else if (Notification.permission === "granted") {
      // If it's okay let's create a notification
      var notification = new Notification(msg);
    }

    // Otherwise, we need to ask the user for permission
    else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(function(permission) {
        // If the user accepts, let's create a notification
        if (permission === "granted") {
          var notification = new Notification(msg);
        }
      });
    }

    // At last, if the user has denied notifications, and you
    // want to be respectful there is no need to bother them any more.
  }

  function drawOnCanvas(color, plots, local) {
    // x * window.innerWidth
    if (!plots[0]) return;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.moveTo(plots[0].x * whiteboard.width, plots[0].y * whiteboard.height);
    for (var i = 1; i < plots.length; i++) {
      fadeOutCanvas();
      ctx.lineTo(
        plots[i].x * whiteboard.width,
        plots[i].y * whiteboard.height
      );
    }
    ctx.stroke();
  }

  
  function fadeOutCanvas() {
    ctx.fillStyle = "rgba(255,255,255,0.02)";
    ctx.fillRect(0, 0, whiteboard.width, whiteboard.height);
  }

  var screenSharing = false;
  window.shareScreen = async function() {
    if (!screenSharing) {
      try {
        var stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          frameRate: 5
        });
        
        // Monitor screen share track for when user stops sharing
        stream.getTracks()[0].addEventListener('ended', () => {
          console.log('Screen share ended by user');
          if (screenSharing) {
            // Clean up when user clicks "Stop sharing" in browser UI
            if (sendCmd) {
              sendCmd({
                peerId: peerId,
                cmd: "stop_screenshare",
                stream: screenSharing.id
              });
            }
            room.removeStream(screenSharing);
            shareScreenButton.classList.remove("blinking");
            shareView.srcObject = null;
            screenSharing = false;
          }
        });
        
        if (sendCmd) {
          sendCmd({
            peerId: selfId + "_screen",
            cmd: "screenshare",
            stream: stream.id
          });
        }
        room.addStream(stream);
        shareScreenButton.classList.add("blinking");
        screenSharing = stream;
        shareView.srcObject = screenSharing;
      } catch (error) {
        console.error('Failed to start screen sharing:', error);
        notifyMe('Failed to start screen sharing. Please try again.');
      }
    } else {
      if (sendCmd) {
        sendCmd({
          peerId: peerId,
          cmd: "stop_screenshare",
          stream: screenSharing.id
        });
      }
      room.removeStream(screenSharing);
      var tracks = screenSharing.getTracks();
      tracks.forEach(function(track) {
        track.stop();
      });
      //var el = byId("vid_" + selfId);
      //el.srcObject = null;
      shareScreenButton.classList.remove("blinking");
      shareView.srcObject = null;
      screenSharing = false;
    }
  };

  // Unified setup function for first-time users (username, room, avatar)
  function getUserSetup() {
    // Get saved values for pre-filling
    const savedUsername = localStorage.getItem("username") || "";
    const savedRoom = localStorage.getItem("lastRoom") || "";
    const savedAvatar = localStorage.getItem("userAvatar") || "";
    
    // Build avatar selection HTML
    const avatarGrid = avatars.map((avatar, index) => {
      const avatarNum = index + 1;
      const isSelected = savedAvatar === avatar ? 'border-color: #3085d6;' : 'border-color: #ddd;';
      return `
        <div class="avatar-card" data-avatar="${avatar}" style="cursor: pointer; border: 2px solid #ddd; border-radius: 8px; padding: 8px; transition: border-color 0.3s; ${isSelected}">
          <img src="${avatar}" alt="Avatar ${avatarNum}" style="width: 128px; height: 128px; display: block; border-radius: 4px;">
          <p style="margin-top: 5px; font-size: 12px; text-align: center;">${avatarNum}</p>
        </div>
      `;
    }).join('');
    
    Swal.fire({
      title: 'Join Room',
      html: `
        <div style="text-align: left;">
          <label for="username" style="display: block; margin-bottom: 5px; font-weight: bold;">Name:</label>
          <input type="text" id="username" class="swal2-input" placeholder="Enter your username" value="${savedUsername}" style="margin-top: 0;">
          
          <label for="roomname" style="display: block; margin-bottom: 5px; margin-top: 15px; font-weight: bold;">Room Name:</label>
          <input type="text" id="roomname" class="swal2-input" placeholder="Enter room name" value="${savedRoom}" style="margin-top: 0;">
          
          <label style="display: block; margin-bottom: 10px; margin-top: 15px; font-weight: bold;">Choose an Avatar:</label>
          <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; max-height: 300px; overflow-y: auto; padding: 5px;">
            ${avatarGrid}
          </div>
          <input type="hidden" id="selectedAvatar" value="${savedAvatar}">
        </div>
      `,
      width: '600px',
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Join',
      cancelButtonText: 'Cancel',
      didOpen: () => {
        // Add click handlers for avatar cards
        const cards = document.querySelectorAll('.avatar-card');
        cards.forEach(card => {
          card.addEventListener('click', function() {
            // Remove selection from all cards
            cards.forEach(c => c.style.borderColor = '#ddd');
            // Add selection to clicked card
            this.style.borderColor = '#3085d6';
            // Store selected value
            document.getElementById('selectedAvatar').value = this.dataset.avatar;
          });
        });
      },
      preConfirm: () => {
        const username = document.getElementById('username').value.trim();
        const roomname = document.getElementById('roomname').value.trim();
        const selectedAvatar = document.getElementById('selectedAvatar').value;
        
        if (!username) {
          Swal.showValidationMessage('Please enter a username');
          return false;
        }
        
        if (!roomname) {
          Swal.showValidationMessage('Please enter a room name');
          return false;
        }
        
        if (!selectedAvatar) {
          Swal.showValidationMessage('Please select an avatar');
          return false;
        }
        
        return { username, roomname, selectedAvatar };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        // Store in localStorage
        localStorage.setItem("username", result.value.username);
        localStorage.setItem("userAvatar", result.value.selectedAvatar);
        localStorage.setItem("lastRoom", result.value.roomname);
        
        // Redirect to room
        var target = location.protocol + '//' + location.host + location.pathname + '?room=' + result.value.roomname;
        window.location = target;
      }
    });
  }
  window.getUserSetup = getUserSetup;

  function getUserName() {
    // Get saved values for pre-filling
    const savedUsername = localStorage.getItem("username") || "";
    const savedAvatar = localStorage.getItem("userAvatar") || "";
    
    // Build avatar selection HTML
    const avatarGrid = avatars.map((avatar, index) => {
      const avatarNum = index + 1;
      const isSelected = savedAvatar === avatar ? 'border-color: #3085d6;' : 'border-color: #ddd;';
      return `
        <div class="avatar-card" data-avatar="${avatar}" style="cursor: pointer; border: 2px solid #ddd; border-radius: 8px; padding: 8px; transition: border-color 0.3s; ${isSelected}">
          <img src="${avatar}" alt="Avatar ${avatarNum}" style="width: 128px; height: 128px; display: block; border-radius: 4px;">
          <p style="margin-top: 5px; font-size: 12px; text-align: center;">${avatarNum}</p>
        </div>
      `;
    }).join('');
    
    Swal.fire({
      title: "Change Username & Avatar",
      html: `
        <div style="text-align: left;">
          <label for="username" style="display: block; margin-bottom: 5px; font-weight: bold;">Name:</label>
          <input type="text" id="username" class="swal2-input" placeholder="Enter your username" value="${savedUsername}" style="margin-top: 0;">
          
          <label style="display: block; margin-bottom: 10px; margin-top: 15px; font-weight: bold;">Choose an Avatar:</label>
          <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; max-height: 300px; overflow-y: auto; padding: 5px;">
            ${avatarGrid}
          </div>
          <input type="hidden" id="selectedAvatar" value="${savedAvatar}">
        </div>
      `,
      width: '600px',
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Save',
      cancelButtonText: 'Cancel',
      didOpen: () => {
        // Add click handlers for avatar cards
        const cards = document.querySelectorAll('.avatar-card');
        cards.forEach(card => {
          card.addEventListener('click', function() {
            // Remove selection from all cards
            cards.forEach(c => c.style.borderColor = '#ddd');
            // Add selection to clicked card
            this.style.borderColor = '#3085d6';
            // Store selected value
            document.getElementById('selectedAvatar').value = this.dataset.avatar;
          });
        });
      },
      preConfirm: () => {
        const username = document.getElementById('username').value.trim();
        const selectedAvatar = document.getElementById('selectedAvatar').value;
        
        if (!username) {
          Swal.showValidationMessage('Please enter a username');
          return false;
        }
        
        if (!selectedAvatar) {
          Swal.showValidationMessage('Please select an avatar');
          return false;
        }
        
        return { username, selectedAvatar };
      }
    }).then(result => {
      if (result.isConfirmed && result.value) {
        userName = result.value.username;
        userAvatar = result.value.selectedAvatar;
        localStorage.setItem("username", userName);
        localStorage.setItem("userAvatar", userAvatar);
        
        // Update avatar display if it exists
        const selfAvatarEl = byId("avatar_" + selfId);
        if (selfAvatarEl) {
          const avatarImg = selfAvatarEl.querySelector('img');
          if (avatarImg) {
            avatarImg.src = userAvatar;
          }
        }
        
        if (sendCmd) {
          sendCmd({ peerId: selfId, cmd: "username", username: userName });
        }
        const selfLabel = byId("label_" + selfId);
        if (selfLabel) selfLabel.innerText = userName;
      }
    });
  }
  window.getUserName = getUserName;
  
  function getRoomName() {
    getUserSetup();
  }
  window.getRoomName = getRoomName;
  
  function reJoinRoom() {
    // Clean up health check interval
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
      healthCheckInterval = null;
    }
    
    // Stop all tracks before leaving
    if (streaming) {
      streaming.getTracks().forEach(track => track.stop());
      streaming = null;
    }
    if (screenSharing) {
      screenSharing.getTracks().forEach(track => track.stop());
      screenSharing = false;
    }
    
    // Leave the room
    if (window.room) {
      window.room.leave();
    }
    
    Swal.fire(
      "Disconnected!",
      "Click to Rejoin",
      "success"
    ).then(result => {
        window.location.reload();
    });
  }
  window.reJoinRoom = reJoinRoom;

  // YouTube Player Functions
  function extractVideoId(input) {
    if (!input) return null;
    // Already a video ID (11 characters)
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
      return input;
    }
    
    // YouTube URL patterns - supports various formats:
    // - Standard watch: youtube.com/watch?v=VIDEO_ID
    // - Short URL: youtu.be/VIDEO_ID
    // - Embed: youtube.com/embed/VIDEO_ID or youtube-nocookie.com/embed/VIDEO_ID
    // - Shorts: youtube.com/shorts/VIDEO_ID
    // - Live: youtube.com/live/VIDEO_ID
    // - Mobile: m.youtube.com/watch?v=VIDEO_ID (and other subdomains)
    const patterns = [
      // Match youtu.be short URLs (with boundary check to prevent fake domains)
      /(?:^|[^a-zA-Z0-9-])youtu\.be\/([a-zA-Z0-9_-]{11})/,
      // Match all /path/VIDEO_ID formats with optional subdomains (embed, shorts, live)
      /(?:^|[^a-zA-Z0-9-])(?:[a-zA-Z0-9-]+\.)?youtube(?:-nocookie)?\.com\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{11})/,
      // Match watch URLs with v parameter (works with any subdomain like m.youtube.com)
      // Uses [^\s]* instead of .* to avoid matching across line boundaries
      /(?:^|[^a-zA-Z0-9-])(?:[a-zA-Z0-9-]+\.)?youtube\.com\/watch\?[^\s]*v=([a-zA-Z0-9_-]{11})/
    ];
    
    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) return match[1];
    }
    
    return null;
  }

  function loadYouTubeVideo(videoId, startTime = 0, playerState = null, isRemote = false) {
    if (!videoId) return;
    
    console.log('Loading YouTube video:', videoId, 'at', startTime, 'state:', playerState);
    currentVideoId = videoId;
    
    if (youtubePlayer) {
      // Player exists, just load new video
      isSyncingYouTube = true;
      youtubePlayer.loadVideoById({
        videoId: videoId,
        startSeconds: startTime
      });
      
      // Apply player state if provided
      if (playerState !== null) {
        setTimeout(() => {
          if (playerState === 1) { // Playing
            youtubePlayer.playVideo();
          } else if (playerState === 2) { // Paused
            youtubePlayer.pauseVideo();
          }
          isSyncingYouTube = false;
        }, 500);
      } else {
        setTimeout(() => { isSyncingYouTube = false; }, 500);
      }
    } else {
      // Player not ready yet - user needs to wait for YouTube API to load
      console.warn('YouTube player not ready yet. Please wait for the player to initialize.');
    }
    
    // Broadcast to peers if this is a local action
    if (!isRemote && sendYouTubeAction) {
      sendYouTubeAction({
        action: 'videoLoad',
        videoId: videoId,
        time: startTime,
        state: playerState || 2 // Default to paused
      });
    }
  }

  function handleYouTubePlayerStateChange(event) {
    if (isSyncingYouTube) return;
    
    const playerState = event.data;
    
    // YT.PlayerState.PLAYING = 1
    if (playerState === 1) {
      if (sendYouTubeAction) {
        sendYouTubeAction({ action: 'play' });
      }
    }
    // YT.PlayerState.PAUSED = 2
    else if (playerState === 2) {
      if (sendYouTubeAction) {
        sendYouTubeAction({ action: 'pause' });
      }
    }
  }

  function startYouTubeSeekTracking() {
    if (seekCheckInterval) return;
    
    seekCheckInterval = setInterval(() => {
      if (!youtubePlayer || isSyncingYouTube) return;
      
      try {
        const currentTime = youtubePlayer.getCurrentTime();
        
        // Check if there was a significant jump (> 2 seconds)
        if (Math.abs(currentTime - lastSeekTime) > 2) {
          if (sendYouTubeAction) {
            sendYouTubeAction({ action: 'seek', time: currentTime });
          }
        }
        
        lastSeekTime = currentTime;
      } catch (e) {
        // Player might not be ready yet
      }
    }, 500);
  }

  function handleYouTubeAction(data, peerId) {
    if (!data || peerId === selfId) return;
    
    console.log('Received YouTube action:', data.action, 'from', peerId);
    
    if (data.action === 'videoLoad' && data.videoId) {
      if (data.videoId !== currentVideoId) {
        loadYouTubeVideo(data.videoId, data.time || 0, data.state, true);
      }
    } else if (data.action === 'play') {
      if (youtubePlayer && !isSyncingYouTube) {
        isSyncingYouTube = true;
        youtubePlayer.playVideo();
        setTimeout(() => { isSyncingYouTube = false; }, 100);
      }
    } else if (data.action === 'pause') {
      if (youtubePlayer && !isSyncingYouTube) {
        isSyncingYouTube = true;
        youtubePlayer.pauseVideo();
        setTimeout(() => { isSyncingYouTube = false; }, 100);
      }
    } else if (data.action === 'seek' && data.time !== undefined) {
      if (youtubePlayer && !isSyncingYouTube) {
        isSyncingYouTube = true;
        youtubePlayer.seekTo(data.time, true);
        setTimeout(() => { isSyncingYouTube = false; }, 100);
      }
    }
  }

  function initYouTubePlayer() {
    const youtubeInput = byId("youtube-input");
    const youtubeLoadBtn = byId("youtube-load");
    
    if (!youtubeInput || !youtubeLoadBtn) return;
    
    // Register callbacks for module-level YouTube API callback
    youtubeCallbacks.startYouTubeSeekTracking = startYouTubeSeekTracking;
    youtubeCallbacks.handleYouTubePlayerStateChange = handleYouTubePlayerStateChange;
    
    // Helper function to handle video loading from input
    const handleVideoLoad = () => {
      const input = youtubeInput.value.trim();
      if (input) {
        const videoId = extractVideoId(input);
        if (videoId) {
          loadYouTubeVideo(videoId);
          youtubeInput.value = '';
        } else {
          notifyMe('Invalid YouTube URL or video ID');
        }
      }
    };
    
    // Handle video input
    youtubeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleVideoLoad();
      }
    });
    
    youtubeLoadBtn.addEventListener('click', handleVideoLoad);
    
    // Check if YouTube API is already loaded (in case of page reload)
    if (typeof YT !== 'undefined' && YT.Player && !youtubePlayer) {
      setTimeout(() => {
        if (window.onYouTubeIframeAPIReady) {
          window.onYouTubeIframeAPIReady();
        }
      }, 100);
    }
  }

};

start();
