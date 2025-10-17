/**
 * TerrainClamp - A utility to clamp 3D tiles to terrain height
 * This solves the issue where 3D tiles appear under terrain in 3D terrain mode
 */

import _Cesium3DTileset from "terriajs-cesium/Source/Scene/Cesium3DTileset.js";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3.js";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic.js";
import Matrix4 from "terriajs-cesium/Source/Core/Matrix4.js";
import defined from "terriajs-cesium/Source/Core/defined.js";
import OrientedBoundingBox from "terriajs-cesium/Source/Core/OrientedBoundingBox.js";
import Color from "terriajs-cesium/Source/Core/Color.js";
// import DebugModelMatrixPrimitive from "terriajs-cesium/Source/Scene/DebugModelMatrixPrimitive.js";
import GeometryInstance from "terriajs-cesium/Source/Core/GeometryInstance.js";
import SphereOutlineGeometry from "terriajs-cesium/Source/Core/SphereOutlineGeometry.js";
import _BoxOutlineGeometry from "terriajs-cesium/Source/Core/BoxOutlineGeometry.js";
import Primitive from "terriajs-cesium/Source/Scene/Primitive.js";
import ColorGeometryInstanceAttribute from "terriajs-cesium/Source/Core/ColorGeometryInstanceAttribute.js";
import PerInstanceColorAppearance from "terriajs-cesium/Source/Scene/PerInstanceColorAppearance.js";
import { PolylineGeometry } from "terriajs-cesium";
import { PolylineColorAppearance } from "terriajs-cesium";

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

    // Try to get sample points from the tileset to create a more accurate bounding box
    let samplePoints = [];

    // First try to get points from the tileset's loaded tiles
    if (tileset._selectedTiles && tileset._selectedTiles.length > 0) {
      tileset._selectedTiles.forEach((tile) => {
        if (tile._content && tile._content._modelMatrix) {
          // Get the center of this tile's model matrix
          const translation = new Cartesian3();
          Matrix4.getTranslation(tile._content._modelMatrix, translation);
          samplePoints.push(translation);
        }
      });
    }

    let _existingBox = null;

    // If we don't have enough points from tiles, use the root tile's bounding volume
    if (samplePoints.length < 3) {
      debugLog(
        "[applyTerrainClamping] Insufficient tile points, using bounding volume"
      );

      // Extract points from the existing oriented bounding box if available
      if (boundingBox._orientedBoundingBox) {
        _existingBox = boundingBox._orientedBoundingBox;
      } else if (boundingBox._boundingSphere) {
        // Create a box from the bounding sphere
        const sphere = boundingBox._boundingSphere;
        const sphereCenter = sphere.center;
        const radius = sphere.radius;

        // Create 6 points on the sphere surface
        samplePoints = [
          Cartesian3.add(sphereCenter, new Cartesian3(radius, 0, 0)),
          Cartesian3.add(sphereCenter, new Cartesian3(-radius, 0, 0)),
          Cartesian3.add(sphereCenter, new Cartesian3(0, radius, 0)),
          Cartesian3.add(sphereCenter, new Cartesian3(0, -radius, 0)),
          Cartesian3.add(sphereCenter, new Cartesian3(0, 0, radius)),
          Cartesian3.add(sphereCenter, new Cartesian3(0, 0, -radius))
        ];
      } else {
        debugWarn(
          "[applyTerrainClamping] No bounding volume found, using fallback"
        );
        return await applyFallbackClamping(tileset, scene, heightOffset);
      }
    }

    // Create a new oriented bounding box from the sample points
    let orientedBoundingBox;
    if (samplePoints.length >= 3) {
      orientedBoundingBox = OrientedBoundingBox.fromPoints(samplePoints);
      debugLog(
        "[applyTerrainClamping] Created oriented bounding box from points"
      );
    } else if (_existingBox) {
      orientedBoundingBox = _existingBox;
      debugLog("[applyTerrainClamping] Using existing oriented bounding box");
    } else {
      debugError(
        "[applyTerrainClamping] Could not create oriented bounding box"
      );
      return await applyFallbackClamping(tileset, scene, heightOffset);
    }

    debugLog(
      "[applyTerrainClamping] Oriented bounding box:",
      orientedBoundingBox
    );

    // Compute all 8 corners of the oriented bounding box
    const allCorners = OrientedBoundingBox.computeCorners(orientedBoundingBox);

    // Extract the 4 bottom corners (indices 0, 1, 2, 3 according to Cesium documentation)
    // Order: (-X, -Y, -Z), (-X, -Y, +Z), (-X, +Y, -Z), (-X, +Y, +Z), (+X, -Y, -Z), (+X, -Y, +Z), (+X, +Y, -Z), (+X, +Y, +Z)
    const bottomCorners = [
      allCorners[0],
      allCorners[2],
      allCorners[4],
      allCorners[6]
    ];

    debugLog("[applyTerrainClamping] Calculated 4 bottom corners");

    // Draw the bounding box and corner points for visualization
    drawBoundingBox(scene, orientedBoundingBox, bottomCorners);

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

