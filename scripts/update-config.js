#!/usr/bin/env node
/* jshint node: true */
"use strict";

const fs = require("fs");
const path = require("path");

// Load environment variables from .env file
require("dotenv").config();

// Path to the config files
const configTemplatePath = path.join(
  __dirname,
  "../wwwroot/config.template.json"
);
const configPath = path.join(__dirname, "../wwwroot/config.json");

// Read the template config file
let configContent;
try {
  configContent = fs.readFileSync(configTemplatePath, "utf8");
} catch (error) {
  console.error("Error reading config template file:", error.message);
  process.exit(1);
}

// Replace placeholders with environment variables
const replacements = {
  __CESIUM_ION_ACCESS_TOKEN__: process.env.CESIUM_ION_ACCESS_TOKEN || "",
  __USE_CESIUM_ION_TERRAIN__:
    process.env.USE_CESIUM_ION_TERRAIN === "false" ? false : true,
  __BING_MAPS_KEY__: process.env.BING_MAPS_KEY || ""
};

// Apply replacements
let updatedContent = configContent;
for (const [placeholder, value] of Object.entries(replacements)) {
  const replacementValue = typeof value === "boolean" ? value : `"${value}"`;
  updatedContent = updatedContent.replace(
    new RegExp(`"${placeholder}"`, "g"),
    replacementValue
  );
}

// Write the updated config file
try {
  fs.writeFileSync(configPath, updatedContent, "utf8");
  console.log("Config file updated successfully with environment variables");
} catch (error) {
  console.error("Error writing config file:", error.message);
  process.exit(1);
}
