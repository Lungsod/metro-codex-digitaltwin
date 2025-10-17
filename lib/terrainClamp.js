/**
 * TerrainClamp - A utility to clamp 3D tiles to terrain height
 * This solves the issue where 3D tiles appear under terrain in 3D terrain mode
 */

import _Cesium3DTileset from "terriajs-cesium/Source/Scene/Cesium3DTileset.js";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3.js";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic.js";
import Matrix4 from "terriajs-cesium/Source/Core/Matrix4.js";
import defined from "terriajs-cesium/Source/Core/defined.js";
import _OrientedBoundingBox from "terriajs-cesium/Source/Core/OrientedBoundingBox.js";

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
 * Applies terrain clamping to a tileset by adjusting its root transform
 * Places the object's base at terrain level plus the specified height offset.
 * @param {Cesium3DTileset} tileset - The tileset to clamp
 * @param {Scene} scene - The Cesium scene
 * @param {number} heightOffset - Height offset above terrain in meters (e.g., 10 = 10m above terrain)
 */
export async function applyTerrainClamping(tileset, scene, heightOffset) {
  debugLog("[applyTerrainClamping] Starting terrain clamping process");

  // Wait for the tileset to be ready
  // Check if tiles are already loaded or wait for them to load
  if (!tileset._initialTilesLoaded) {
    debugLog("[applyTerrainClamping] Waiting for tileset to be ready");
    await new Promise((resolve) => {
      if (tileset._initialTilesLoaded) {
        resolve();
      } else if (tileset.readyPromise) {
        tileset.readyPromise.then(resolve).catch((error) => {
          debugError("[applyTerrainClamping] Tileset failed to load:", error);
          resolve(); // Resolve anyway to allow fallback handling
        });
      } else {
        // Use the initialTilesLoaded event
        tileset.initialTilesLoaded.addEventListener(() => {
          debugLog("[applyTerrainClamping] Initial tiles loaded");
          resolve();
        });

        // Also add a timeout fallback
        setTimeout(() => {
          if (!tileset._initialTilesLoaded) {
            debugWarn(
              "[applyTerrainClamping] Timeout waiting for tiles, proceeding anyway"
            );
            resolve();
          }
        }, 5000); // 5 second timeout
      }
    });
  }

  try {
    // Get the TileOrientedBoundingBox from the tileset
    const boundingBox = tileset.root.boundingVolume;
    if (!boundingBox || !boundingBox._orientedBoundingBox) {
      debugWarn(
        "[applyTerrainClamping] No oriented bounding box found, using fallback method"
      );
      return await applyFallbackClamping(tileset, scene, heightOffset);
    }

    const orientedBoundingBox = boundingBox._orientedBoundingBox;
    debugLog(
      "[applyTerrainClamping] Found oriented bounding box:",
      orientedBoundingBox
    );

    // Get the transformation matrix of the oriented bounding box
    const _transform = orientedBoundingBox._transform;

    // Get the half dimensions of the box
    const halfAxes = orientedBoundingBox.halfAxes;
    if (!halfAxes) {
      debugError("[applyTerrainClamping] halfAxes is undefined");
      return await applyFallbackClamping(tileset, scene, heightOffset);
    }

    // halfAxes can be either an array or an object with numeric keys
    const ha0 = halfAxes[0] !== undefined ? halfAxes[0] : halfAxes["0"];
    const ha1 = halfAxes[1] !== undefined ? halfAxes[1] : halfAxes["1"];
    const ha2 = halfAxes[2] !== undefined ? halfAxes[2] : halfAxes["2"];
    const ha3 = halfAxes[3] !== undefined ? halfAxes[3] : halfAxes["3"];
    const ha4 = halfAxes[4] !== undefined ? halfAxes[4] : halfAxes["4"];
    const ha5 = halfAxes[5] !== undefined ? halfAxes[5] : halfAxes["5"];
    const ha6 = halfAxes[6] !== undefined ? halfAxes[6] : halfAxes["6"];
    const ha7 = halfAxes[7] !== undefined ? halfAxes[7] : halfAxes["7"];
    const ha8 = halfAxes[8] !== undefined ? halfAxes[8] : halfAxes["8"];

    const xAxis = new Cartesian3(ha0, ha1, ha2);
    const yAxis = new Cartesian3(ha3, ha4, ha5);
    const zAxis = new Cartesian3(ha6, ha7, ha8);

    // Get the center of the box
    const center = orientedBoundingBox.center;

    // Calculate the four bottom corners of the bounding box
    // Bottom corners are at center - zAxis (bottom face center) +/- xAxis +/- yAxis
    const bottomCenter = Cartesian3.subtract(center, zAxis, new Cartesian3());

    const bottomCorners = [
      // Corner 1: bottomCenter - xAxis - yAxis
      Cartesian3.add(
        Cartesian3.subtract(bottomCenter, xAxis, new Cartesian3()),
        Cartesian3.negate(yAxis, new Cartesian3()),
        new Cartesian3()
      ),
      // Corner 2: bottomCenter + xAxis - yAxis
      Cartesian3.add(
        Cartesian3.add(bottomCenter, xAxis, new Cartesian3()),
        Cartesian3.negate(yAxis, new Cartesian3()),
        new Cartesian3()
      ),
      // Corner 3: bottomCenter + xAxis + yAxis
      Cartesian3.add(
        Cartesian3.add(bottomCenter, xAxis, new Cartesian3()),
        yAxis,
        new Cartesian3()
      ),
      // Corner 4: bottomCenter - xAxis + yAxis
      Cartesian3.add(
        Cartesian3.subtract(bottomCenter, xAxis, new Cartesian3()),
        yAxis,
        new Cartesian3()
      )
    ];

    debugLog("[applyTerrainClamping] Calculated 4 bottom corners");

    // Get terrain heights at each corner position
    const terrainHeights = [];
    for (let i = 0; i < bottomCorners.length; i++) {
      const corner = bottomCorners[i];
      const cartographic = Cartographic.fromCartesian(corner);

      // Get terrain height at this position (excluding other objects)
      const terrainHeight = await getTerrainHeightAtPosition(
        scene,
        cartographic
      );
      terrainHeights.push(terrainHeight);

      debugLog(
        `[applyTerrainClamping] Corner ${i + 1} terrain height: ${terrainHeight}m`
      );
    }

    // Calculate the best fit plane from the terrain heights
    const bestFitResult = calculateBestFitPlane(bottomCorners, terrainHeights);

    if (!bestFitResult.success) {
      debugWarn(
        "[applyTerrainClamping] Failed to calculate best fit, using fallback method"
      );
      return await applyFallbackClamping(tileset, scene, heightOffset);
    }

    // Calculate the transformation needed to align the tileset with terrain
    const adjustmentTransform = calculateAdjustmentTransform(
      orientedBoundingBox,
      bestFitResult,
      heightOffset
    );

    // Apply the transformation to the tileset
    const currentModelMatrix = tileset.modelMatrix || Matrix4.IDENTITY;
    const newModelMatrix = Matrix4.multiply(
      currentModelMatrix,
      adjustmentTransform,
      new Matrix4()
    );

    tileset.modelMatrix = newModelMatrix;

    debugLog("[applyTerrainClamping] Successfully applied terrain clamping");
    return true;
  } catch (error) {
    debugError("[applyTerrainClamping] Error during clamping:", error);
    return await applyFallbackClamping(tileset, scene, heightOffset);
  }
}

