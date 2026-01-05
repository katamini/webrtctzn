function drop(ev) {
  ev.preventDefault();
  ev.stopPropagation();
  const surface = document.getElementById("draw-surface");
  const whiteboard = document.getElementById("whiteboard");
  const wbRect = whiteboard
    ? whiteboard.getBoundingClientRect()
    : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  const isOnSurface = surface && ev.target.closest("#draw-surface");
  var position = { x: 0.5, y: 0.5 };
  if (isOnSurface && wbRect.width && wbRect.height) {
    position = {
      x: (ev.clientX - wbRect.left) / wbRect.width,
      y: (ev.clientY - wbRect.top) / wbRect.height
    };
  }
  var imageTypes = ["image/png", "image/gif", "image/bmp", "image/jpg"];
  if (ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0]) {
    // ev.dataTransfer.files is a FileList
    // ev.dataTransfer.files[0].type is a Blob.type
    var fileType = ev.dataTransfer.files[0].type;
    if (imageTypes.includes(fileType)) {
      var reader = new FileReader();
      reader.onload = function(img) {
        console.log("got image drop", img.target, position);
        //displayImage(img.target);
        displayImageOnCanvas(img.target, position);
      };
      reader.readAsDataURL(ev.dataTransfer.files[0]);
    } else {
      console.log("dropped file is not an image");
    }
  }
}

function allowDrop(ev) {
  //ev.target.style.color = 'blue';
  ev.preventDefault();
  ev.stopPropagation();
}

function displayImage(imgx) {
  var cell = document.getElementById("peer-grid");
  var img = document.createElement("img");
  img.src = imgx.result;
  cell.appendChild(img);
}

function displayImageOnCanvas(imgx, pos) {
  var whiteboard = document.getElementById("whiteboard");
  if (!whiteboard) return;
  var newx = whiteboard ? pos.x * whiteboard.width : pos.x * window.innerWidth;
  var newy = whiteboard ? pos.y * whiteboard.height : pos.y * window.innerHeight;
  if (whiteboard && (newx > whiteboard.width || newy > whiteboard.height)) {
    console.log("out of bounds!", newx, newy);
  }
  var ctx = whiteboard.getContext("2d");
  var img = document.createElement("img");
  img.src = imgx.result;
  img.onload = function() {
    ctx.drawImage(img, newx, newy);
    // network share
    if (ctl) {
      var canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      var newctx = canvas.getContext("2d");
      newctx.drawImage(img, 0, 0);
      canvas.toBlob(function(blob) {
        ctl.sendPic(blob, null, { pos: pos, peerId: ctl.peerId });
      });
    }
  };
}

var navState = false;
function openNav() {
  if(navState){ closeNav(); return }
  document.getElementById("mySidenav").style.width = "200px";
  navState = true;
}

function closeNav() {
  document.getElementById("mySidenav").style.width = "0";
  navState = false;
}