/**
 * Draws the oriented bounding box and corner points for visualization
 * @param {Scene} scene - The Cesium scene
 * @param {Object} orientedBoundingBox - The oriented bounding box
 * @param {Cartesian3[]} bottomCorners - The bottom corner positions
 */
function drawBoundingBox(scene, orientedBoundingBox, bottomCorners) {
  try {
    debugLog("[drawBoundingBox] Drawing bounding box visualization");

    // Validate inputs
    if (!scene || !scene.primitives) {
      debugError("[drawBoundingBox] Invalid scene or scene.primitives");
      return;
    }

    if (!orientedBoundingBox || !orientedBoundingBox.center) {
      debugError("[drawBoundingBox] Invalid orientedBoundingBox or center");
      return;
    }

    if (!bottomCorners || bottomCorners.length === 0) {
      debugError("[drawBoundingBox] Invalid bottomCorners array");
      return;
    }

    // Validate center coordinates
    const center = orientedBoundingBox.center;
    if (!defined(center.x) || !defined(center.y) || !defined(center.z)) {
      debugError("[drawBoundingBox] Invalid center coordinates:", center);
      return;
    }

    // Validate corner coordinates
    const validCorners = [];
    bottomCorners.forEach((corner, index) => {
      if (
        corner &&
        defined(corner.x) &&
        defined(corner.y) &&
        defined(corner.z)
      ) {
        validCorners.push(corner);
      } else {
        debugWarn(`[drawBoundingBox] Invalid corner ${index}:`, corner);
      }
    });

    if (validCorners.length === 0) {
      debugError("[drawBoundingBox] No valid corners found");
      return;
    }

    // Get all 8 corners of the bounding box for complete visualization
    const allCorners = OrientedBoundingBox.computeCorners(orientedBoundingBox);

    // Create polylines for the complete bounding box edges
    const polylineInstances = [];

    // Bottom face edges (indices 0, 2, 4, 6)
    polylineInstances.push(
      new GeometryInstance({
        geometry: new PolylineGeometry({
          positions: [allCorners[0], allCorners[2]],
          width: 2.0
        }),
        attributes: {
          color: ColorGeometryInstanceAttribute.fromColor(Color.YELLOW)
        }
      })
    );

    polylineInstances.push(
      new GeometryInstance({
        geometry: new PolylineGeometry({
          positions: [allCorners[2], allCorners[6]],
          width: 2.0
        }),
        attributes: {
          color: ColorGeometryInstanceAttribute.fromColor(Color.YELLOW)
        }
      })
    );

    polylineInstances.push(
      new GeometryInstance({
        geometry: new PolylineGeometry({
          positions: [allCorners[6], allCorners[4]],
          width: 2.0
        }),
        attributes: {
          color: ColorGeometryInstanceAttribute.fromColor(Color.YELLOW)
        }
      })
    );

    polylineInstances.push(
      new GeometryInstance({
        geometry: new PolylineGeometry({
          positions: [allCorners[4], allCorners[0]],
          width: 2.0
        }),
        attributes: {
          color: ColorGeometryInstanceAttribute.fromColor(Color.YELLOW)
        }
      })
    );

    // Top face edges (indices 1, 3, 5, 7)
    polylineInstances.push(
      new GeometryInstance({
        geometry: new PolylineGeometry({
          positions: [allCorners[1], allCorners[3]],
          width: 2.0
        }),
        attributes: {
          color: ColorGeometryInstanceAttribute.fromColor(Color.CYAN)
        }
      })
    );

    polylineInstances.push(
      new GeometryInstance({
        geometry: new PolylineGeometry({
          positions: [allCorners[3], allCorners[7]],
          width: 2.0
        }),
        attributes: {
          color: ColorGeometryInstanceAttribute.fromColor(Color.CYAN)
        }
      })
    );

    polylineInstances.push(
      new GeometryInstance({
        geometry: new PolylineGeometry({
          positions: [allCorners[7], allCorners[5]],
          width: 2.0
        }),
        attributes: {
          color: ColorGeometryInstanceAttribute.fromColor(Color.CYAN)
        }
      })
    );

    polylineInstances.push(
      new GeometryInstance({
        geometry: new PolylineGeometry({
          positions: [allCorners[5], allCorners[1]],
          width: 2.0
        }),
        attributes: {
          color: ColorGeometryInstanceAttribute.fromColor(Color.CYAN)
        }
      })
    );

    // Vertical edges
    polylineInstances.push(
      new GeometryInstance({
        geometry: new PolylineGeometry({
          positions: [allCorners[0], allCorners[1]],
          width: 2.0
        }),
        attributes: {
          color: ColorGeometryInstanceAttribute.fromColor(Color.WHITE)
        }
      })
    );

    polylineInstances.push(
      new GeometryInstance({
        geometry: new PolylineGeometry({
          positions: [allCorners[2], allCorners[3]],
          width: 2.0
        }),
        attributes: {
          color: ColorGeometryInstanceAttribute.fromColor(Color.WHITE)
        }
      })
    );

    polylineInstances.push(
      new GeometryInstance({
        geometry: new PolylineGeometry({
          positions: [allCorners[4], allCorners[5]],
          width: 2.0
        }),
        attributes: {
          color: ColorGeometryInstanceAttribute.fromColor(Color.WHITE)
        }
      })
    );

    polylineInstances.push(
      new GeometryInstance({
        geometry: new PolylineGeometry({
          positions: [allCorners[6], allCorners[7]],
          width: 2.0
        }),
        attributes: {
          color: ColorGeometryInstanceAttribute.fromColor(Color.WHITE)
        }
      })
    );

    // Create the primitive for the bounding box polylines
    let boundingBoxPrimitive = null;
    if (polylineInstances.length > 0) {
      try {
        boundingBoxPrimitive = new Primitive({
          geometryInstances: polylineInstances,
          appearance: new PolylineColorAppearance()
        });

        scene.primitives.add(boundingBoxPrimitive);
      } catch (error) {
        debugWarn(
          "[drawBoundingBox] Error creating bounding box primitive:",
          error
        );
      }
    }

    // Draw the corner points as spheres with larger radius for better visibility
    const sphereInstances = [];
    validCorners.forEach((corner, index) => {
      try {
        const sphereGeometry = new SphereOutlineGeometry({
          radius: 5.0 // 5 meter radius spheres for better visibility
        });

        sphereInstances.push(
          new GeometryInstance({
            geometry: sphereGeometry,
            modelMatrix: Matrix4.fromTranslation(corner),
            attributes: {
              color: ColorGeometryInstanceAttribute.fromColor(
                index === 0
                  ? Color.RED
                  : index === 1
                    ? Color.GREEN
                    : index === 2
                      ? Color.BLUE
                      : Color.MAGENTA
              )
            }
          })
        );
      } catch (error) {
        debugWarn(
          `[drawBoundingBox] Error creating sphere for corner ${index}:`,
          error
        );
      }
    });

    // Create the primitive for the corner spheres if we have valid instances
    let spheresPrimitive = null;
    if (sphereInstances.length > 0) {
      try {
        spheresPrimitive = new Primitive({
          geometryInstances: sphereInstances,
          appearance: new PerInstanceColorAppearance({
            translucent: false,
            closed: false
          })
        });

        scene.primitives.add(spheresPrimitive);
      } catch (error) {
        debugWarn("[drawBoundingBox] Error creating spheres primitive:", error);
      }
    }

    // Store references for potential cleanup
    if (!scene._terrainClampVisualizations) {
      scene._terrainClampVisualizations = [];
    }
    if (boundingBoxPrimitive) {
      scene._terrainClampVisualizations.push(boundingBoxPrimitive);
    }
    if (spheresPrimitive) {
      scene._terrainClampVisualizations.push(spheresPrimitive);
    }

    debugLog(
      `[drawBoundingBox] Added visualization with ${validCorners.length} corners and complete bounding box`
    );

    // Auto-remove after 60 seconds to avoid cluttering the scene
    setTimeout(() => {
      try {
        if (boundingBoxPrimitive) {
          scene.primitives.remove(boundingBoxPrimitive);
        }
        if (spheresPrimitive) {
          scene.primitives.remove(spheresPrimitive);
        }

        // Remove from the tracking array
        const toRemove = [];
        if (boundingBoxPrimitive) {
          const boxIndex =
            scene._terrainClampVisualizations.indexOf(boundingBoxPrimitive);
          if (boxIndex > -1) {
            toRemove.push(boxIndex);
          }
        }
        if (spheresPrimitive) {
          const sphereIndex =
            scene._terrainClampVisualizations.indexOf(spheresPrimitive);
          if (sphereIndex > -1) {
            toRemove.push(sphereIndex);
          }
        }

        // Remove in reverse order to maintain indices
        toRemove
          .sort((a, b) => b - a)
          .forEach((index) => {
            scene._terrainClampVisualizations.splice(index, 1);
          });

        debugLog("[drawBoundingBox] Bounding box visualization removed");
      } catch (error) {
        debugWarn("[drawBoundingBox] Error removing visualization:", error);
      }
    }, 60000);
  } catch (error) {
    debugError("[drawBoundingBox] Error drawing bounding box:", error);
  }
}

// Export the drawBoundingBox function for external use
export { drawBoundingBox };

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
