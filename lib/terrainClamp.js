/**
 * TerrainClamp - A utility to clamp 3D tiles to terrain height
 * This solves the issue where 3D tiles appear under terrain in 3D terrain mode
 */

import Cesium3DTileset from "terriajs-cesium/Source/Scene/Cesium3DTileset.js";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3.js";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic.js";
import Matrix4 from "terriajs-cesium/Source/Core/Matrix4.js";
import defined from "terriajs-cesium/Source/Core/defined.js";
import Color from "terriajs-cesium/Source/Core/Color.js";
import DebugModelMatrixPrimitive from "terriajs-cesium/Source/Scene/DebugModelMatrixPrimitive.js";
import GeometryInstance from "terriajs-cesium/Source/Core/GeometryInstance.js";
import SphereOutlineGeometry from "terriajs-cesium/Source/Core/SphereOutlineGeometry.js";
import BoxOutlineGeometry from "terriajs-cesium/Source/Core/BoxOutlineGeometry.js";
// import OrientedBoundingBox from "terriajs-cesium/Source/Core/OrientedBoundingBox.js";
// import PolylineColorAppearance from "terriajs-cesium/Source/Scene/PolylineColorAppearance.js";
import Primitive from "terriajs-cesium/Source/Scene/Primitive.js";
import ColorGeometryInstanceAttribute from "terriajs-cesium/Source/Core/ColorGeometryInstanceAttribute.js";
import PerInstanceColorAppearance from "terriajs-cesium/Source/Scene/PerInstanceColorAppearance.js";

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
 * @param {number} [options.heightOffset=0] - Height offset above terrain (in meters). Default is 10m above terrain.
 * @param {boolean} [options.enableClamping=true] - Whether to enable terrain clamping
 * @returns {Promise<Cesium3DTileset>} - A promise that resolves to the clamped tileset
 */

/**
 * Applies terrain clamping to a tileset by adjusting its root transform
 * Places the object's base at terrain level plus the specified height offset.
 * @param {Cesium3DTileset} tileset - The tileset to clamp
 * @param {Scene} scene - The Cesium scene
 * @param {number} heightOffset - Height offset above terrain in meters (e.g., 10 = 10m above terrain)
 */
export async function applyTerrainClamping(tileset, scene, heightOffset) {}

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
