/**
 * TerrainClamp - A utility to clamp 3D tiles to terrain height
 * This solves the issue where 3D tiles appear under terrain in 3D terrain mode
 */

import Cesium3DTileset from "terriajs-cesium/Source/Scene/Cesium3DTileset.js";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3.js";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic.js";
import Matrix4 from "terriajs-cesium/Source/Core/Matrix4.js";
import defined from "terriajs-cesium/Source/Core/defined.js";

// Debug logging function
const debugLog = (message, ...args) => {
  if (window.console) {
    window.console.log(message, ...args);
  }
};

// Debug warning function
const debugWarn = (message, ...args) => {
  if (window.console) {
    window.console.warn(message, ...args);
  }
};

// Debug error function
const debugError = (message, ...args) => {
  if (window.console) {
    window.console.error(message, ...args);
  }
};

/**
 * Creates a clamped 3D tileset that adjusts its height to match terrain
 * @param {string|Resource} url - The URL to the tileset JSON file
 * @param {Object} options - Options for the tileset
 * @param {Scene} options.scene - The Cesium scene (required for clamping)
 * @param {number} [options.heightOffset=0] - Additional height offset after clamping
 * @param {boolean} [options.enableClamping=true] - Whether to enable terrain clamping
 * @returns {Promise<Cesium3DTileset>} - A promise that resolves to the clamped tileset
 */
export async function createClampedTileset(url, options = {}) {
  // Debug: Log function call
  debugLog(
    "[createClampedTileset] Starting with URL:",
    url,
    "options:",
    options
  );

  const {
    scene,
    heightOffset = 0,
    enableClamping = true,
    ...tilesetOptions
  } = options;

  if (!defined(scene) && enableClamping) {
    debugWarn(
      "[createClampedTileset] Scene is required for terrain clamping. Clamping will be disabled."
    );
  }

  // Create the base tileset
  debugLog("[createClampedTileset] Creating tileset...");
  const tileset = await Cesium3DTileset.fromUrl(url, tilesetOptions);
  debugLog("[createClampedTileset] Tileset created:", tileset);

  if (!enableClamping || !defined(scene)) {
    debugLog(
      "[createClampedTileset] Clamping disabled, returning unmodified tileset"
    );
    return tileset;
  }

  // Wait for the tileset to be ready
  debugLog("[createClampedTileset] Waiting for tileset to be ready...");
  await tileset.readyPromise;
  debugLog("[createClampedTileset] Tileset is ready");

  // Apply terrain clamping
  debugLog("[createClampedTileset] Applying terrain clamping...");
  await applyTerrainClamping(tileset, scene, heightOffset);

  // Set up continuous height updates if needed
  setupHeightUpdates(tileset, scene, heightOffset);

  debugLog("[createClampedTileset] Terrain clamping complete");
  return tileset;
}

/**
 * Applies terrain clamping to a tileset by adjusting its model matrix
 * @param {Cesium3DTileset} tileset - The tileset to clamp
 * @param {Scene} scene - The Cesium scene
 * @param {number} heightOffset - Additional height offset
 */
