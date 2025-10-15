#!/usr/bin/env node
/* jshint node: true */
"use strict";

/**
 * Standalone URL Shortener Application
 *
 * A simple Express server that provides URL shortening services
 * with a web interface. Can be used independently or alongside
 * the Terria server.
 */

const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs").promises;
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3002;
const STORAGE_DIR = process.env.STORAGE_DIR || path.join(__dirname, "url-data");

// URL storage class
class URLShortener {
  constructor(storageDir) {
    this.storageDir = storageDir;
    this.dbFile = path.join(storageDir, "urls.json");
    this.urls = new Map();
  }

  async init() {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });

      // Load existing URLs
      try {
        const data = await fs.readFile(this.dbFile, "utf8");
        const urlData = JSON.parse(data);
        this.urls = new Map(Object.entries(urlData));
        console.log(`Loaded ${this.urls.size} URLs from database`);
      } catch (error) {
        if (error.code !== "ENOENT") {
          console.error("Error loading URL database:", error);
        }
        // File doesn't exist yet, that's okay
      }
    } catch (error) {
      console.error("Failed to initialize URL shortener:", error);
      throw error;
    }
  }

  generateId(url, length = 6) {
    const hash = crypto.createHash("sha256").update(url).digest("hex");
    return hash.substring(0, length);
  }

  generateRandomId(length = 6) {
    const chars =
      "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let result = "";
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }
    return result;
  }

  async shortenUrl(longUrl, customId = null) {
    // Check if URL already exists
    for (const [id, data] of this.urls.entries()) {
      if (data.url === longUrl) {
        return id;
      }
    }

    // Generate or use custom ID
    let id = customId || this.generateId(longUrl);

    // Handle collisions
    if (this.urls.has(id)) {
      if (customId) {
        throw new Error("Custom ID already in use");
      }
      id = this.generateRandomId(8);
    }

    // Store the URL
    this.urls.set(id, {
      url: longUrl,
      created: new Date().toISOString(),
      clicks: 0
    });

    await this.save();
    return id;
  }

  async resolveUrl(id) {
    const data = this.urls.get(id);
    if (!data) {
      return null;
    }

    // Increment click counter
    data.clicks++;
    await this.save();

    return data.url;
  }

  async getStats(id) {
    return this.urls.get(id) || null;
  }

  async getAllUrls() {
    return Array.from(this.urls.entries()).map(([id, data]) => ({
      id,
      ...data
    }));
  }

  async save() {
    try {
      const urlData = Object.fromEntries(this.urls);
      await fs.writeFile(this.dbFile, JSON.stringify(urlData, null, 2));
    } catch (error) {
      console.error("Failed to save URL database:", error);
    }
  }

  async deleteUrl(id) {
    const existed = this.urls.delete(id);
    if (existed) {
      await this.save();
    }
    return existed;
  }
}

// Initialize the shortener
const shortener = new URLShortener(STORAGE_DIR);

// Middleware
app.set("trust proxy", true);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "url-public")));

// Routes

// Home page
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>URL Shortener</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            padding: 40px;
            max-width: 600px;
            width: 100%;
        }
        h1 {
            color: #667eea;
            margin-bottom: 10px;
            font-size: 2.5em;
        }
        .subtitle {
            color: #666;
            margin-bottom: 30px;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            color: #333;
            margin-bottom: 8px;
            font-weight: 500;
        }
        input[type="text"], input[type="url"] {
            width: 100%;
            padding: 12px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.3s;
        }
        input[type="text"]:focus, input[type="url"]:focus {
            outline: none;
            border-color: #667eea;
        }
        button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 14px 30px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            width: 100%;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4);
        }
        button:active {
            transform: translateY(0);
        }
        .result {
            margin-top: 30px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
            display: none;
        }
        .result.show {
            display: block;
        }
        .result h3 {
            color: #667eea;
            margin-bottom: 15px;
        }
        .short-url {
            display: flex;
            gap: 10px;
            align-items: center;
        }
        .short-url input {
            flex: 1;
        }
        .copy-btn {
            width: auto;
            padding: 12px 20px;
        }
        .error {
            color: #e74c3c;
            margin-top: 10px;
            display: none;
        }
        .error.show {
            display: block;
        }
        .stats-link {
            margin-top: 20px;
            text-align: center;
        }
        .stats-link a {
            color: #667eea;
            text-decoration: none;
            font-weight: 500;
        }
        .stats-link a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔗 URL Shortener</h1>
        <p class="subtitle">Create short, memorable links</p>
        
        <form id="shortenForm">
            <div class="form-group">
                <label for="longUrl">Long URL *</label>
                <input type="url" id="longUrl" name="longUrl" placeholder="https://example.com/very/long/url" required>
            </div>
            
            <div class="form-group">
                <label for="customId">Custom Short ID (optional)</label>
                <input type="text" id="customId" name="customId" placeholder="my-custom-link" pattern="[a-zA-Z0-9_-]*">
                <small style="color: #666;">Leave empty for auto-generated ID. Only letters, numbers, hyphens, and underscores allowed.</small>
            </div>
            
            <button type="submit">Shorten URL</button>
        </form>
        
        <div class="error" id="error"></div>
        
        <div class="result" id="result">
            <h3>✅ Your shortened URL:</h3>
            <div class="short-url">
                <input type="text" id="shortUrl" readonly>
                <button class="copy-btn" onclick="copyToClipboard()">Copy</button>
            </div>
        </div>
        
        <div class="stats-link">
            <a href="/admin/urls">View all URLs</a>
        </div>
    </div>

    <script>
        const form = document.getElementById('shortenForm');
        const result = document.getElementById('result');
        const error = document.getElementById('error');
        const shortUrlInput = document.getElementById('shortUrl');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            error.classList.remove('show');
            result.classList.remove('show');
            
            const longUrl = document.getElementById('longUrl').value;
            const customId = document.getElementById('customId').value;
            
            try {
                const response = await fetch('/api/shorten', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        url: longUrl,
                        customId: customId || undefined
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    shortUrlInput.value = data.shortUrl;
                    result.classList.add('show');
                } else {
                    error.textContent = data.error || 'Failed to shorten URL';
                    error.classList.add('show');
                }
            } catch (err) {
                error.textContent = 'Network error: ' + err.message;
                error.classList.add('show');
            }
        });
        
        function copyToClipboard() {
            shortUrlInput.select();
            document.execCommand('copy');
            
            const btn = event.target;
            const originalText = btn.textContent;
            btn.textContent = '✓ Copied!';
            setTimeout(() => {
                btn.textContent = originalText;
            }, 2000);
        }
    </script>
