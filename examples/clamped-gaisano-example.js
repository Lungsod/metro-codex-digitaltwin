/**
 * Example usage of the terrain clamping functionality for the gaisano 3D tile
 * This file demonstrates how to load the gaisano tileset with terrain clamping
 */

import {
  createClampedGaisanoTileset,
  adjustTilesetHeight
} from "../lib/terrainClamp.js";

/**
 * Load the gaisano tileset with terrain clamping
 * @param {Viewer} viewer - The Cesium viewer instance
 * @param {Object} options - Configuration options
 */
export async function loadGaisanoWithClamping(viewer, options = {}) {
  const {
    heightOffset = 0, // Adjust this if the building appears too high or low
    enableDebug = true,
    ...tilesetOptions
  } = options;

  try {
    if (enableDebug) {
      console.log("Loading gaisano tileset with terrain clamping...");
    }

    // Create the clamped tileset
    const tileset = await createClampedGaisanoTileset(viewer.scene, {
      heightOffset,
      enableDebug,
      ...tilesetOptions
    });

    // Add the tileset to the scene
    viewer.scene.primitives.add(tileset);

    // Zoom to the tileset
    viewer.camera.viewBoundingSphere(tileset.boundingSphere, {
      offset: new Cesium.HeadingPitchRange(0.0, -0.5, 0.0)
    });

    if (enableDebug) {
      console.log(
        "Gaisano tileset loaded and clamped to terrain successfully!"
      );

      // Add some debug information
      addDebugInfo(tileset, viewer);
    }

    return tileset;
  } catch (error) {
    console.error("Failed to load gaisano tileset:", error);
    throw error;
  }
}

/**
 * Alternative method: Load without clamping and apply manually
 * This gives you more control over when and how clamping is applied
 * @param {Viewer} viewer - The Cesium viewer instance
 * @param {Object} options - Configuration options
 */
export async function loadGaisanoManualClamping(viewer, options = {}) {
  const { autoClamp = true, heightOffset = 0, ...tilesetOptions } = options;

  try {
    // Load the tileset normally first
    const tileset = await Cesium.Cesium3DTileset.fromUrl(
      "./gaisano/tileset.json",
      tilesetOptions
    );

    // Add to scene
    viewer.scene.primitives.add(tileset);

    // Wait for it to be ready
    await tileset.readyPromise;

    if (autoClamp) {
      // Apply manual clamping
      await applyManualClamping(tileset, viewer.scene, heightOffset);
    }

    // Zoom to tileset
    viewer.camera.viewBoundingSphere(tileset.boundingSphere);

    return tileset;
  } catch (error) {
    console.error("Failed to load gaisano tileset:", error);
    throw error;
  }
}

/**
 * Manual clamping function for more control
 * @param {Cesium3DTileset} tileset - The tileset to clamp
 * @param {Scene} scene - The Cesium scene
 * @param {number} heightOffset - Height offset in meters
 */
async function applyManualClamping(tileset, scene, heightOffset = 0) {
  const boundingSphere = tileset.boundingSphere;
  const center = boundingSphere.center;

  // Get the cartographic position
  const cartographic = Cesium.Cartographic.fromCartesian(center);

  // Sample multiple points around the building for better accuracy
  const samplePoints = [
    cartographic,
    // Add sample points around the building
    new Cesium.Cartographic(
      cartographic.longitude + 0.0001,
      cartographic.latitude,
      cartographic.height
    ),
    new Cesium.Cartographic(
      cartographic.longitude - 0.0001,
      cartographic.latitude,
      cartographic.height
    ),
    new Cesium.Cartographic(
      cartographic.longitude,
      cartographic.latitude + 0.0001,
      cartographic.height
    ),
    new Cesium.Cartographic(
      cartographic.longitude,
      cartographic.latitude - 0.0001,
      cartographic.height
    )
  ];

  // Sample terrain heights
  let totalHeight = 0;
  let validSamples = 0;

  for (const point of samplePoints) {
    const terrainHeight = await getTerrainHeightAtPoint(scene, point);
    if (terrainHeight !== undefined) {
      totalHeight += terrainHeight;
      validSamples++;
    }
  }

  if (validSamples > 0) {
    const averageTerrainHeight = totalHeight / validSamples;
    const heightDifference =
      averageTerrainHeight - cartographic.height + heightOffset;

    // Apply the height adjustment
    adjustTilesetHeight(tileset, heightDifference);

    console.log(
      `Applied manual clamping: ${heightDifference.toFixed(2)}m adjustment`
    );
  }
}

