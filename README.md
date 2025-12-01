# S3 Backend Challenge - Event Logger

A Proof of Concept (PoC) for an event logging system that uses **only Object Storage (S3)** for persistence. Events are grouped into indefinite sessions without a traditional database.

## Architecture

- **Frontend**: Next.js 16 with TypeScript and Tailwind CSS
- **Backend**: FastAPI (Python) with boto3 for S3 operations
- **Infrastructure**: MinIO (S3-compatible storage) via Docker Compose

## Key Design Decisions

### S3-Only Storage Strategy
Since sessions can last indefinitely (potentially years) and we can only use object storage:

1. **Folder-as-Session Pattern**: Each session is represented by a folder in S3
   - Key structure: `sessions/{session_id}/{timestamp_ms}_{event_id}.json`
   - Each event is a separate immutable object

2. **Session Discovery**: Use S3's `ListObjects` with delimiter to find all sessions
   - `ListObjects(prefix="sessions/", delimiter="/")` returns session folders

3. **Event Retrieval**: List all objects in a session folder and sort by timestamp
   - Objects are naturally sorted by timestamp prefix in the key

## Prerequisites

- Docker and Docker Compose
- Python 3.13+ with pip
- Node.js 18+ with npm

## Quick Start

### 1. Start Infrastructure (MinIO)

```bash
cd infra
docker compose up -d
```

MinIO will be available at:
- API: http://localhost:9000
- Console: http://localhost:9001 (credentials: minioadmin/minioadmin)

### 2. Start Backend (FastAPI)

```bash
# Install dependencies
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt

# Run the server
cd backend
uvicorn main:app --reload --port 8000
```

Backend API will be available at http://localhost:8000
- Swagger UI: http://localhost:8000/docs

### 3. Start Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Frontend will be available at http://localhost:3000

## API Endpoints

### POST /events
Create a new event in a session.

```bash
curl -X POST http://localhost:8000/events \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "user-123",
    "payload": {"action": "login", "user": "demo"}
  }'
```

### GET /sessions
List all active sessions.

```bash
curl http://localhost:8000/sessions
# Returns: ["user-123", "user-456"]
```

### GET /sessions/{session_id}/events
Get all events for a specific session.

```bash
curl http://localhost:8000/sessions/user-123/events
```

## Frontend Features

### Home Page (/)
- View all active sessions
- Create new sessions by sending the first event

### Session Detail (/sessions/[id])
- **Quick Actions**: Pre-defined event templates for easy testing:
  - 🔐 Login
  - 🚪 Logout
  - 🖱️ Click
  - 📄 Page View
  - ❌ Error
  - 🛒 Add to Cart
- **Custom Event**: Send custom JSON payloads
- **Event Log**: Real-time view of all events in the session

## Testing the Application

1. Open http://localhost:3000
2. Create a new session (e.g., "demo-session")
3. Click on the session to view details
4. Use the Quick Action buttons to send pre-defined events
5. Or use the Custom Event textarea to send your own JSON
6. Watch events appear in real-time in the Event Log

## Project Structure

```
.
├── backend/
│   ├── main.py           # FastAPI application
│   ├── s3_client.py      # MinIO/S3 client wrapper
│   └── requirements.txt  # Python dependencies
├── frontend/
│   ├── app/
│   │   ├── page.tsx                    # Session list page
│   │   └── sessions/[id]/page.tsx      # Event detail page
│   └── package.json
├── infra/
    └── docker-compose.yml  # MinIO setup

```

## Versions

- MinIO: RELEASE.2024-11-07T00-52-20Z
- MinIO Client (mc): RELEASE.2024-11-05T11-29-45Z
- FastAPI: 0.115.5
- Uvicorn: 0.32.1
- boto3: 1.35.71
- Next.js: 16.0.6
- React: 19

## Scalability Considerations

For production use with millions of events per session:

1. **Time Partitioning**: Add date hierarchy to keys
   - `sessions/{session_id}/{year}/{month}/{day}/{timestamp}_{event_id}.json`
   - Allows fetching only recent events

2. **Pagination**: Implement S3 pagination with `ContinuationToken`

3. **Caching**: Add Redis/Memcached for frequently accessed sessions

4. **Indexing**: Use S3 Select or Athena for complex queries

## Performance Analysis

### Current Approach: One Object Per Event

This implementation stores each event as a separate S3 object. Here's how it performs under different high-throughput scenarios:

#### Scenario 1: Different Sessions, Same Event Type, High RPS
**Example**: 10,000 users all sending "page_view" events simultaneously

