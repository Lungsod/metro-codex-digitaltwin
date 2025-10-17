/**
 * TerrainClamp - A utility to clamp 3D tiles to terrain height
 * This solves the issue where 3D tiles appear under terrain in 3D terrain mode
 */

import Cesium3DTileset from "terriajs-cesium/Source/Scene/Cesium3DTileset.js";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3.js";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic.js";
import Matrix4 from "terriajs-cesium/Source/Core/Matrix4.js";
import defined from "terriajs-cesium/Source/Core/defined.js";

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
  const {
    scene,
    heightOffset = 0,
    enableClamping = true,
    ...tilesetOptions
  } = options;

  if (!defined(scene) && enableClamping) {
    console.warn(
      "Scene is required for terrain clamping. Clamping will be disabled."
    );
  }

  // Create the base tileset
  const tileset = await Cesium3DTileset.fromUrl(url, tilesetOptions);

  if (!enableClamping || !defined(scene)) {
    return tileset;
  }

  // Wait for the tileset to be ready
  await tileset.readyPromise;

  // Apply terrain clamping
  await applyTerrainClamping(tileset, scene, heightOffset);

  // Set up continuous height updates if needed
  setupHeightUpdates(tileset, scene, heightOffset);

  return tileset;
}

/**
 * Applies terrain clamping to a tileset by adjusting its model matrix
 * @param {Cesium3DTileset} tileset - The tileset to clamp
 * @param {Scene} scene - The Cesium scene
 * @param {number} heightOffset - Additional height offset
 */
async function applyTerrainClamping(tileset, scene, heightOffset) {
  const boundingSphere = tileset.boundingSphere;
  const center = boundingSphere.center;

  // Convert the center position to cartographic coordinates
  const cartographic = Cartographic.fromCartesian(center);

  // Get the terrain height at this position
  const terrainHeight = await getTerrainHeight(scene, cartographic);

  if (defined(terrainHeight)) {
    // Calculate the height difference
    const heightDifference = terrainHeight - cartographic.height + heightOffset;

    // Create a translation matrix to adjust the height
    const translation = Cartesian3.fromElements(0, 0, heightDifference);

    // Apply the translation to the tileset's model matrix
    const currentModelMatrix = tileset.modelMatrix;
    const clampedMatrix = Matrix4.multiplyTranslation(
      currentModelMatrix,
      translation
    );

    tileset.modelMatrix = clampedMatrix;

    console.log(
      `Clamped tileset to terrain height: ${terrainHeight.toFixed(2)}m (offset: ${heightDifference.toFixed(2)}m)`
    );
  }
}

/**
 * Gets the terrain height at a specific cartographic position
 * @param {Scene} scene - The Cesium scene
 * @param {Cartographic} cartographic - The position to check
 * @returns {Promise<number|undefined>} - The terrain height or undefined if not available
 */
async function getTerrainHeight(scene, cartographic) {
  if (!defined(scene.globe)) {
    return undefined;
  }

  // Try to get height from the globe
  const height = scene.globe.getHeight(cartographic);

  if (defined(height)) {
    return height;
  }

  // If globe height is not available, try sampling from terrain provider
  if (defined(scene.terrainProvider)) {
    try {
      const positions = [cartographic];
      const results = await sampleTerrain(scene.terrainProvider, positions);
      return results[0].height;
    } catch (error) {
      console.warn("Failed to sample terrain height:", error);
    }
  }

  return undefined;
}

/**
 * Sets up continuous height updates for the tileset
 * @param {Cesium3DTileset} tileset - The tileset to monitor
 * @param {Scene} scene - The Cesium scene
 * @param {number} heightOffset - Additional height offset
 */
function setupHeightUpdates(tileset, scene, heightOffset) {
  // Add an event listener for when tiles are loaded
  tileset.tileLoad.addEventListener(async () => {
    // Re-apply clamping when new tiles are loaded
    // This ensures that newly loaded tiles are also properly clamped
    await applyTerrainClamping(tileset, scene, heightOffset);
  });

  // Optional: Update clamping when terrain is updated
  if (defined(scene.terrainProviderChanged)) {
    scene.terrainProviderChanged.addEventListener(async () => {
      await applyTerrainClamping(tileset, scene, heightOffset);
    });
  }
}

/**
 * Sample terrain heights for multiple positions
 * @param {TerrainProvider} terrainProvider - The terrain provider
 * @param {Cartographic[]} positions - Array of positions to sample
 * @returns {Promise<Cartographic[]>} - Array of positions with updated heights
 */
async function sampleTerrain(positions) {
  // This is a simplified implementation
  // In a real implementation, you would use the terrain provider's sampling methods

  const results = [];
  for (const position of positions) {
    // For now, return the original position with height 0
    // In a full implementation, this would sample from the actual terrain
    results.push(Cartographic.clone(position));
  }

  return results;
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
  const translation = Cartesian3.fromElements(0, 0, heightOffset);
  const translationMatrix = Matrix4.fromTranslation(translation);

  const currentModelMatrix = tileset.modelMatrix;
  const adjustedMatrix = Matrix4.multiply(
    currentModelMatrix,
    translationMatrix,
    new Matrix4()
  );

  tileset.modelMatrix = adjustedMatrix;
}