export async function applyTerrainClamping(tileset, scene, heightOffset) {
  // Debug: Log function call
  debugLog("[applyTerrainClamping] Starting terrain clamping");

  // Check if scene is valid and initialized
  if (!scene) {
    debugWarn(
      "[applyTerrainClamping] Scene is not available or not initialized"
    );
    return;
  }

  // Check if clampToHeight is supported
  if (!scene.clampToHeightSupported) {
    debugWarn(
      "[applyTerrainClamping] clampToHeight is not supported in this scene"
    );
    return;
  }

  try {
    // Get the tileset's bounding sphere
    const boundingSphere = tileset.boundingSphere;
    if (!boundingSphere) {
      debugWarn(
        "[applyTerrainClamping] Tileset does not have a bounding sphere"
      );
      return;
    }

    const center = boundingSphere.center;

    debugLog("[applyTerrainClamping] Tileset center:", center);
    debugLog(
      "[applyTerrainClamping] Scene clampToHeightSupported:",
      scene.clampToHeightSupported
    );

    // Sample multiple points around the tileset for better accuracy
    const samplePoints = [
      center,
      // Add points around the center
      Cartesian3.fromDegrees(
        Cartographic.fromCartesian(center).longitude + 0.0001,
        Cartographic.fromCartesian(center).latitude
      ),
      Cartesian3.fromDegrees(
        Cartographic.fromCartesian(center).longitude - 0.0001,
        Cartographic.fromCartesian(center).latitude
      ),
      Cartesian3.fromDegrees(
        Cartographic.fromCartesian(center).longitude,
        Cartographic.fromCartesian(center).latitude + 0.0001
      ),
      Cartesian3.fromDegrees(
        Cartographic.fromCartesian(center).longitude,
        Cartographic.fromCartesian(center).latitude - 0.0001
      )
    ];

    debugLog(
      "[applyTerrainClamping] Created",
      samplePoints.length,
      "sample points"
    );

    // Get the original height of the center point
    const originalCartographic = Cartographic.fromCartesian(center);
    const originalHeight = originalCartographic.height;

    debugLog("[applyTerrainClamping] Original height:", originalHeight);

    // Calculate the average height difference from all sample points
    let totalHeightDifference = 0;
    let validSamples = 0;

    // eslint-disable-next-line no-restricted-syntax
    for (const point of samplePoints) {
      try {
        // Use Cesium's clampToHeight to get the terrain height at this point
        const clampedPoint = scene.clampToHeight(point);

        if (defined(clampedPoint)) {
          const clampedCartographic = Cartographic.fromCartesian(clampedPoint);
          const heightDifference = clampedCartographic.height - originalHeight;
          totalHeightDifference += heightDifference;
          validSamples++;

          debugLog(
            "[applyTerrainClamping] Sample point height difference:",
            heightDifference
          );
        }
      } catch (error) {
        debugWarn("[applyTerrainClamping] Failed to clamp point:", error);
      }
    }

    debugLog(
      "[applyTerrainClamping] Valid samples:",
      validSamples,
      "of",
      samplePoints.length
    );

    if (validSamples > 0) {
      // Calculate the average height difference
      const averageHeightDifference =
        totalHeightDifference / validSamples + heightOffset;

      debugLog(
        "[applyTerrainClamping] Average height difference:",
        averageHeightDifference
      );

      // Create a translation matrix to adjust the height
      const translation = Cartesian3.fromElements(
        0,
        0,
        averageHeightDifference
      );
      const translationMatrix = Matrix4.fromTranslation(translation);

      // Apply the translation to the tileset's model matrix
      const currentModelMatrix = tileset.modelMatrix;
      const clampedMatrix = Matrix4.multiply(
        currentModelMatrix,
        translationMatrix,
        new Matrix4()
      );

      tileset.modelMatrix = clampedMatrix;

      debugLog(
        `[applyTerrainClamping] Applied terrain clamping to tileset: average offset ${averageHeightDifference.toFixed(2)}m`
      );
    } else {
      debugWarn("[applyTerrainClamping] No valid terrain height samples found");
    }
  } catch (error) {
    debugError(
      "[applyTerrainClamping] Failed to apply terrain clamping:",
      error
    );
  }
}

/**
 * Gets the terrain height at a specific cartographic position
 * @param {Scene} scene - The Cesium scene
 * @param {Cartographic} cartographic - The position to check
 * @returns {Promise<number|undefined>} - The terrain height or undefined if not available
 */
async function _getTerrainHeight(scene, cartographic) {
  // Check if clampToHeight is supported
  if (!scene.clampToHeightSupported) {
    debugWarn(
      "[_getTerrainHeight] clampToHeight is not supported in this scene"
    );
    return undefined;
  }

  try {
    // Convert cartographic to cartesian
    const cartesian = Cartographic.toCartesian(cartographic);

    // Use Cesium's clampToHeight to get the terrain height
    const clampedPoint = scene.clampToHeight(cartesian);

    if (defined(clampedPoint)) {
      const clampedCartographic = Cartographic.fromCartesian(clampedPoint);
      return clampedCartographic.height;
    }

    return undefined;
  } catch (error) {
    debugWarn("[_getTerrainHeight] Failed to get terrain height:", error);
    return undefined;
  }
}

