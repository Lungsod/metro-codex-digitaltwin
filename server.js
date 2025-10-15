#!/usr/bin/env node
/* jshint node: true */
"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");

// Import terriajs-server makeserver
const makeserver = require("terriajs-server/lib/makeserver");
const options = require("terriajs-server/lib/options");

// Import our custom share service
const createShareRouter = require("./server/lib/share");

// Initialize options from serverconfig.json
options.init(false);

console.log(
  'Serving directory "' +
    options.wwwroot +
    '" on port ' +
    options.port +
    " at path /twin"
);

// Create the terriajs server
const terriaApp = makeserver(options);

// Create a wrapper Express app
const app = express();

// Trust proxy - important for reverse proxy setups
app.set("trust proxy", true);

// Add logging middleware to debug requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - Original URL: ${req.originalUrl}`);
  next();
});

// Serve language override files from wwwroot/languages
app.use(
  "/twin/languages",
  express.static(path.join(options.wwwroot, "languages"), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".json")) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Access-Control-Allow-Origin", "*");
      }
    }
  })
);

// Serve TerriaJS language files from node_modules
app.use(
  "/twin/build/TerriaJS/languages",
  express.static(
    path.join(__dirname, "node_modules", "terriajs", "wwwroot", "languages"),
    {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".json")) {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Access-Control-Allow-Origin", "*");
        }
      }
    }
  )
);

// Serve TerriaJS build files (Cesium assets, etc.)
app.use(
  "/twin/build/TerriaJS/build",
  express.static(
    path.join(__dirname, "node_modules", "terriajs", "wwwroot", "build"),
    {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".json")) {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
        }
      }
    }
  )
);

// Mount the share service
const shareRouter = createShareRouter({
  storageDir: path.join(__dirname, "sharedata"),
  prefix: "l",
  maxRequestSize: "1000kb",
  port: options.port
});
app.use("/twin/share", shareRouter);

// Expose server configuration (needed by ShareDataService on client)
app.get("/twin/serverconfig", (req, res) => {
  res.json({
    newShareUrlPrefix: "l",
    shareUrlPrefixes: {
      l: {
        service: "file"
      }
    }
  });
});

// Mount the terria app at /twin
app.use("/twin", terriaApp);

// Redirect root to /twin
app.get("/", (req, res) => {
  res.redirect("/twin");
});

// Start the server
const server = app.listen(options.port, options.listenHost, () => {
  console.log(
    `Server running at http://${options.listenHost || "localhost"}:${options.port}/twin`
  );
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${options.port} is already in use`);
    process.exit(1);
  } else {
    console.error(err);
  }
});
