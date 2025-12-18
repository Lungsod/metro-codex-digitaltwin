import { useEffect } from "react";

export const useZoomOverride = (terria) => {
  useEffect(() => {
    let wheelHandler = null;
    let retryTimeouts = [];
    let canvasRetryInterval = null;

    const addZoomOverride = () => {
      // Check if terria.cesium is available
      if (!terria.cesium) {
        console.log("Cesium viewer not available yet, will retry later");
        return false;
      }

      const viewer = terria.cesium;

      // Check if viewer.scene is available
      if (!viewer.scene) {
        console.log("Cesium scene not available yet, will retry later");
        return false;
      }

      const scene = viewer.scene;
      const screenSpaceCameraController = scene.screenSpaceCameraController;

      if (screenSpaceCameraController) {
        // Store the original handleZoom function
        const originalHandleZoom = screenSpaceCameraController._handleZoom;

        // Override the zoom handling to disable Ctrl key
        screenSpaceCameraController._handleZoom = function (movement) {
          // If Ctrl key is pressed, remove the ctrlKey property and allow normal zoom
          if (movement && movement.event && movement.event.ctrlKey) {
            // Create a copy of the movement object without ctrlKey
            const modifiedMovement = {
              ...movement,
              event: {
                ...movement.event,
                ctrlKey: false // Disable Ctrl key behavior
              }
            };

            // Call original handleZoom with modified movement (no Ctrl key)
            if (originalHandleZoom) {
              return originalHandleZoom.call(this, modifiedMovement);
            }
          }

          // Call original handleZoom for normal zoom (no Ctrl key)
          if (originalHandleZoom) {
            return originalHandleZoom.call(this, movement);
          }
        };

        // Also override wheel event handling for mouse wheel zoom
        const waitForCanvas = () => {
          // Use the correct canvas property
          const canvas = viewer.scene.canvas;
          console.log("Canvas check:", canvas);

          if (canvas) {
            wheelHandler = function (e) {
              if (e.ctrlKey) {
                // Prevent the default browser behavior (like zoom) but allow Cesium to handle it
                e.preventDefault();
                // Create a new event without ctrlKey for Cesium to handle
                const newEvent = new WheelEvent("wheel", {
                  deltaX: e.deltaX,
                  deltaY: e.deltaY * 2,
                  deltaZ: e.deltaZ,
                  deltaMode: e.deltaMode,
                  clientX: e.clientX,
                  clientY: e.clientY,
                  ctrlKey: false, // Disable Ctrl key
                  shiftKey: e.shiftKey,
                  altKey: e.altKey,
                  metaKey: e.metaKey
                });
                // Dispatch the modified event to Cesium
                canvas.dispatchEvent(newEvent);
              }
            };

            canvas.addEventListener("wheel", wheelHandler, { passive: false });
            console.log("Wheel event listener added to canvas");
            return true;
          }
          return false;
        };

        // Try to add the wheel event listener immediately, and retry if needed
        if (!waitForCanvas()) {
          console.log("Canvas not available, will retry...");
          canvasRetryInterval = setInterval(() => {
            if (waitForCanvas()) {
              clearInterval(canvasRetryInterval);
              canvasRetryInterval = null;
            }
          }, 500);

          // Clear the interval after 10 seconds to prevent infinite retry
          setTimeout(() => {
            if (canvasRetryInterval) {
              clearInterval(canvasRetryInterval);
              canvasRetryInterval = null;
              console.log("Canvas retry timeout reached");
            }
          }, 10000);
        }

        console.log("Ctrl key zoom override successfully applied");
        return true;
      }

      return false;
    };

    // Function to try adding the override with retries
    const tryAddZoomOverride = (attempt = 1, maxAttempts = 10) => {
      if (addZoomOverride()) {
        // Success, no need to retry
        return;
      }

      if (attempt < maxAttempts) {
        // Try again after a delay
        const delay = attempt * 1000; // Increasing delay: 1s, 2s, 3s, etc.
        console.log(
          `Retrying zoom override (attempt ${attempt}/${maxAttempts}) in ${delay}ms`
        );
        const timeout = setTimeout(
          () => tryAddZoomOverride(attempt + 1, maxAttempts),
          delay
        );
        retryTimeouts.push(timeout);
      } else {
        console.warn("Failed to apply zoom override after maximum attempts");
      }
    };

    // Start trying to add the override after component mounts
    tryAddZoomOverride();

    // Cleanup function to remove event listeners and clear timeouts
    return () => {
      // Clear any pending retry timeouts
      retryTimeouts.forEach((timeout) => clearTimeout(timeout));
      retryTimeouts = [];

      // Clear the canvas retry interval
      if (canvasRetryInterval) {
        clearInterval(canvasRetryInterval);
        canvasRetryInterval = null;
      }

      // Remove the wheel event listener if it was added
      if (
        wheelHandler &&
        terria.cesium &&
        terria.cesium.scene &&
        terria.cesium.scene.canvas
      ) {
        terria.cesium.scene.canvas.removeEventListener("wheel", wheelHandler);
      }
    };
  }, [terria]);
};
