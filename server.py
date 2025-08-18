from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi import WebSocket, WebSocketDisconnect
from pathlib import Path
from typing import Dict, Set
import asyncio

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"
STATIC_DIR.mkdir(exist_ok=True)

SESSIONS: Dict[str, Dict[str, int]] = {}  # { sid: {audio_bytes, video_bytes, audio_chunks, video_chunks} }
CLIENTS: set[WebSocket] = set()
CONNECTIONS: Dict[str, Set[WebSocket]] = {}
CONN_LOCK = asyncio.Lock()

def touch_session(sid: str) -> Dict[str, int]:
    if not sid or len(sid) < 8:
        raise HTTPException(status_code=400, detail="Missing or invalid sid")
    if sid not in SESSIONS:
        SESSIONS[sid] = {
            "audio_bytes": 0, "video_bytes": 0,
            "audio_chunks": 0, "video_chunks": 0,
        }
    return SESSIONS[sid]

async def send_to_client(sid: str, text: str):
    print('Sending to client {sid} {text}')
    async with CONN_LOCK:
        sockets = list(CONNECTIONS.get(sid, set()))
    dead = []
    for ws in sockets:
        try:
            await ws.send_text(text)
        except Exception:
            dead.append(ws)
    if dead:
        async with CONN_LOCK:
            for ws in dead:
                for s, group in list(CONNECTIONS.items()):
                    if ws in group:
                        group.remove(ws)
                        if not group:
                            CONNECTIONS.pop(s, None)

@app.get("/")
def root():
    return FileResponse(STATIC_DIR / "index.html")

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    # Expect ?sid=... in connection URL
    sid = ws.query_params.get("sid")
    if not sid or len(sid) < 8:
        await ws.close(code=1008)  
        return

    await ws.accept()
    async with CONN_LOCK:
        CONNECTIONS.setdefault(sid, set()).add(ws)

    try:
        # Optional: receive messages from client
        while True:
            _ = await ws.receive_text()
    except WebSocketDisconnect:
        async with CONN_LOCK:
            group = CONNECTIONS.get(sid)
            if group and ws in group:
                group.remove(ws)
                if not group:
                    CONNECTIONS.pop(sid, None)

@app.post("/upload/audio")
async def upload_audio(sid: str, chunk: UploadFile = File(...)):
    sess = touch_session(sid)
    data = await chunk.read()  # read then discard
    sess["audio_bytes"] += len(data)
    sess["audio_chunks"] += 1
    return JSONResponse({"ok": True, "bytes": len(data), "stats": sess})

@app.post("/upload/video")
async def upload_video(sid: str, chunk: UploadFile = File(...)):
    sess = touch_session(sid)
    data = await chunk.read()  # read then discard
    sess["video_bytes"] += len(data)
    sess["video_chunks"] += 1
    await send_to_client(sid, "Video chunk received")
    return JSONResponse({"ok": True, "bytes": len(data), "stats": sess})

@app.get("/stats")
def stats(sid: str | None = None):
    if sid:
        if sid not in SESSIONS:
            raise HTTPException(status_code=404, detail="Unknown sid")
        return SESSIONS[sid]
    return SESSIONS
