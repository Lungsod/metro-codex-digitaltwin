# Share Link Service Architecture

## System Overview

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                    Metro Codex Digital Twin                     ┃
┃                         (TerriaMap)                             ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

    ┌─────────────────────────────────────────────────────────┐
    │                    Client (Browser)                      │
    │  ┌────────────────────────────────────────────────┐    │
    │  │  ShareDataService.ts (TerriaJS)                │    │
    │  │  - getShareToken()                             │    │
    │  │  - resolveData()                               │    │
    │  └────────────────────────────────────────────────┘    │
    └───────────────────────┬─────────────────────────────────┘
                            │ HTTP/HTTPS
                            │
    ┌───────────────────────▼─────────────────────────────────┐
    │                 server.js (Express)                      │
    │  ┌──────────────────────────────────────────────────┐  │
    │  │  Terria Server Integration                       │  │
    │  │  - app.use("/twin", terriaApp)                   │  │
    │  │  - app.use("/twin/share", shareRouter)           │  │
    │  │  - app.get("/twin/serverconfig")                 │  │
    │  └──────────────────────────────────────────────────┘  │
    └───────────────────────┬─────────────────────────────────┘
                            │
    ┌───────────────────────▼─────────────────────────────────┐
    │               lib/share.js (Router)                      │
    │  ┌──────────────────────────────────────────────────┐  │
    │  │  POST /twin/share                                │  │
    │  │  ├─ Validate request                             │  │
    │  │  ├─ Generate ID (SHA-256)                        │  │
    │  │  ├─ Save to file                                 │  │
    │  │  └─ Return URL                                   │  │
    │  │                                                   │  │
    │  │  GET /twin/share/:id                             │  │
    │  │  ├─ Parse ID                                     │  │
    │  │  ├─ Read from file                               │  │
    │  │  └─ Return JSON                                  │  │
    │  └──────────────────────────────────────────────────┘  │
    └───────────────────────┬─────────────────────────────────┘
                            │
    ┌───────────────────────▼─────────────────────────────────┐
    │           sharedata/ (File System)                       │
    │  ┌──────────────────────────────────────────────────┐  │
    │  │  index.json                                       │  │
    │  │  {                                                │  │
    │  │    "abc123": {                                    │  │
    │  │      "created": "2025-10-15T...",                 │  │
    │  │      "size": 1024                                 │  │
    │  │    }                                              │  │
    │  │  }                                                │  │
    │  └──────────────────────────────────────────────────┘  │
    │  ┌──────────────────────────────────────────────────┐  │
    │  │  data/                                            │  │
    │  │  ├─ abc123.json  (share data)                    │  │
    │  │  ├─ def456.json  (share data)                    │  │
    │  │  └─ xyz789.json  (share data)                    │  │
    │  └──────────────────────────────────────────────────┘  │
    └─────────────────────────────────────────────────────────┘
