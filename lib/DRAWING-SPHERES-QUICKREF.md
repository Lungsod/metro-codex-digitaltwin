# Quick Reference: Drawing Bounding Volumes

## Console Commands

### 1. Draw Bounding Sphere (Cyan Wireframe)

```javascript
// Get your tileset
const tileset = terria.cesium.scene.primitives._primitives.find(
  (p) => p instanceof Cesium.Cesium3DTileset
);

// Draw the sphere
import { drawBoundingSphere } from "./lib/terrainClamp.js";
drawBoundingSphere(tileset, terria.cesium.scene, true);

// Or if already loaded, just enable the built-in debug:
tileset.debugShowBoundingVolume = true;
```

### 2. Get Detailed Explanation

```javascript
import { explainBoundingVolumes } from "./lib/terrainClamp.js";
explainBoundingVolumes(tileset);
```

### 3. Compare Sphere vs Box Calculations

```javascript
const boundingSphere = tileset.boundingSphere;
const center = boundingSphere.center;
const radius = boundingSphere.radius;
const centerCart = Cesium.Cartographic.fromCartesian(center);

console.log("=== COMPARISON ===");
console.log("Method 1: Bounding Sphere");
console.log("  Center:", centerCart.height.toFixed(2), "m");
console.log("  Radius:", radius.toFixed(2), "m");
console.log(
  "  Base (center - radius):",
  (centerCart.height - radius).toFixed(2),
  "m"
);

if (tileset.root?.boundingVolume?.minimumHeight) {
  console.log("\nMethod 2: Bounding Volume (BETTER!)");
  console.log(
    "  Minimum Height:",
    tileset.root.boundingVolume.minimumHeight.toFixed(2),
    "m"
  );
  console.log(
    "  Maximum Height:",
    tileset.root.boundingVolume.maximumHeight?.toFixed(2),
    "m"
  );

  const diff =
    centerCart.height - radius - tileset.root.boundingVolume.minimumHeight;
  console.log("\nDifference:", diff.toFixed(2), "m");
  if (Math.abs(diff) < 5) {
    console.log("✓ Very close! Sphere is accurate.");
  } else {
    console.log("⚠️ Significant difference - using minimumHeight is better.");
  }
}
```

### 4. Visual Comparison (All-in-One)

```javascript
(async function () {
  const scene = terria.cesium.scene;
  const tilesets = scene.primitives._primitives.filter(
    (p) => p instanceof Cesium.Cesium3DTileset
  );

  if (tilesets.length === 0) {
    console.error("No tilesets found");
    return;
  }

  const tileset = tilesets[0];

  // Enable all visualizations
  tileset.debugShowBoundingVolume = true;
  tileset.debugShowContentBoundingVolume = true;

  // Get values
  const bs = tileset.boundingSphere;
  const center = Cesium.Cartographic.fromCartesian(bs.center);
  const sphereBase = center.height - bs.radius;

  console.log("\n" + "=".repeat(60));
  console.log("BOUNDING VOLUME COMPARISON");
  console.log("=".repeat(60));

  console.log("\n🔵 BOUNDING SPHERE (What you see: wireframe)");
  console.log("   Center Height:", center.height.toFixed(2), "m");
  console.log("   Radius:", bs.radius.toFixed(2), "m");
  console.log("   → Calculated Base:", sphereBase.toFixed(2), "m");
  console.log(
    "   → Calculated Top:",
    (center.height + bs.radius).toFixed(2),
    "m"
  );

  if (tileset.root?.boundingVolume) {
    const bv = tileset.root.boundingVolume;
    console.log("\n📦 BOUNDING VOLUME (From tileset data)");

    if (bv.minimumHeight !== undefined) {
      console.log("   → Minimum Height:", bv.minimumHeight.toFixed(2), "m");
      console.log("   → Maximum Height:", bv.maximumHeight?.toFixed(2), "m");

      const error = sphereBase - bv.minimumHeight;
      console.log("\n📊 ACCURACY CHECK:");
      console.log("   Sphere base:", sphereBase.toFixed(2), "m");
      console.log("   Actual minimum:", bv.minimumHeight.toFixed(2), "m");
      console.log("   Error:", error.toFixed(2), "m");

      if (Math.abs(error) < 5) {
        console.log("   ✓ Excellent! Sphere is very accurate.");
      } else if (Math.abs(error) < 20) {
        console.log("   ⚠️ Acceptable error for terrain clamping.");
      } else {
        console.log("   ❌ Large error - using minimumHeight is important!");
      }
    } else {
      console.log("   ℹ️ minimumHeight not available in this tileset");
    }
  }

  // Try to get terrain height
  if (scene.clampToHeightSupported) {
    const terrainPoint = scene.clampToHeight(bs.center);
    if (terrainPoint) {
      const terrainCart = Cesium.Cartographic.fromCartesian(terrainPoint);
      const terrainHeight = terrainCart.height;

      console.log("\n🌍 TERRAIN HEIGHT:");
      console.log("   Terrain at object:", terrainHeight.toFixed(2), "m");
      console.log(
        "   Base - Terrain:",
        (sphereBase - terrainHeight).toFixed(2),
        "m"
      );

      if (sphereBase < terrainHeight) {
        console.log("   ❌ PROBLEM: Object base is BELOW terrain!");
      } else if (sphereBase - terrainHeight > 50) {
        console.log("   ⚠️ Object is floating high above terrain");
      } else {
        console.log("   ✓ Object positioning looks reasonable");
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("WHY WE USE BOUNDING SPHERE:");
  console.log("• Always available (tileset.boundingSphere)");
  console.log("• Simple calculation (center - radius)");
  console.log("• Rotation-independent");
  console.log("• Good enough for terrain clamping");
  console.log("• We improve with minimumHeight when available!");
  console.log("=".repeat(60) + "\n");
})();
```