/**
 * Fallback clamping method that uses the bounding sphere instead of oriented bounding box
 * @param {Cesium3DTileset} tileset - The tileset to clamp
 * @param {Scene} scene - The Cesium scene
 * @param {number} heightOffset - Height offset above terrain in meters
 * @returns {Promise<boolean>} - Success status
 */
async function applyFallbackClamping(tileset, scene, heightOffset) {
  debugLog("[applyFallbackClamping] Using fallback clamping method");

  const boundingSphere = tileset.boundingSphere;
  const center = boundingSphere.center;
  const cartographic = Cartographic.fromCartesian(center);

  // Get terrain height at the center position
  const terrainHeight = await getTerrainHeightAtPosition(scene, cartographic);

  if (terrainHeight === undefined) {
    debugWarn("[applyFallbackClamping] Could not get terrain height");
    return false;
  }

  // Calculate height difference
  const heightDifference = terrainHeight - cartographic.height + heightOffset;

  // Apply height adjustment
  const translation = new Cartesian3(0, 0, heightDifference);
  const translationMatrix = Matrix4.fromTranslation(translation);

  const currentModelMatrix = tileset.modelMatrix || Matrix4.IDENTITY;
  const newModelMatrix = Matrix4.multiply(
    currentModelMatrix,
    translationMatrix,
    new Matrix4()
  );

  tileset.modelMatrix = newModelMatrix;

  debugLog(
    `[applyFallbackClamping] Applied height adjustment: ${heightDifference.toFixed(2)}m`
  );
  return true;
}

