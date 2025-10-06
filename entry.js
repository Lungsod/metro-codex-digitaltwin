const logoGif = require("./lib/Styles/loading.gif");
import "./lib/Styles/loader.css";

async function loadMainScript() {
  return import("terriajs/lib/Core/prerequisites")
    .then(() => import("./index"))
    .then(({ default: terriaPromise }) => terriaPromise);
}

function createLoader() {
  const loaderDiv = document.createElement("div");
  loaderDiv.classList.add("loader-ui");
  const loaderGif = document.createElement("img");
  loaderGif.src = logoGif;
  loaderDiv.appendChild(loaderGif);

  document.body.appendChild(loaderDiv);

  loadMainScript()
    .then(() => {
      // Import and call renderUi to mount the React app
      return import("./lib/Views/render").then(({ renderUi }) => {
        renderUi();
      });
    })
    .catch((err) => {
      console.error("Error loading main script:", err);
    })
    .finally(() => {
      loaderDiv.classList.add("loader-ui-hide");
      setTimeout(() => {
        document.body.removeChild(loaderDiv);
      }, 2000);
    });
}

createLoader();