## What You'll See

### Visual Elements

1. **Cesium's Built-in Debug Volume** (magenta/pink wireframe)
   - `tileset.debugShowBoundingVolume = true`
   - Shows the actual bounding sphere
2. **Content Bounding Volumes** (green wireframes)
   - `tileset.debugShowContentBoundingVolume = true`
   - Shows individual tile bounds

3. **Custom Sphere Primitive** (cyan wireframe)
   - `drawBoundingSphere(tileset, scene, true)`
   - Our custom visualization

### Console Output

```
════════════════════════════════════════════════════════════
BOUNDING VOLUME COMPARISON
════════════════════════════════════════════════════════════

🔵 BOUNDING SPHERE (What you see: wireframe)
   Center Height: 412.67 m
   Radius: 250.50 m
   → Calculated Base: 162.17 m
   → Calculated Top: 663.17 m

📦 BOUNDING VOLUME (From tileset data)
   → Minimum Height: 150.00 m
   → Maximum Height: 650.00 m

📊 ACCURACY CHECK:
   Sphere base: 162.17 m
   Actual minimum: 150.00 m
   Error: 12.17 m
   ⚠️ Acceptable error for terrain clamping.

🌍 TERRAIN HEIGHT:
   Terrain at object: 80.15 m
   Base - Terrain: 82.02 m
   ✓ Object positioning looks reasonable

════════════════════════════════════════════════════════════
WHY WE USE BOUNDING SPHERE:
• Always available (tileset.boundingSphere)
• Simple calculation (center - radius)
• Rotation-independent
• Good enough for terrain clamping
• We improve with minimumHeight when available!
════════════════════════════════════════════════════════════
```

## Turn Off Visualization

```javascript
// Disable all debug visuals
tileset.debugShowBoundingVolume = false;
tileset.debugShowContentBoundingVolume = false;

// Remove custom sphere (if using the module)
import { drawBoundingSphere } from "./lib/terrainClamp.js";
drawBoundingSphere(tileset, scene, false);
```

## Understanding the Colors

- **Magenta/Pink**: Cesium's built-in bounding volume debug
- **Green**: Content bounding volumes (individual tiles)
- **Cyan**: Our custom sphere primitive
- **Red/Green/Blue**: Coordinate axes (if enabled)

## Common Issues

**"Sphere not showing"**

- Zoom out - it might be very large
- Check console for errors
- Make sure tileset is loaded: `console.log(tileset.ready)`

**"Multiple spheres visible"**

- Magenta = Cesium's debug (built-in)
- Cyan = Our custom primitive (if you called `drawBoundingSphere`)
- Both show the same sphere, just different visualization methods

**"Sphere seems too big"**

- That's normal! Bounding spheres contain all geometry
- For elongated objects, there's lots of empty space
- Check `minimumHeight` for more accurate base
