/* jshint node: true */
"use strict";

const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");

/**
 * Simple file-based share data service for Terria
 * This provides an alternative to GitHub Gists or S3 for storing share data
 */

// Generate a short hash from content
function generateShortId(content, length = 8) {
  const hash = crypto.createHash("sha256").update(content).digest("hex");
  return hash.substring(0, length);
}

// Generate a random ID (for collision avoidance)
function generateRandomId(length = 8) {
  const chars =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

class ShareDataStore {
  constructor(storageDir) {
    this.storageDir = storageDir;
    this.indexFile = path.join(storageDir, "index.json");
    this.dataDir = path.join(storageDir, "data");
  }

  async init() {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      await fs.mkdir(this.dataDir, { recursive: true });

      // Create index file if it doesn't exist
      try {
        await fs.access(this.indexFile);
      } catch {
        await fs.writeFile(this.indexFile, JSON.stringify({}));
      }
    } catch (error) {
      console.error("Failed to initialize share data store:", error);
      throw error;
    }
  }

  async save(content) {
    try {
      // Generate ID based on content hash
      let id = generateShortId(content);

      // Check for collision (very unlikely but possible)
      const exists = await this.exists(id);
      if (exists) {
        // If collision, append random chars
        id = id + generateRandomId(4);
      }

      // Save data to file
      const dataFile = path.join(this.dataDir, `${id}.json`);
      await fs.writeFile(dataFile, content, "utf8");

      // Update index
      await this.updateIndex(id, {
        created: new Date().toISOString(),
        size: content.length
      });

      console.log(`Share: Created ID ${id}`);
      return id;
    } catch (error) {
      console.error("Failed to save share data:", error);
      throw error;
    }
  }

  async resolve(id) {
    try {
      const dataFile = path.join(this.dataDir, `${id}.json`);
      const content = await fs.readFile(dataFile, "utf8");
      console.log(`Share: Retrieved ID ${id}`);
      return content;
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error(`Share ID not found: ${id}`);
      }
      console.error("Failed to resolve share data:", error);
      throw error;
    }
  }

  async exists(id) {
    try {
      const dataFile = path.join(this.dataDir, `${id}.json`);
      await fs.access(dataFile);
      return true;
    } catch {
      return false;
    }
  }

  async updateIndex(id, metadata) {
    try {
      const indexContent = await fs.readFile(this.indexFile, "utf8");
      const index = JSON.parse(indexContent);
      index[id] = metadata;
      await fs.writeFile(this.indexFile, JSON.stringify(index, null, 2));
    } catch (error) {
      console.warn("Failed to update index:", error);
      // Non-critical, continue anyway
    }
  }

  async getStats() {
    try {
      const indexContent = await fs.readFile(this.indexFile, "utf8");
      const index = JSON.parse(indexContent);
      return {
        count: Object.keys(index).length,
        entries: index
      };
    } catch {
      return { count: 0, entries: {} };
    }
  }
}

/**
 * Create the share router
 * @param {Object} options - Configuration options
 * @param {string} options.storageDir - Directory to store share data
 * @param {string} options.prefix - URL prefix for share links (default: 'local')
 * @param {string} options.maxRequestSize - Max size for share data (default: '200kb')
 * @param {number} options.port - Server port (for generating full URLs)
 * @returns {express.Router} Express router
 */
module.exports = function createShareRouter(options = {}) {
  const storageDir =
    options.storageDir || path.join(__dirname, "..", "sharedata");
  const prefix = options.prefix || "local";
  const maxRequestSize = options.maxRequestSize || "200kb";
  const port = options.port || 3001;

  const store = new ShareDataStore(storageDir);

  // Initialize store
  store.init().catch((error) => {
    console.error("Failed to initialize share data store:", error);
  });

  const router = express.Router();

  // Parse request body as text
  router.use(
    bodyParser.text({
      type: "*/*",
      limit: maxRequestSize
    })
  );

  // POST /share - Create a new share
  router.post("/", async (req, res) => {
    try {
      if (!req.body) {
        return res.status(400).json({
          message: "Request body is required"
        });
      }

      const id = await store.save(req.body);
      const fullId = `${prefix}-${id}`;
      const resPath = `${req.baseUrl}/${fullId}`;

      // Construct full URL
      // Handle both direct connections and proxy setups
      const protocol = req.protocol;
      const hostname = req.hostname;
      const portPart =
        req.get("X-Forwarded-Port") ||
        (port && port !== 80 && port !== 443 ? `:${port}` : "");
      const resUrl = `${protocol}://${hostname}${portPart}${resPath}`;

      res.location(resUrl).status(201).json({
        id: fullId,
        path: resPath,
        url: resUrl
      });
    } catch (error) {
      console.error("Share creation error:", error);
      res.status(500).json({
        message: "Failed to create share link",
        error: error.message
      });
    }
  });

  // GET /share/:id - Resolve a share by ID
  router.get("/:id", async (req, res) => {
    try {
      const fullId = req.params.id;

      // Strip prefix if present
      const prefixPattern = new RegExp(`^${prefix}-`);
      const id = fullId.replace(prefixPattern, "");

      const content = await store.resolve(id);

      // Set appropriate headers
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "public, max-age=31536000"); // Cache for 1 year
      res.send(content);
    } catch (error) {
      console.error("Share resolution error:", error);

      if (error.message.includes("not found")) {
        res.status(404).json({
          message: "Share link not found",
          error: error.message
        });
      } else {
        res.status(500).json({
          message: "Failed to resolve share link",
          error: error.message
        });
      }
    }
  });

  // GET /share/stats - Get statistics (optional, for debugging)
  router.get("/admin/stats", async (req, res) => {
    try {
      const stats = await store.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({
        message: "Failed to get stats",
        error: error.message
      });
    }
  });

  return router;
};
