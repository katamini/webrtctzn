import { joinRoom, selfId } from "https://esm.run/trystero";
import quickLru from 'https://cdn.skypack.dev/quick-lru@6.1.2';
const lru = new quickLru({maxSize: 1000});

var doc = {};

var start = function() {
  const byId = document.getElementById.bind(document);
  const canvas = byId("canvas");
  const whiteboard = byId("whiteboard");
  const ctx = whiteboard.getContext("2d");
  const drawSurface = byId("draw-surface");
  const mainGrid = byId("main-grid");
  const resizeHandles = document.querySelectorAll(".resize-handle");
  const videoToggle = byId("video-toggle");
  const videoFeed = byId("video-feed");
  const chatSend = byId("chat-send");
  const audioViz = byId("audio-visualizer");

  const circle = byId("list");
  const chat = byId("chat");
  const chatbox = byId("chatbox");
  const talkbutton = byId("talkbutton");
  const mutebutton = byId("mutebutton");
  const shareButton = byId("share-button");
  const shareScreenButton = byId("share-screen");
  const shareView = byId("shareview");
  const peerGrid = byId("peer-grid");
  var features = { audio: true, video: false };

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
    const bars = 32;
    const draw = () => {
      vizRaf = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(vizData);
      const width = audioViz.width || 1;
      const height = audioViz.height || 1;
      ctx.clearRect(0, 0, width, height);
      const slice = Math.max(1, Math.floor(vizData.length / bars));
      const barWidth = width / bars;
      for (let i = 0; i < bars; i++) {
        const v = vizData[i * slice] / 255;
        const barHeight = v * height;
        ctx.fillStyle = "#7ee787";
        ctx.fillRect(i * barWidth, height - barHeight, barWidth * 0.75, barHeight);
      }
    };
    draw();
  }

  const defaultColPerc = [25, 25, 25, 25];
  const defaultRowPerc = [50, 50];
  let colPerc = [...defaultColPerc];
  let rowPerc = [...defaultRowPerc];
  const minCol = 10;
  const minRow = 20;
  let expandedTile = null;
  let savedPerc = null;
  let audioCtx = null;
  let analyser = null;
  let vizSource = null;
  let vizData = null;
  let vizRaf = null;

  function applyGrid() {
    if (!mainGrid) return;
    mainGrid.style.setProperty("--col-1", colPerc[0] + "%");
    mainGrid.style.setProperty("--col-2", colPerc[1] + "%");
    mainGrid.style.setProperty("--col-3", colPerc[2] + "%");
    mainGrid.style.setProperty("--col-4", colPerc[3] + "%");
    mainGrid.style.setProperty("--row-1", rowPerc[0] + "%");
    mainGrid.style.setProperty("--row-2", rowPerc[1] + "%");

    if (resizeHandles && resizeHandles.length) {
      let acc = 0;
      const totalCols = colPerc.reduce((a, b) => a + b, 0);
      const totalRows = rowPerc.reduce((a, b) => a + b, 0);
      resizeHandles.forEach(handle => {
        const idx = Number(handle.dataset.index);
        if (handle.classList.contains("col")) {
          acc = colPerc.slice(0, idx + 1).reduce((a, b) => a + b, 0);
          handle.style.left = (acc / totalCols) * 100 + "%";
        } else if (handle.classList.contains("row")) {
          const rowAcc = rowPerc.slice(0, idx + 1).reduce((a, b) => a + b, 0);
          handle.style.top = (rowAcc / totalRows) * 100 + "%";
        }
      });
    }
  }
  applyGrid();

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

  resizeHandles.forEach(bindResize);
  window.addEventListener("resize", () => {
    applyGrid();
    setWhiteboardSize();
    resizeAudioViz();
  });

  function expandTile(tile) {
    if (!tile) return;
    const tiles = Array.from(document.querySelectorAll(".tile"));
    const index = tiles.indexOf(tile);
    if (index === -1) return;
    const colIndex = index % 4;
    const rowIndex = Math.floor(index / 4);

    // toggle off
    if (expandedTile === tile && savedPerc) {
      colPerc = [...savedPerc.col];
      rowPerc = [...savedPerc.row];
      expandedTile = null;
      savedPerc = null;
      applyGrid();
      setWhiteboardSize();
      return;
    }

    savedPerc = { col: [...colPerc], row: [...rowPerc] };
    expandedTile = tile;

    let newCols;
    if (colIndex === 3) {
      newCols = [18, 18, 18, 46];
    } else {
      newCols = [15, 15, 15, 15];
      newCols[colIndex] = 55;
      newCols[3] = 15;
    }

    let newRows = [...rowPerc];
    if (rowIndex === 0) {
      newRows = [70, 30];
    } else if (rowIndex === 1) {
      newRows = [30, 70];
    }

    colPerc = newCols;
    rowPerc = newRows;
    applyGrid();
    setWhiteboardSize();
    resizeAudioViz();
  }

  document.querySelectorAll(".tile-head").forEach(head => {
    head.addEventListener("dblclick", e => {
      e.preventDefault();
      e.stopPropagation();
      const tile = head.closest(".tile");
      expandTile(tile);
    });
  });

  //const peerInfo = byId("peer-info");
  //const noPeersCopy = peerInfo.innerText;
  const config = { appId: "ctzn-glitch" };
  const cursors = {};
  const roomCap = 33;

  let mouseX = 0;
  let mouseY = 0;
  let room;
  let rooms;
  let sendMove;
  let sendChat;
  let sendPeer;
  let sendCmd;
  let sendPic;

  const peerAlias = {};

  var streams = [];
  var screens = [];
  // sidepeer for calls only
  var peerId = selfId + "_call";
  var userName = false;
  var roomName = false;

  // Room Selector
  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);
  if (urlParams.has("room")) {
    roomName = urlParams.get("room");
    init(roomName);
  } else {
    getRoomName();
    //roomName = "lobby";
    //init(roomName);
  }
  if (urlParams.has("video") || features.video) {
    features.video = true;
    talkbutton.innerHTML =
      '<i class="fa fa-video fa-2x" aria-hidden="true"></i>';
  }
  if (urlParams.has("audio")) {
    features.video = false;
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
  const updateVideoToggle = () => {
    if (!videoToggle) return;
    videoToggle.innerText = features.video ? "Video on" : "Enable video";
    videoToggle.title = features.video ? "Video enabled for the next call" : "Audio-only by default";
  };
  updateVideoToggle();

  if (videoToggle) {
    videoToggle.addEventListener("click", () => {
      features.video = !features.video;
      updateVideoToggle();
      if (streaming) {
        videoToggle.title = "Video preference will apply on the next call.";
      }
    });
  }

  talkbutton.addEventListener("click", async () => {
    //console.log("call button");
    if (!streaming) {
      var stream = await navigator.mediaDevices.getUserMedia(features);
      room.addStream(stream);
      handleStream(stream, selfId);
      streaming = stream;
      startAudioViz(stream);
      muted = false;
      talkbutton.innerHTML = !features.video
        ? '<i class="fa fa-phone fa-2x" aria-hidden="true" style="color:white;"></i>'
        : '<i class="fa fa-video fa-2x" aria-hidden="true" style="color:white;"></i>';
      talkbutton.style.background = "red";
      // notify network
      if (sendCmd) {
        sendCmd({ peerId: peerId, cmd: "hand", state: true });
      }
    } else {
      room.removeStream(streaming);
      var tracks = streaming.getTracks();
      tracks.forEach(function(track) {
        track.stop();
      });
      var el = byId("vid_" + selfId);
      el.srcObject = null;
      streaming = null;
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

    byId("room-num").innerText = "#" + n;
    room.onPeerJoin(addCursor);
    room.onPeerLeave(removeCursor);
    room.onPeerStream(handleStream);
    getMove(moveCursor);
    getChat(updateChat);
    getCmd(handleCmd);
    getPic(handlePic);

    // mappings
    window.ctl = { sendCmd: sendCmd, sendPic: sendPic, peerId: selfId };
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
        // which one is it? :)
        el = byId("vid_" + peerId);
        if (el) el.srcObject = null;
      } else if (data.cmd == "hand") {
        if (data.focus) {
          // handle focus
          var el = byId("cursor_" + id);
          if (el && data.focus == "hidden") el.classList.add("handoff");
          else el.classList.remove("handoff");
          var el = byId("circle_" + id);
          if (el && data.focus == "hidden") el.classList.add("handoff");
          else el.classList.remove("handoff");
        } else {
          // handle state
          var el = byId("hand_" + id);
          if (el && data.state) el.classList.add("handgreen");
          else el.classList.remove("handgreen");
          var el = byId("circle_" + id);
          if (el && data.state) el.classList.add("handgreen");
          else el.classList.remove("handgreen");
        }
      } else if (data.cmd == "username" && data.username) {
        var el = byId("name_" + id);
        if (el) el.innerText = data.username;
        var us = byId("user_" + id);
        if (us) us.innerText = data.username;
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
    const txt = document.createElement("p");
    txt.id = "name_" + id;
    const video = document.createElement("video");
    video.id = "vid_" + id;
    video.playsInline = true;
    video.muted = isSelf ? true : false;

    el.style.float = "left";
    el.className = `cursor${isSelf ? " self" : ""}`;
    el.style.left = el.style.top = "-99px";
    img.src = "static/hand.png";
    txt.innerText = isSelf ? "you" : id.slice(0, 4);
    el.appendChild(img);
    el.appendChild(txt);
    if (isSelf) {
      img.style.display = "none";
    }
    canvas.appendChild(el);
    cursors[id] = el;

    if (videoFeed) {
      videoFeed.appendChild(video);
    }

    if (!isSelf) {
      updatePeerInfo();
    }

    if (userName && sendCmd) {
      sendCmd({ peerId: selfId, cmd: "username", username: userName });
    }

    // video circle attempt
    var li = document.createElement("li");
    li.className = "list-item";
    li.id = "circle_" + id;
    var inner_txt = document.createElement("p");
    inner_txt.innerText = isSelf ? "you" : id.slice(0, 4);
    inner_txt.className = "list-text";
    inner_txt.id = "user_" + id;
    li.appendChild(inner_txt);
    //li.appendChild(video);
    circle.appendChild(li);
    updateLayout(circle);
    
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
    if (cursors[id]) {
      canvas.removeChild(cursors[id]);
    }
    const vid = byId("vid_" + id);
    if (vid && vid.parentNode) {
      vid.parentNode.removeChild(vid);
    }
    if (streams[id]) {
      room.removeStream(streams[id], id);
      streams[id] = false;
    }

    var li = byId("circle_" + id);
    if (li && li.parentNode) {
      circle.removeChild(li);
      updateLayout();
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
      var stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        frameRate: 5
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

  function getUserName() {
    Swal.fire({
      title: "Hey Stranger!",
      text: "Choose a Username:",
      input: "text"
    }).then(result => {
      if (result.value) {
        //console.log('got username',result.value)
        userName = result.value || selfId;
        localStorage.setItem("username", userName);
        if (sendCmd) {
          sendCmd({ peerId: selfId, cmd: "username", username: userName });
        }
      }
    });
  }
  window.getUserName = getUserName;
  
  function getRoomName() {
    Swal.fire({
      title: "Welcome Stranger!",
      text: "Create or Join a Room",
      input: "text",
      inputPlaceholder: "lobby"
    }).then(result => {
      if (result.value) {
        //console.log('got username',result.value)
        if (!result.value || result.value.length < 4) result.value = 'lobby';
        var target = location.protocol + '//' + location.host + location.pathname + '?room=' + result.value;
        window.location = target;
      }
    });
  }
  window.getRoomName = getRoomName;
  
  function reJoinRoom() {
    window.room.leave();
    Swal.fire(
      "Disconnected!",
      "Click to Rejoin",
      "success"
    ).then(result => {
        window.location.reload();
    });
  }
  window.reJoinRoom = reJoinRoom;

  /* circle layout functions */

  function updateLayout() {
    var listItems = document.getElementsByClassName("list-item");
    for (var i = 0; i < listItems.length; i++) {
      var offsetAngle = 360 / listItems.length;
      var rotateAngle = offsetAngle * i;
      var el = byId(listItems[i].id);
      el.style.transform =
        "rotate(" +
        rotateAngle +
        "deg) translate(0, -80px) rotate(-" +
        rotateAngle +
        "deg)";
    }
  }

  function addCircle(item) {
    var list = document.getElementById("list");
    list.append(item);
  }

  var deleteCircle = function(e) {
    var list = document.getElementById("list");
    e.parent().remove();
  };
  
  
  
};

start();