/**
 * Get terrain height at a specific point
 * @param {Scene} scene - The Cesium scene
 * @param {Cartographic} point - The point to sample
 * @returns {Promise<number|undefined>} - The terrain height
 */
async function getTerrainHeightAtPoint(scene, point) {
  if (scene.globe) {
    return scene.globe.getHeight(point);
  }
  return undefined;
}

/**
 * Add debug information to the scene
 * @param {Cesium3DTileset} tileset - The tileset
 * @param {Viewer} viewer - The Cesium viewer
 */
function addDebugInfo(tileset, viewer) {
  // Add a label showing the tileset info
  const labelCollection = new Cesium.LabelCollection();
  viewer.scene.primitives.add(labelCollection);

  const center = tileset.boundingSphere.center;
  const cartographic = Cesium.Cartographic.fromCartesian(center);

  labelCollection.add({
    position: Cesium.Cartesian3.fromRadians(
      cartographic.longitude,
      cartographic.latitude,
      cartographic.height + 50 // Position label above the building
    ),
    text: "Gaisano Building\n(Clamped to Terrain)",
    font: "14pt sans-serif",
    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    outlineWidth: 2,
    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
    pixelOffset: new Cesium.Cartesian2(0, -10),
    showBackground: true,
    backgroundColor: new Cesium.Color(0.165, 0.165, 0.165, 0.7)
  });

  // Add terrain height sampling points (for debugging)
  const pointCollection = new Cesium.PointPrimitiveCollection();
  viewer.scene.primitives.add(pointCollection);

  // Sample points around the building
  const sampleRadius = 0.0001; // Approximately 10 meters
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * 2 * Math.PI;
    const samplePoint = new Cesium.Cartographic(
      cartographic.longitude + Math.cos(angle) * sampleRadius,
      cartographic.latitude + Math.sin(angle) * sampleRadius,
      0
    );

    pointCollection.add({
      position: Cesium.Cartesian3.fromRadians(
        samplePoint.longitude,
        samplePoint.latitude,
        0
      ),
      color: Cesium.Color.YELLOW,
      pixelSize: 5
    });
  }
}

/**
 * Create a UI control for adjusting the tileset height
 * @param {Viewer} viewer - The Cesium viewer
 * @param {Cesium3DTileset} tileset - The tileset to control
 */
export function createHeightAdjustmentControl(viewer, tileset) {
  const container = document.createElement("div");
  container.style.cssText = `
    position: absolute;
    top: 10px;
    right: 10px;
    background: rgba(42, 42, 42, 0.8);
    color: white;
    padding: 10px;
    border-radius: 5px;
    font-family: sans-serif;
    z-index: 1000;
  `;

  container.innerHTML = `
    <div style="margin-bottom: 5px;">Height Adjustment</div>
    <input type="range" id="heightSlider" min="-50" max="50" value="0" step="1" style="width: 200px;">
    <div id="heightValue">0m</div>
    <button id="resetHeight" style="margin-top: 5px;">Reset</button>
  `;

  document.body.appendChild(container);

  const slider = document.getElementById("heightSlider");
  const valueDisplay = document.getElementById("heightValue");
  const resetButton = document.getElementById("resetHeight");

  let currentOffset = 0;

  slider.addEventListener("input", (e) => {
    const newOffset = parseFloat(e.target.value);
    const adjustment = newOffset - currentOffset;

    adjustTilesetHeight(tileset, adjustment);
    currentOffset = newOffset;
    valueDisplay.textContent = `${newOffset}m`;
  });

  resetButton.addEventListener("click", () => {
    adjustTilesetHeight(tileset, -currentOffset);
    slider.value = 0;
    currentOffset = 0;
    valueDisplay.textContent = "0m";
  });

  return container;
}

// Export the main function for easy usage
export default loadGaisanoWithClamping;
