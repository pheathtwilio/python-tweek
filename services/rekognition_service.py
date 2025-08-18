from __future__ import annotations
import os
from typing import Dict, List, Optional
from dotenv import load_dotenv
load_dotenv()

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

AWS_REGION = (
    os.getenv("AWS_REGION")
    or os.getenv("AWS_DEFAULT_REGION")
    or "us-east-1"
)

_rekognition = boto3.client(
    "rekognition",
    region_name=AWS_REGION,
    config=Config(retries={"max_attempts": 3, "mode": "standard"}),
)

EMOTION_COLORS: Dict[str, str] = {
    "HAPPY": "#FFD700",
    "SAD": "#1E90FF",
    "ANGRY": "#FF4500",
    "SURPRISED": "#8A2BE2",
    "DISGUSTED": "#228B22",
    "CALM": "#87CEFA",
    "CONFUSED": "#DA70D6",
}

def detect_emotions(image_bytes: bytes) -> Dict:
    """
    Runs AWS Rekognition DetectFaces on the provided image bytes and returns a
    compact dict with:
      - emotionsOver50: list[str]
      - primaryEmotion: Optional[str]
      - primaryConfidence: float
      - backgroundColor: str (derived from primaryEmotion)
      - raw: (optional) raw response if you want to keep it for debugging
    """
    try:
        resp = _rekognition.detect_faces(
            Image={"Bytes": image_bytes},
            Attributes=["ALL"],
        )
    except (BotoCoreError, ClientError) as e:
        raise RuntimeError(f"Rekognition error: {e}") from e

    emotions_over_50: List[str] = []
    primary_emotion: Optional[str] = None
    primary_conf: float = 0.0

    for face in resp.get("FaceDetails", []):
        for emo in face.get("Emotions", []):
            etype = (emo.get("Type") or "").upper()
            conf = float(emo.get("Confidence") or 0.0)
            if conf > 50.0:
                emotions_over_50.append(etype)
            if conf > primary_conf:
                primary_conf = conf
                primary_emotion = etype

    color = EMOTION_COLORS.get((primary_emotion or "").upper(), "#ffffff")

    return {
        "emotionsOver50": emotions_over_50,
        "primaryEmotion": primary_emotion,
        "primaryConfidence": primary_conf,
        "backgroundColor": color,
        "raw": resp,
    }
