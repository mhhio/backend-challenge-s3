from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, List
from s3_client import upload_event, list_sessions, get_session_events, ensure_bucket_exists

app = FastAPI(title="S3 Backend Challenge")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Event(BaseModel):
    session_id: str
    payload: Dict[str, Any]

@app.on_event("startup")
async def startup_event():
    ensure_bucket_exists()

@app.post("/events")
async def create_event(event: Event):
    try:
        result = upload_event(event.session_id, event.payload)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/sessions")
async def get_sessions():
    try:
        return list_sessions()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/sessions/{session_id}/events")
async def get_events(session_id: str):
    try:
        return get_session_events(session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