✅ **EXCELLENT Performance**
- **Why**: S3 automatically partitions by key prefix
- Each session writes to different prefixes: `sessions/user-1/...`, `sessions/user-2/...`
- S3 can handle **5,500 PUT requests/second per prefix**
- With different session IDs, you get virtually unlimited write throughput
- No contention, no conflicts

**Verdict**: ✅ This approach is **ideal** for this scenario

---

#### Scenario 2: Different Sessions, Different Events, High RPS
**Example**: 10,000 sessions each sending 100 different event types/second

✅ **EXCELLENT Performance**
- Same reasoning as Scenario 1
- Different sessions = different prefixes = parallel writes
- S3's distributed architecture shines here
- Can scale to millions of events/second across sessions

**Potential Issue**: 
- **Read performance** when listing sessions could degrade with millions of sessions
- **Solution**: Add a session index (e.g., DynamoDB table or Redis cache) to track active sessions

**Verdict**: ✅ **Excellent for writes**, ⚠️ **May need optimization for reads at extreme scale**

---

#### Scenario 3: Same Session, High Event RPS
**Example**: One user session generating 1,000 events/second

⚠️ **PROBLEMATIC - This is the bottleneck**

**Issues**:
1. **S3 Rate Limits**: 
   - 5,500 PUT/second **per prefix**
   - All events for `session-123` go to `sessions/session-123/...`
   - You're limited to ~5,500 events/second per session
   
2. **Listing Performance**:
   - If a session has millions of events, `ListObjects` becomes slow
   - Pagination required (1,000 objects per page)
   - Reading all events for display is expensive

3. **Cost**:
   - Each event = 1 PUT request = $0.005 per 1,000 requests
   - 1,000 events/sec = 86.4M events/day = $432/day in PUT costs alone

**Better Approaches for Scenario 3**:

##### Option A: Batch Events (Recommended)
```python
# Instead of one object per event, batch them
sessions/{session_id}/{timestamp_minute}.json
# Contains array of events for that minute
```

**Pros**:
- Reduces PUT requests by 60x (if batching per minute)
- Faster reads (fewer objects to list/fetch)
- Lower costs

**Cons**:
- Need buffering/aggregation logic
- Slight delay in event visibility

##### Option B: Time-Based Partitioning
```python
sessions/{session_id}/{year}/{month}/{day}/{hour}/{timestamp}_{event_id}.json
```

**Pros**:
- Can query recent events without scanning everything
- Better S3 prefix distribution

**Cons**:
- Still hits rate limits for very high RPS on same session

##### Option C: Hybrid Approach (Best for Production)
```python
# Hot path: Buffer in Redis/Kinesis for real-time
# Cold path: Batch write to S3 every minute
sessions/{session_id}/{date}/{hour}/{minute}.json
```

**Pros**:
- Real-time reads from cache
- Cost-effective S3 storage
- No rate limit issues

---

### Performance Summary Table

| Scenario | Current Approach | Max Throughput | Recommendation |
|----------|-----------------|----------------|----------------|
| **Different sessions, same event** | ✅ Excellent | ~5,500 RPS × sessions | Keep as-is |
| **Different sessions, different events** | ✅ Excellent | Millions RPS | Add session index for reads |
| **Same session, high event RPS** | ⚠️ Problematic | ~5,500 RPS/session | **Use batching or hybrid** |

### Recommended Production Architecture

For a real-world system handling all three scenarios:

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│   API Gateway   │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐      ┌──────────────┐
│   FastAPI       │─────▶│  Redis       │ (Hot data, last 1 hour)
└──────┬──────────┘      └──────────────┘
       │
       ▼
┌─────────────────┐      ┌──────────────┐
│ Kinesis/Kafka   │─────▶│  Lambda      │ (Batch aggregator)
└─────────────────┘      └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐
                         │  S3 (Cold)   │ (Batched events)
                         └──────────────┘
```

**Key Components**:
- **Redis**: Cache hot data (last hour) for real-time reads
- **Kinesis/Kafka**: Stream events for processing
- **Lambda**: Aggregate events into batches every minute
- **S3**: Long-term storage with batched events

**Benefits**:
- Sub-second latency for recent events
- Unlimited write throughput
- Cost-effective storage
- Handles all three scenarios efficiently


## Cleanup

```bash
# Stop all services
docker compose -f infra/docker-compose.yml down -v

# Kill backend/frontend processes
lsof -ti:8000 | xargs kill -9
lsof -ti:3000 | xargs kill -9
```
