import boto3
import os
import json
import uuid
import time
from botocore.exceptions import ClientError

S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://localhost:9000")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "minioadmin")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "minioadmin")
BUCKET_NAME = "app-events"

s3 = boto3.client(
    "s3",
    endpoint_url=S3_ENDPOINT,
    aws_access_key_id=S3_ACCESS_KEY,
    aws_secret_access_key=S3_SECRET_KEY,
)

def ensure_bucket_exists():
    try:
        s3.head_bucket(Bucket=BUCKET_NAME)
    except ClientError:
        try:
            s3.create_bucket(Bucket=BUCKET_NAME)
        except ClientError as e:
            print(f"Could not create bucket: {e}")

def upload_event(session_id: str, payload: dict):
    event_id = str(uuid.uuid4())
    timestamp = int(time.time() * 1000)
    key = f"sessions/{session_id}/{timestamp}_{event_id}.json"
    
    # Add metadata to payload if not present
    if "id" not in payload:
        payload["id"] = event_id
    if "timestamp" not in payload:
        payload["timestamp"] = timestamp
        
    s3.put_object(
        Bucket=BUCKET_NAME,
        Key=key,
        Body=json.dumps(payload),
        ContentType="application/json"
    )
    return payload

def list_sessions():
    # List "directories" under sessions/
    response = s3.list_objects_v2(
        Bucket=BUCKET_NAME,
        Prefix="sessions/",
        Delimiter="/"
    )
    sessions = []
    if "CommonPrefixes" in response:
        for prefix in response["CommonPrefixes"]:
            # prefix['Prefix'] is like "sessions/session-id/"
            # split gives ['', 'sessions', 'session-id', ''] -> index 2?
            # actually "sessions/session-id/" -> split("/") -> ["sessions", "session-id", ""]
            parts = prefix["Prefix"].split("/")
            if len(parts) > 1:
                sessions.append(parts[1])
    return sessions

def get_session_events(session_id: str):
    prefix = f"sessions/{session_id}/"
    response = s3.list_objects_v2(
        Bucket=BUCKET_NAME,
        Prefix=prefix
    )
    events = []
    if "Contents" in response:
        # Sort by Key (which starts with timestamp)
        sorted_objects = sorted(response["Contents"], key=lambda x: x["Key"])
        for obj in sorted_objects:
            # Fetch object content
            try:
                obj_resp = s3.get_object(Bucket=BUCKET_NAME, Key=obj["Key"])
                content = json.loads(obj_resp["Body"].read())
                events.append(content)
            except Exception as e:
                print(f"Error reading {obj['Key']}: {e}")
    return events
