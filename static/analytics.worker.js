importScripts('/static/messages.js'); 

let busy = false;

// listen for messages
self.onmessage = async (e) => {
  const { type, bitmap, sid } = e.data || {};

  switch(type){
    case MSG.SNAPSHOT_REQUEST:
      await snapshotRequest(bitmap, sid);
      break;
    default:
      break;
  }

}

const snapshotRequest = async (bitmap, sid) => {

  try{

    busy = true;

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
  }finally{
    busy = false;
  }
  
}