/**
 * Sets up continuous height updates for the tileset
 * @param {Cesium3DTileset} tileset - The tileset to monitor
 * @param {Scene} scene - The Cesium scene
 * @param {number} heightOffset - Additional height offset
 */
function setupHeightUpdates(tileset, scene, heightOffset) {
  // Debug: Log function call
  debugLog("[setupHeightUpdates] Setting up height updates");

  // Add an event listener for when tiles are loaded
  tileset.tileLoad.addEventListener(async () => {
    // Re-apply clamping when new tiles are loaded
    // This ensures that newly loaded tiles are also properly clamped
    debugLog("[setupHeightUpdates] Tile loaded, re-applying clamping");
    await applyTerrainClamping(tileset, scene, heightOffset);
  });

  // Optional: Update clamping when terrain is updated
  if (defined(scene.terrainProviderChanged)) {
    scene.terrainProviderChanged.addEventListener(async () => {
      debugLog(
        "[setupHeightUpdates] Terrain provider changed, re-applying clamping"
      );
      await applyTerrainClamping(tileset, scene, heightOffset);
    });
  }
}

/**
 * Helper function to get terrain height using Cesium's clampToHeight
 * @param {Scene} scene - The Cesium scene
 * @param {Cartesian3} cartesian - The position to check
 * @param {number} heightOffset - Additional height offset
 * @returns {Promise<number|undefined>} - The terrain height or undefined if not available
 */
async function _getClampedHeight(scene, cartesian, heightOffset = 0) {
  // Check if clampToHeight is supported
  if (!scene.clampToHeightSupported) {
    debugWarn(
      "[_getClampedHeight] clampToHeight is not supported in this scene"
    );
    return undefined;
  }

  try {
    const clampedPoint = scene.clampToHeight(cartesian);

    if (defined(clampedPoint)) {
      const clampedCartographic = Cartographic.fromCartesian(clampedPoint);
      return clampedCartographic.height + heightOffset;
    }

    return undefined;
  } catch (error) {
    debugWarn("[_getClampedHeight] Failed to get clamped height:", error);
    return undefined;
  }
}

/**
 * Creates a clamped tileset specifically for the gaisano building
 * @param {Scene} scene - The Cesium scene
 * @param {Object} options - Additional options
 * @returns {Promise<Cesium3DTileset>} - The clamped gaisano tileset
 */
export async function createClampedGaisanoTileset(scene, options = {}) {
  const defaultOptions = {
    url: "./gaisano/tileset.json",
    heightOffset: 0, // Adjust this value if needed
    scene: scene,
    enableClamping: true,
    // Additional tileset options
    maximumScreenSpaceError: 16,
    dynamicScreenSpaceError: true,
    enableCollision: true, // Enable collision detection
    ...options
  };

  return createClampedTileset(defaultOptions.url, defaultOptions);
}

/**
 * Helper function to manually adjust tileset height
 * @param {Cesium3DTileset} tileset - The tileset to adjust
 * @param {number} heightOffset - The height offset in meters
 */
export function adjustTilesetHeight(tileset, heightOffset) {
  // Debug: Log function call
  debugLog("[adjustTilesetHeight] Adjusting tileset height by:", heightOffset);

  const translation = Cartesian3.fromElements(0, 0, heightOffset);
  const translationMatrix = Matrix4.fromTranslation(translation);

  const currentModelMatrix = tileset.modelMatrix;
  const adjustedMatrix = Matrix4.multiply(
    currentModelMatrix,
    translationMatrix,
    new Matrix4()
  );

  tileset.modelMatrix = adjustedMatrix;

  debugLog("[adjustTilesetHeight] Height adjustment complete");
}

// Add a simple test function to verify the module is loaded
export function _testTerrainClamp() {
  debugLog("[_testTerrainClamp] Terrain clamp module loaded successfully");
  return true;
}