/**
 * Get terrain height at a specific cartographic position
 * @param {Scene} scene - The Cesium scene
 * @param {Cartographic} cartographic - The position to sample
 * @returns {Promise<number|undefined>} - The terrain height or undefined if failed
 */
async function getTerrainHeightAtPosition(scene, cartographic) {
  try {
    if (scene.globe && defined(scene.globe.getHeight)) {
      // Use globe.getHeight to get terrain height at this position
      const height = await scene.globe.getHeight(cartographic);
      return height;
    }

    // Alternative method: use clampToHeight with only the globe
    if (scene.clampToHeight) {
      const cartesian = Cartesian3.fromRadians(
        cartographic.longitude,
        cartographic.latitude,
        cartographic.height
      );

      const clampedPosition = await scene.clampToHeight(cartesian, [
        scene.globe
      ]);
      if (clampedPosition) {
        const clampedCartographic = Cartographic.fromCartesian(clampedPosition);
        return clampedCartographic.height;
      }
    }

    debugWarn(
      "[getTerrainHeightAtPosition] Could not determine terrain height"
    );
    return undefined;
  } catch (error) {
    debugError("[getTerrainHeightAtPosition] Error:", error);
    return undefined;
  }
}

/**
 * Calculate the best fit plane from corner positions and terrain heights
 * @param {Cartesian3[]} corners - The corner positions
 * @param {number[]} heights - The terrain heights at each corner
 * @returns {Object} - Result with success status and plane parameters
 */
function calculateBestFitPlane(corners, heights) {
  try {
    if (corners.length !== 4 || heights.length !== 4) {
      throw new Error("Expected 4 corners and 4 heights");
    }

    // Check if any heights are undefined
    if (heights.some((h) => h === undefined)) {
      throw new Error("Some terrain heights are undefined");
    }

    // Convert corners to cartographic for easier plane calculation
    const cartographicCorners = corners.map((corner) =>
      Cartographic.fromCartesian(corner)
    );

    // Calculate average height difference
    let totalHeightDiff = 0;
    for (let i = 0; i < 4; i++) {
      const heightDiff = heights[i] - cartographicCorners[i].height;
      totalHeightDiff += heightDiff;
    }
    const avgHeightDiff = totalHeightDiff / 4;

    // Calculate plane normal using cross product of two edge vectors
    const edge1 = Cartesian3.subtract(corners[1], corners[0], new Cartesian3());
    const edge2 = Cartesian3.subtract(corners[3], corners[0], new Cartesian3());
    const normal = Cartesian3.cross(edge1, edge2, new Cartesian3());
    Cartesian3.normalize(normal, normal);

    return {
      success: true,
      averageHeightDifference: avgHeightDiff,
      normal: normal,
      heights: heights
    };
  } catch (error) {
    debugError("[calculateBestFitPlane] Error:", error);
    return { success: false };
  }
}

/**
 * Calculate the adjustment transformation to align the tileset with terrain
 * @param {OrientedBoundingBox} boundingBox - The oriented bounding box
 * @param {Object} bestFitResult - The best fit plane result
 * @param {number} heightOffset - Additional height offset
 * @returns {Matrix4} - The adjustment transformation matrix
 */
function calculateAdjustmentTransform(
  _boundingBox,
  bestFitResult,
  heightOffset
) {
  // Start with identity matrix
  const adjustmentMatrix = Matrix4.IDENTITY;

  // Apply height adjustment
  const heightAdjustment = bestFitResult.averageHeightDifference + heightOffset;
  const translation = new Cartesian3(0, 0, heightAdjustment);
  const translationMatrix = Matrix4.fromTranslation(translation);

  // Combine translation with any rotation needed (for now just translation)
  const finalMatrix = Matrix4.multiply(
    adjustmentMatrix,
    translationMatrix,
    new Matrix4()
  );

  debugLog(
    `[calculateAdjustmentTransform] Height adjustment: ${heightAdjustment.toFixed(2)}m`
  );

  return finalMatrix;
}

// Export helper functions for advanced usage
export {
  getTerrainHeightAtPosition,
  calculateBestFitPlane,
  applyFallbackClamping
};

/**
 * Sets up continuous height updates for the tileset
 * @param {Cesium3DTileset} tileset - The tileset to monitor
 * @param {Scene} scene - The Cesium scene
 * @param {number} heightOffset - Additional height offset
 */
function _setupHeightUpdates(tileset, scene, heightOffset) {
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