</body>
</html>
  `);
});

// API: Shorten URL
app.post("/api/shorten", async (req, res) => {
  try {
    const { url, customId } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: "Invalid URL format" });
    }

    const id = await shortener.shortenUrl(url, customId);
    const protocol = req.protocol;
    const host = req.get("host");
    const shortUrl = `${protocol}://${host}/${id}`;

    res.json({
      id,
      shortUrl,
      longUrl: url
    });
  } catch (error) {
    console.error("Shorten error:", error);
    res.status(500).json({ error: error.message });
  }
});

// API: Get all URLs (admin)
app.get("/admin/urls", async (req, res) => {
  try {
    const urls = await shortener.getAllUrls();
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>All URLs - URL Shortener</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #f5f5f5;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        h1 {
            color: #667eea;
            margin-bottom: 20px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e0e0e0;
        }
        th {
            background: #667eea;
            color: white;
            font-weight: 600;
        }
        tr:hover {
            background: #f8f9fa;
        }
        .short-id {
            font-family: monospace;
            background: #e3f2fd;
            padding: 4px 8px;
            border-radius: 4px;
            color: #1976d2;
        }
        .delete-btn {
            background: #e74c3c;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
        }
        .delete-btn:hover {
            background: #c0392b;
        }
        .back-link {
            display: inline-block;
            margin-bottom: 20px;
            color: #667eea;
            text-decoration: none;
        }
        .back-link:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <a href="/" class="back-link">← Back to Home</a>
        <h1>All Shortened URLs (${urls.length})</h1>
        <table>
            <thead>
                <tr>
                    <th>Short ID</th>
                    <th>Long URL</th>
                    <th>Created</th>
                    <th>Clicks</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${urls
                  .map(
                    (u) => `
                    <tr>
                        <td><span class="short-id">${u.id}</span></td>
                        <td><a href="${u.url}" target="_blank">${u.url}</a></td>
                        <td>${new Date(u.created).toLocaleString()}</td>
                        <td>${u.clicks}</td>
                        <td>
                            <button class="delete-btn" onclick="deleteUrl('${u.id}')">Delete</button>
                        </td>
                    </tr>
                `
                  )
                  .join("")}
            </tbody>
        </table>
    </div>
    <script>
        async function deleteUrl(id) {
            if (!confirm('Are you sure you want to delete this URL?')) return;
            
            try {
                const response = await fetch('/api/url/' + id, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    location.reload();
                } else {
                    alert('Failed to delete URL');
                }
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }
    </script>
</body>
</html>
    `);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Delete URL
app.delete("/api/url/:id", async (req, res) => {
  try {
    const deleted = await shortener.deleteUrl(req.params.id);
    if (deleted) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "URL not found" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Redirect short URL to long URL
app.get("/:id", async (req, res) => {
  try {
    const longUrl = await shortener.resolveUrl(req.params.id);

    if (longUrl) {
      res.redirect(longUrl);
    } else {
      res.status(404).send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>404 - URL Not Found</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
            text-align: center;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 60px 40px;
            max-width: 500px;
        }
        h1 {
            font-size: 4em;
            color: #667eea;
            margin-bottom: 20px;
        }
        p {
            color: #666;
            font-size: 1.2em;
            margin-bottom: 30px;
        }
        a {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            padding: 14px 30px;
            border-radius: 8px;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>404</h1>
        <p>Sorry, this short URL doesn't exist.</p>
        <a href="/">Create a new short URL</a>
    </div>
</body>
</html>
      `);
    }
  } catch (error) {
    console.error("Redirect error:", error);
    res.status(500).send("Internal server error");
  }
});

// Start server
shortener
  .init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`URL Shortener running at http://localhost:${PORT}`);
      console.log(`Storage directory: ${STORAGE_DIR}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
