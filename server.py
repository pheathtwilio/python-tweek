from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from typing import Dict

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

def touch_session(sid: str) -> Dict[str, int]:
    if not sid or len(sid) < 8:
        raise HTTPException(status_code=400, detail="Missing or invalid sid")
    if sid not in SESSIONS:
        SESSIONS[sid] = {
            "audio_bytes": 0, "video_bytes": 0,
            "audio_chunks": 0, "video_chunks": 0,
        }
    return SESSIONS[sid]

@app.get("/")
def root():
    return FileResponse(STATIC_DIR / "index.html")

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

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
    return JSONResponse({"ok": True, "bytes": len(data), "stats": sess})

@app.get("/stats")
def stats(sid: str | None = None):
    if sid:
        if sid not in SESSIONS:
            raise HTTPException(status_code=404, detail="Unknown sid")
        return SESSIONS[sid]
    return SESSIONS
