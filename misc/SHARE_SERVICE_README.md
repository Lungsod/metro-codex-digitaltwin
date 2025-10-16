# Share Link Service Implementation

This document describes the share link service implementation for the Metro Codex Digital Twin (TerriaMap fork).

## Overview

The share link service provides URL shortening for Terria map states, similar to what terriajs-server does but with a file-based storage backend instead of GitHub Gists or AWS S3.

## Architecture

### Components

1. **`lib/share.js`** - Share service module
   - File-based storage using JSON
   - Generates short IDs based on content hash
   - Provides REST API for creating and resolving share links
2. **`server.js`** - Main server integration
   - Mounts share router at `/twin/share`
   - Exposes serverconfig endpoint
3. **`url-shortener.js`** - Standalone URL shortener (bonus)
   - Complete web application with UI
   - Can shorten any URL (not just Terria states)
   - Includes admin interface

## File-Based Storage

Share data is stored in the `sharedata/` directory:

```
sharedata/
├── index.json          # Metadata index (created date, size, etc.)
└── data/
    ├── abc123.json     # Individual share files
    ├── def456.json
    └── ...
```

## API Endpoints

### Create Share Link

```http
POST /twin/share
Content-Type: text/plain

{Terria map state JSON}
```

**Response:**

```json
{
  "id": "local-abc123",
  "path": "/twin/share/local-abc123",
  "url": "http://localhost:3001/twin/share/local-abc123"
}
```

### Resolve Share Link

```http
GET /twin/share/local-abc123
```

**Response:** The original Terria map state JSON

### Server Configuration

```http
GET /twin/serverconfig
```

**Response:**

```json
{
  "newShareUrlPrefix": "local",
  "shareUrlPrefixes": {
    "local": {
      "service": "file"
    }
  }
}
```

## Configuration

### `serverconfig.json`

```json
{
  "port": 3001,
  "newShareUrlPrefix": "local",
  "shareUrlPrefixes": {
    "local": {
      "service": "file"
    }
  }
}
```

### Client Configuration (`wwwroot/config.json`)

The client should have:

```json
{
  "parameters": {
    "shortenShareUrls": true
  }
}
```

## How It Works

### Share Link Creation Flow

1. User clicks "Share" in Terria
2. Client (`ShareDataService.ts`) sends POST to `/twin/share` with map state
3. Server generates ID: `SHA256(content).substring(0, 8)`
4. Saves JSON to `sharedata/data/{id}.json`
5. Returns short URL: `http://localhost:3001/twin/share/local-{id}`

### Share Link Resolution Flow

1. User opens share link
2. Client extracts ID from URL
3. Client fetches `/twin/share/local-{id}`
4. Server reads from `sharedata/data/{id}.json`
5. Client applies the map state

## Standalone URL Shortener

A bonus standalone application is provided in `url-shortener.js`.

### Features

- Beautiful web UI for creating short URLs
- Supports custom short IDs
- Click tracking
- Admin interface to view all URLs
- Works with any URL (not just Terria)

### Running

```bash
# Default (port 3002)
node url-shortener.js

# Custom port
PORT=4000 node url-shortener.js

# Custom storage directory
STORAGE_DIR=/path/to/data node url-shortener.js
```

### Usage

1. Open http://localhost:3002
2. Enter a long URL
3. Optionally specify a custom short ID
4. Click "Shorten URL"
5. Copy and share the short link

### Admin Interface

View all shortened URLs at: http://localhost:3002/admin/urls

## Running the Services

### Main Terria Server (with share service)

```bash
node server.js
```

The share service is automatically available at:

- http://localhost:3001/twin/share

### Standalone URL Shortener

```bash
node url-shortener.js
```

Access at:

- http://localhost:3002

Both can run simultaneously on different ports.

## Security Considerations

### Current Implementation

- **No authentication** - Anyone can create share links
- **File-based storage** - Simple but not suitable for high-traffic
- **No rate limiting** - Could be abused

### Production Recommendations

1. **Add authentication** for POST endpoints
2. **Implement rate limiting** (e.g., express-rate-limit)
3. **Add storage limits** per user/IP
4. **Consider database backend** (MongoDB, PostgreSQL) for scale
5. **Add HTTPS** in production
6. **Implement cleanup** for old/unused links

Example rate limiting:

```javascript
const rateLimit = require("express-rate-limit");

const createShareLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: "Too many share links created, please try again later"
});

app.post("/twin/share", createShareLimiter, shareRouter);
```

## Advantages Over GitHub Gists / S3

### Pros

- ✅ No external dependencies
- ✅ No API keys required
- ✅ Free and unlimited
- ✅ Complete control over data
- ✅ Works offline/air-gapped environments
- ✅ Simple to deploy

### Cons

- ❌ Not suitable for high-traffic production
- ❌ No built-in redundancy
- ❌ Requires filesystem access
- ❌ Manual backup required
- ❌ Limited by disk space

## Migration from GitHub Gists

If you have existing Gist-based share links, you can add support alongside the file-based storage:

```json
{
  "newShareUrlPrefix": "local",
  "shareUrlPrefixes": {
    "local": {
      "service": "file"
    },
    "g": {
      "service": "gist",
      "accessToken": "your-github-token"
    }
  }
}
```

Old Gist links (`/share/g-{id}`) will still work, new links use local storage.

## Backup and Restore

### Backup

```bash
# Backup share data
tar -czf sharedata-backup-$(date +%Y%m%d).tar.gz sharedata/

# Backup URL shortener data
tar -czf url-data-backup-$(date +%Y%m%d).tar.gz url-data/
```

### Restore

```bash
# Restore share data
tar -xzf sharedata-backup-20231015.tar.gz

# Restore URL shortener data
tar -xzf url-data-backup-20231015.tar.gz
```

## Monitoring

### Check Share Link Count

```bash
ls -1 sharedata/data/*.json | wc -l
```

### Check Storage Size

```bash
du -sh sharedata/
```

### View Recent Shares

```bash
cat sharedata/index.json | jq 'to_entries | sort_by(.value.created) | reverse | .[0:5]'
```

## Troubleshooting

### Share Links Not Working

1. **Check server is running:**

   ```bash
   curl http://localhost:3001/twin/serverconfig
   ```

2. **Check share directory exists:**

   ```bash
   ls -la sharedata/
   ```

3. **Check server logs** for errors

### Cannot Create Share Links

1. **Check directory permissions:**

   ```bash
   chmod -R 755 sharedata/
   ```

2. **Check disk space:**

   ```bash
   df -h
   ```

3. **Check request size** - Default limit is 200kb

### Old Share Links Don't Work

- File-based storage is not retroactive
- Old Gist/S3 links need migration
- Consider keeping multiple storage backends

## Future Enhancements

Potential improvements:

1. **Database backend** (PostgreSQL, MongoDB)
2. **Redis caching** for frequently accessed links
3. **Custom domain** support
4. **QR code generation** for share links
5. **Analytics dashboard** (views, geographic data)
6. **Link expiration** (auto-delete after X days)
7. **Password protection** for sensitive shares
8. **Backup automation** (cron job)
9. **Multi-server sync** (for load balancing)
10. **API key authentication** for programmatic access

## License

Same as TerriaMap/TerriaJS - Apache 2.0

## Support

For issues or questions:

- Check server logs: `node server.js`
- Check browser console for client errors
- Verify API endpoints with curl/Postman
- Review this documentation

---

**Note:** This implementation is suitable for development, testing, and low-to-medium traffic production use. For high-traffic production deployments, consider using AWS S3, Google Cloud Storage, or a dedicated database backend.
