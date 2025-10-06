#!/usr/bin/env node
/* jshint node: true */
"use strict";

const express = require("express");
const path = require("path");

// Import terriajs-server makeserver
const makeserver = require("terriajs-server/lib/makeserver");
const options = require("terriajs-server/lib/options");

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
