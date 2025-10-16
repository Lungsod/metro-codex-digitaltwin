# Quick Start Guide - Share Link Service

## Setup (1 minute)

The share link service is already integrated! No additional installation needed.

### 1. Start the Terria Server

```bash
node server.js
```

The share service is automatically available at `/twin/share`.

### 2. Test It

#### Create a share link:

```bash
curl -X POST http://localhost:3001/twin/share \
  -H "Content-Type: application/json" \
  -d '{"test": "data", "workbench": []}'
```

Response:

```json
{
  "id": "local-abc12345",
  "path": "/twin/share/local-abc12345",
  "url": "http://localhost:3001/twin/share/local-abc12345"
}
```

#### Retrieve the share link:

```bash
curl http://localhost:3001/twin/share/local-abc12345
```

Response:

```json
{ "test": "data", "workbench": [] }
```

### 3. Use in Terria

The share button in the Terria UI will automatically use this service. Just click "Share" and copy the link!

## Bonus: Standalone URL Shortener

### Start the URL Shortener

```bash
node url-shortener.js
```

### Use It

1. Open your browser to: `http://localhost:3002`
2. Enter any long URL
3. Get a short link
4. View all links at: `http://localhost:3002/admin/urls`

## File Structure

After creating share links, you'll see:

```
metro-codex/
├── sharedata/              # Terria share data
│   ├── index.json          # Metadata
│   └── data/
│       └── *.json          # Individual shares
└── url-data/               # URL shortener data (if using)
    └── urls.json           # URL database
```

## Configuration

All configuration is already set in `serverconfig.json`:

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

## That's It!

You're ready to use share links. See `SHARE_SERVICE_README.md` for detailed documentation.
