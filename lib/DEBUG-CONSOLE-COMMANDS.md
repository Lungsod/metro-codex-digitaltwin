# Quick Start: Visualizing Bounding Boxes

## Console Commands

Once your application is running and a 3D tileset is loaded, you can use these commands in the browser console:

### 1. Find Your Tileset

```javascript
// Method 1: Get from catalog item by ID
const catalogItem = terria.workbench.items.find(
  (item) => item.uniqueId === "your-tileset-id"
);
const tileset = catalogItem?.tileset;

// Method 2: Get all 3D tilesets in the scene
const tilesets = terria.cesium.scene.primitives._primitives.filter(
  (p) => p instanceof Cesium.Cesium3DTileset
);
console.log("Found tilesets:", tilesets);
const tileset = tilesets[0]; // Use the first one
```

### 2. Enable Bounding Box Visualization

```javascript
// Import the function (if not already available globally)
// Or if it's already loaded:
tileset.debugShowBoundingVolume = true;
tileset.debugShowContentBoundingVolume = true;
```

### 3. Check Bounding Info in Console

```javascript
const boundingSphere = tileset.boundingSphere;
const center = boundingSphere.center;
const radius = boundingSphere.radius;

const centerCartographic = Cesium.Cartographic.fromCartesian(center);
const centerHeight = centerCartographic.height;
const baseHeight = centerHeight - radius;
const topHeight = centerHeight + radius;

console.log("=== Bounding Box Info ===");
console.log("Center Height:", centerHeight, "m");
console.log("Radius:", radius, "m");
console.log("Base Height:", baseHeight, "m");
console.log("Top Height:", topHeight, "m");
console.log("Lat/Lon:", {
  lat: Cesium.Math.toDegrees(centerCartographic.latitude),
  lon: Cesium.Math.toDegrees(centerCartographic.longitude)
});
```

### 4. Get Terrain Height at Tileset Location

```javascript
const scene = terria.cesium.scene;
const center = tileset.boundingSphere.center;

// This requires clampToHeight support
if (scene.clampToHeightSupported) {
  const clampedPoint = scene.clampToHeight(center);
  if (clampedPoint) {
    const terrainCartographic = Cesium.Cartographic.fromCartesian(clampedPoint);
    console.log("Terrain height at tileset:", terrainCartographic.height, "m");
    console.log(
      "Distance from terrain to base:",
      baseHeight - terrainCartographic.height,
      "m"
    );
  }
} else {
  console.log("clampToHeight not supported - terrain may still be loading");
}
```

### 5. Compare Heights

```javascript
// Run this after getting all values above:
console.log("=== Height Comparison ===");
console.log("Object base height:", baseHeight.toFixed(2), "m");
console.log("Terrain height:", terrainCartographic.height.toFixed(2), "m");
console.log(
  "Difference (should be ~10m if heightOffset=10):",
  (baseHeight - terrainCartographic.height).toFixed(2),
  "m"
);
```

### 6. Disable Visualization When Done

```javascript
tileset.debugShowBoundingVolume = false;
tileset.debugShowContentBoundingVolume = false;
```

## All-in-One Debug Script

Copy and paste this into your console:

```javascript
(function () {
  // Get the first 3D tileset
  const tilesets = terria.cesium.scene.primitives._primitives.filter(
    (p) => p instanceof Cesium.Cesium3DTileset
  );

  if (tilesets.length === 0) {
    console.error("No 3D tilesets found in scene");
    return;
  }

  const tileset = tilesets[0];
  const scene = terria.cesium.scene;

  // Enable visualization
  tileset.debugShowBoundingVolume = true;
  tileset.debugShowContentBoundingVolume = true;

  // Get bounding info
  const boundingSphere = tileset.boundingSphere;
  const center = boundingSphere.center;
  const radius = boundingSphere.radius;

  const centerCartographic = Cesium.Cartographic.fromCartesian(center);
  const centerHeight = centerCartographic.height;
  const baseHeight = centerHeight - radius;
  const topHeight = centerHeight + radius;

  console.log("=== Bounding Box Debug Info ===");
  console.log("Tileset:", tileset);
  console.log("Center Height:", centerHeight.toFixed(2), "m");
  console.log("Radius:", radius.toFixed(2), "m");
  console.log("Calculated Base Height:", baseHeight.toFixed(2), "m");
  console.log("Calculated Top Height:", topHeight.toFixed(2), "m");
  console.log("Position:", {
    lat: Cesium.Math.toDegrees(centerCartographic.latitude).toFixed(6),
    lon: Cesium.Math.toDegrees(centerCartographic.longitude).toFixed(6)
  });

  // Try to get terrain height
  if (scene.clampToHeightSupported) {
    const clampedPoint = scene.clampToHeight(center);
    if (clampedPoint) {
      const terrainCartographic =
        Cesium.Cartographic.fromCartesian(clampedPoint);
      const terrainHeight = terrainCartographic.height;
      console.log("Terrain Height:", terrainHeight.toFixed(2), "m");
      console.log(
        "Base - Terrain:",
        (baseHeight - terrainHeight).toFixed(2),
        "m",
        "(should be ~10m if heightOffset=10)"
      );

      if (baseHeight < terrainHeight) {
        console.warn("⚠️ WARNING: Object base is BELOW terrain!");
        console.warn(
          "   Difference:",
          (baseHeight - terrainHeight).toFixed(2),
          "m"
        );
      } else if (baseHeight - terrainHeight > 20) {
        console.warn("⚠️ WARNING: Object is floating too high!");
        console.warn(
          "   Height above terrain:",
          (baseHeight - terrainHeight).toFixed(2),
          "m"
        );
      } else {
        console.log("✓ Object positioning looks correct");
      }
    }
  } else {
    console.log("Terrain clamp not supported or terrain still loading");
  }

  console.log("=== End Debug Info ===");
  console.log(
    "To disable visualization: tileset.debugShowBoundingVolume = false;"
  );

  // Store reference for easy access
  window._debugTileset = tileset;
  console.log("Tileset stored as window._debugTileset for easy access");
})();
```

## Expected Output

When everything is working correctly, you should see:

```
=== Bounding Box Debug Info ===
Tileset: Cesium3DTileset {...}
Center Height: 412.67 m
Radius: 250.50 m
Calculated Base Height: 162.17 m
Calculated Top Height: 663.17 m
Position: {lat: 10.xxxxx, lon: 123.xxxxx}
Terrain Height: 80.15 m
Base - Terrain: 10.02 m (should be ~10m if heightOffset=10)
✓ Object positioning looks correct
=== End Debug Info ===
```

## Visual Checks

After running the script, you should see:

1. **Wireframe sphere** around your 3D object
2. The **bottom of the sphere** should be touching or slightly above the terrain
3. If using coordinate axes, they should point in the correct cardinal directions

## Troubleshooting

- **"No 3D tilesets found"**: Wait for the tileset to load, or check the catalog
- **Terrain height undefined**: Terrain provider may still be loading
- **Bounding box not visible**: Check if the tileset is actually in view
