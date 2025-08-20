importScripts('/static/messages.js'); 

let busy = false;
const canvases = new Map();

// listen for messages
self.onmessage = async (e) => {
  const { type, bitmap, sid, canvas, cssWidth, cssHeight, faceDetails } = e.data || {};

  try{

    switch(type){
      case MSG.SNAPSHOT_REQUEST:
        await snapshotRequest(bitmap, sid);
        break;
      case MSG.REGISTER_CANVAS:
        const sized = resizeCanvas(canvas, cssWidth, cssHeight);
        canvases.set(sid, { ...sized, cssWidth, cssHeight });
        break;
      case MSG.RESIZE_CANVAS:
        const entry = canvases.get(sid);
        if(!entry) break;
        entry.cssWidth = cssWidth;
        entry.cssHeight = cssHeight;
        const resized = resizeCanvas(entry.canvas, cssWidth, cssHeight);
        canvases.set(sid, {...entry, ...resized, cssWidth, cssHeight});
        break;
      case MSG.DRAW_OVERLAYS:
        drawOverlays(sid, faceDetails);
        break;
      default:
        console.log(`Worker: unknown type: ${type}`);
        break;
    }
    
  }catch(e){
    console.error(`Worker: error handling message: ${e}`);
  }
  

};

const snapshotRequest = async (bitmap, sid) => {

  try{

    const w = bitmap.width, h=bitmap.height;
    const canvas = new OffscreenCanvas(w, h); 
    const ctx = canvas.getContext('2d', { desynchronized: true });
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 }); 

    const fd = new FormData();
    fd.append('frame', blob, 'frame.jpg');
    await fetch(`/analyze/frame?sid=${encodeURIComponent(sid)}`, {
      method: 'POST',
      body: fd
    });

    self.postMessage({ type: MSG.SNAPSHOT_OK, error: '', message: 'Snapshot ok' });

  }catch(e){
    self.postMessage({ type: MSG.SNAPSHOT_ERROR, error: String(e), message: '' });
  }
  
};

const resizeCanvas = (offscreen, cssW, cssH) => {
  // Guard sizes
  const W = Math.max(0, Math.floor(cssW || 0));
  const H = Math.max(0, Math.floor(cssH || 0));
  const dpr = 1; 

  offscreen.width = W * dpr;
  offscreen.height = H * dpr;

  const ctx = offscreen.getContext('2d', { desynchronized: true });
  // Normalize to CSS pixels
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  return { canvas: offscreen, ctx, dpr, width: W, height: H };
};

const drawOverlays = (sid, faceDetails) => {

  const entry = canvases.get(sid);
  if(!entry) return;

  const { ctx, cssWidth: W, cssHeight: H } = entry;

  ctx.clearRect(0, 0, W, H);
  if (!faceDetails || !faceDetails.length) return;

  // choose largest face 
  const MIN_AREA = 0.02; 
  const MIN_CONF = 80;   // face Confidence in %
  const candidates = faceDetails.filter(f => {
    const bb = f.BoundingBox || {};
    const area = (bb.Width || 0) * (bb.Height || 0);
    const conf = (f.Confidence || 0);
    return area >= MIN_AREA && conf >= MIN_CONF;
  });

  const faces = faceDetails.slice().sort((a,b)=>{
    const aa=(a.BoundingBox?.Width||0)*(a.BoundingBox?.Height||0);
    const bb=(b.BoundingBox?.Width||0)*(b.BoundingBox?.Height||0);
    return bb-aa;
  });

  // Draw ONLY the largest face 
  const f = faces[0];
  const bb = f.BoundingBox || {};
  const x = (bb.Left || 0) * W, y = (bb.Top || 0) * H;
  const w = (bb.Width || 0) * W, h = (bb.Height || 0) * H;

  // Bounding box
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#FFFFFF";
  ctx.strokeRect(x, y, w, h);

  // Landmarks: pupils, nose, mouth corners
  const lm = f.Landmarks || [];
  const byType = {};
  lm.forEach(pt => byType[pt.Type] = pt);

  const dot = (pt, color = "#0ea5e9", r = 3) => {
    if (!pt) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pt.X * W, pt.Y * H, r, 0, Math.PI * 2);
    ctx.fill();
  }

  dot(byType.leftPupil,  "#0ea5e9");
  dot(byType.rightPupil, "#0ea5e9");
  dot(byType.nose,       "#f59e0b", 3);
  dot(byType.mouthLeft,  "#ef4444", 2);
  dot(byType.mouthRight, "#ef4444", 2);

  // Pose arrow (from nose)
  const pose = f.Pose || {};
  const nose = byType.nose;
  if (nose && (pose.Yaw !== undefined) && (pose.Pitch !== undefined)) {
    const startX = nose.X * W, startY = nose.Y * H;
    const scale = Math.max(w, h) * 0.4;
    const dx = (pose.Yaw / 30) * scale;
    const dy = (-pose.Pitch / 30) * scale;
    arrow(ctx, startX, startY, startX + dx, startY + dy, "#10b981");
    label(ctx, "Pose", startX + dx, startY + dy, "#FFFFFF");
  }

  // Eye direction arrow (from midpoint between pupils)
  const lp = byType.leftPupil, rp = byType.rightPupil;
  const eyeDir = f.EyeDirection || {};
  if (lp && rp && (eyeDir.Yaw !== undefined) && (eyeDir.Pitch !== undefined)) {
    const startX = (lp.X + rp.X) / 2 * W;
    const startY = (lp.Y + rp.Y) / 2 * H;
    const scale = Math.max(w, h) * 0.35;
    const dx = (eyeDir.Yaw / 30) * scale;
    const dy = (-eyeDir.Pitch / 30) * scale;
    arrow(ctx, startX, startY, startX + dx, startY + dy, "#3b82f6");
    label(ctx, "Eyes", startX + dx, startY + dy, "#FFFFFF");
  }

};

 const arrow = (ctx, x1,y1,x2,y2, color="#22c55e") => {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1,y1);
  ctx.lineTo(x2,y2);
  ctx.stroke();
  const angle = Math.atan2(y2-y1, x2-x1);
  const len = 8;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - len*Math.cos(angle - Math.PI/6), y2 - len*Math.sin(angle - Math.PI/6));
  ctx.lineTo(x2 - len*Math.cos(angle + Math.PI/6), y2 - len*Math.sin(angle + Math.PI/6));
  ctx.closePath();
  ctx.fill();
};

const label = (ctx, text, x, y, color="#111827") => {
  ctx.fillStyle = color;
  ctx.font = "18px sans-serif";  
  ctx.fillText(text, x + 6, y - 6); 
};