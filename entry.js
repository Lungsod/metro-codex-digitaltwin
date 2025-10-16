import React from "react";
import { createRoot } from "react-dom/client";
import { Loader } from "./lib/Views/Loader";

async function loadMainScript() {
  return import("terriajs/lib/Core/prerequisites")
    .then(() => import("./index"))
    .then(({ default: terriaPromise }) => terriaPromise);
}

function createLoader() {
  // Show the Loader component while loading
  const container = document.getElementById("ui");
  if (!container) {
    console.error("Container element with id 'ui' not found.");
    return;
  }

  // Create root once and reuse it
  const root = createRoot(container);
  root.render(<Loader />);

  loadMainScript()
    .then(() => {
      // Import and call renderUi to mount the React app, passing the existing root
      return import("./lib/Views/render").then(({ renderUi }) => {
        renderUi(root);
      });
    })
    .catch((err) => {
      console.error("Error loading main script:", err);
    });
}

createLoader();