```

## Share Creation Flow

```
User                 Browser              server.js           share.js          File System
 │                     │                      │                  │                    │
 │ 1. Click Share      │                      │                  │                    │
 ├────────────────────>│                      │                  │                    │
 │                     │                      │                  │                    │
 │                     │ 2. POST /twin/share  │                  │                    │
 │                     │ {map state JSON}     │                  │                    │
 │                     ├─────────────────────>│                  │                    │
 │                     │                      │                  │                    │
 │                     │                      │ 3. Route to      │                    │
 │                     │                      │    share handler │                    │
 │                     │                      ├─────────────────>│                    │
 │                     │                      │                  │                    │
 │                     │                      │                  │ 4. Generate ID     │
 │                     │                      │                  │    SHA256(content) │
 │                     │                      │                  │    -> "abc123"     │
 │                     │                      │                  │                    │
 │                     │                      │                  │ 5. Write file      │
 │                     │                      │                  ├───────────────────>│
 │                     │                      │                  │                    │
 │                     │                      │                  │ 6. Update index    │
 │                     │                      │                  ├───────────────────>│
 │                     │                      │                  │                    │
 │                     │                      │ 7. Return        │                    │
 │                     │                      │    {id: "local-  │                    │
 │                     │                      │     abc123"}     │                    │
 │                     │                      │<─────────────────┤                    │
 │                     │                      │                  │                    │
 │                     │ 8. Response          │                  │                    │
 │                     │ {id, path, url}      │                  │                    │
 │                     │<─────────────────────┤                  │                    │
 │                     │                      │                  │                    │
 │ 9. Show share link  │                      │                  │                    │
 │<────────────────────┤                      │                  │                    │
 │ "localhost:3001/    │                      │                  │                    │
 │  twin/share/        │                      │                  │                    │
 │  local-abc123"      │                      │                  │                    │
```

## Share Resolution Flow

```
User                 Browser              server.js           share.js          File System
 │                     │                      │                  │                    │
 │ 1. Open share link  │                      │                  │                    │
 ├────────────────────>│                      │                  │                    │
 │                     │                      │                  │                    │
 │                     │ 2. GET               │                  │                    │
 │                     │ /twin/share/         │                  │                    │
 │                     │ local-abc123         │                  │                    │
 │                     ├─────────────────────>│                  │                    │
 │                     │                      │                  │                    │
 │                     │                      │ 3. Route to      │                    │
 │                     │                      │    share handler │                    │
 │                     │                      ├─────────────────>│                    │
 │                     │                      │                  │                    │
 │                     │                      │                  │ 4. Parse ID        │
 │                     │                      │                  │    Strip "local-"  │
 │                     │                      │                  │    -> "abc123"     │
 │                     │                      │                  │                    │
 │                     │                      │                  │ 5. Read file       │
 │                     │                      │                  ├───────────────────>│
 │                     │                      │                  │    data/abc123.json│
 │                     │                      │                  │                    │
 │                     │                      │                  │ 6. File contents   │
 │                     │                      │                  │<───────────────────┤
 │                     │                      │                  │                    │
 │                     │                      │ 7. Return JSON   │                    │
 │                     │                      │<─────────────────┤                    │
 │                     │                      │                  │                    │
 │                     │ 8. Map state JSON    │                  │                    │
 │                     │<─────────────────────┤                  │                    │
 │                     │                      │                  │                    │
 │ 9. Restore map      │                      │                  │                    │
 │    - Load catalog   │                      │                  │                    │
 │    - Set camera     │                      │                  │                    │
 │    - Add layers     │                      │                  │                    │
 │<────────────────────┤                      │                  │                    │
```

## Component Breakdown

### 1. Client Side (ShareDataService.ts)

**Location:** `node_modules/terriajs/lib/Models/ShareDataService.ts`

**Functions:**

- `getShareToken(shareData)` - Creates a new share
- `resolveData(token)` - Retrieves share data
- `isUsable` - Checks if service is configured

**You don't need to modify this!** It's part of TerriaJS.

### 2. Server Integration (server.js)

**Location:** `./server.js`

**Responsibilities:**

- Import share router
- Mount at `/twin/share`
- Expose serverconfig endpoint
- Handle proxy configuration

**Key additions:**

```javascript
const createShareRouter = require("./lib/share");
const shareRouter = createShareRouter({...});
app.use("/twin/share", shareRouter);
```

### 3. Share Service (lib/share.js)

**Location:** `./lib/share.js`

**Key classes:**

- `ShareDataStore` - Manages file operations
  - `save(content)` - Store share data
  - `resolve(id)` - Retrieve share data
  - `exists(id)` - Check if ID exists
  - `getStats()` - Get statistics

**Key functions:**

- `generateShortId()` - Create content-based ID
- `generateRandomId()` - Create random ID (collision handling)

### 4. Storage Layer

**Location:** `./sharedata/`

**Structure:**

```
sharedata/
├── index.json          # Metadata index
└── data/
    ├── abc123.json     # Share: local-abc123
    ├── def456.json     # Share: local-def456
    └── ...
```

**Each share file contains:**

```json
{
  "version": "8.0.0",
  "initSources": [...],
  "workbench": [...],
  "timeline": {...},
  "camera": {...}
}
```

## Data Flow Example

### Creating a Share

```
1. User adds datasets to map
   └─> Map state = {workbench: [{id: "dataset-1"}, ...]}

2. User clicks "Share" button
   └─> Terria calls ShareDataService.getShareToken()

3. Client POSTs to /twin/share
   POST /twin/share
   Body: {"version": "8.0.0", "workbench": [...]}

4. Server generates ID
   Hash(content) = "a1b2c3d4e5f6g7h8..."
   ID = "a1b2c3d4" (first 8 chars)

5. Server saves to file
   sharedata/data/a1b2c3d4.json

6. Server returns share URL
   {
     "id": "local-a1b2c3d4",
     "url": "http://localhost:3001/twin/share/local-a1b2c3d4"
   }

7. User copies and shares link
```

### Resolving a Share

```
1. User opens share link
   http://localhost:3001/twin/share/local-a1b2c3d4

2. Browser loads Terria app with #share=local-a1b2c3d4

3. Client GETs from server
   GET /twin/share/local-a1b2c3d4

4. Server reads file
   Read: sharedata/data/a1b2c3d4.json

5. Server returns content
   {"version": "8.0.0", "workbench": [...]}

6. Client applies map state
   - Loads catalog items
   - Adds to workbench
   - Sets camera position
   - Restores timeline
```

## ID Generation Strategy

### Content-Based Hashing

```
Input: Share data JSON
  ↓
SHA-256 hash
  ↓
Take first 8 characters
  ↓
ID: "a1b2c3d4"
```

**Benefits:**

- Same content = same ID (deduplication)
- Deterministic
- Collision probability: ~1 in 4 billion

**Collision handling:**

- If ID exists with different content
- Append 4 random characters
- ID becomes: "a1b2c3d4r4nd"

## URL Format

### Full Share URL

```
http://localhost:3001/twin/share/local-abc123
│       │           │    │     │     │      │
│       │           │    │     │     │      └─ Share ID
│       │           │    │     │     └──────── Prefix
│       │           │    │     └────────────── Share endpoint
│       │           │    └──────────────────── App mount path
│       │           └───────────────────────── Port
│       └───────────────────────────────────── Host
└───────────────────────────────────────────── Protocol
```

### Prefix System

Allows multiple storage backends:

- `local-abc123` → File storage
- `g-xyz789` → GitHub Gist (if configured)
- `s3-def456` → AWS S3 (if configured)

Each prefix maps to a storage service in `serverconfig.json`.

## Comparison: Files vs Alternatives

### Storage Backends

```
┌─────────────┬──────────────┬───────────┬───────────┐
│ Feature     │ File-based   │ S3        │ Database  │
├─────────────┼──────────────┼───────────┼───────────┤
│ Setup       │ ★★★★★ Easy   │ ★★☆☆☆     │ ★★★☆☆     │
│ Cost        │ ★★★★★ Free   │ ★★★☆☆     │ ★★☆☆☆     │
│ Scalability │ ★★☆☆☆ Low    │ ★★★★★     │ ★★★★☆     │
│ Reliability │ ★★☆☆☆ Single │ ★★★★★     │ ★★★★☆     │
│ Speed       │ ★★★★☆ Fast   │ ★★★☆☆     │ ★★★★★     │
│ Backup      │ ★★☆☆☆ Manual │ ★★★★★     │ ★★★★☆     │
└─────────────┴──────────────┴───────────┴───────────┘
```

## Best Practices

### 1. Regular Backups

```bash
# Daily backup cron
0 2 * * * tar -czf /backups/sharedata-$(date +\%Y\%m\%d).tar.gz /path/to/sharedata/
```

### 2. Monitor Disk Usage

```bash
# Alert if > 80% full
df -h | awk '$5 > 80 {print "Warning: " $1 " is " $5 " full"}'
```

### 3. Rate Limiting

```javascript
// Prevent abuse
const rateLimit = require("express-rate-limit");
app.use(
  "/twin/share",
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 10 // 10 shares per 15 min
  })
);
```

### 4. Log Monitoring

```bash
# Watch for errors
tail -f server.log | grep "Share:"
```

## Troubleshooting Guide

### Problem: Share creation fails

**Check:**

1. Directory exists: `ls -la sharedata/`
2. Permissions: `chmod 755 sharedata/`
3. Disk space: `df -h`

### Problem: Share resolution fails

**Check:**

1. File exists: `ls sharedata/data/abc123.json`
2. Valid JSON: `jq . sharedata/data/abc123.json`
3. Server logs: `grep "Share:" server.log`

### Problem: Old shares don't work

**Reason:** File-based storage is new

**Solution:**

- Keep old Gist/S3 config alongside new
- OR migrate old shares to file storage

## Performance Metrics

### Expected Performance

- **Create:** ~5-10ms per share
- **Resolve:** ~1-5ms per share
- **Capacity:** 100,000+ shares
- **Disk usage:** ~1-2KB per share

### Bottlenecks

1. **Disk I/O** - Use SSD for better performance
2. **File system limits** - Consider database at >100K shares
3. **Concurrent writes** - Node.js handles this fine

## Security Checklist

- [ ] Enable HTTPS in production
- [ ] Add rate limiting
- [ ] Validate input size (200KB max)
- [ ] Set up regular backups
- [ ] Monitor for abuse
- [ ] Consider authentication
- [ ] Implement cleanup policy

---

**This architecture provides a simple, reliable, and cost-effective solution for share link management in your TerriaMap deployment.**
