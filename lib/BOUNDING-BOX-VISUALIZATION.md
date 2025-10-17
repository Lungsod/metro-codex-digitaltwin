# Bounding Box Visualization Guide

## Overview

The terrain clamping system now includes visual debugging tools to help you verify that 3D objects are positioned correctly relative to the terrain.

## What Gets Visualized

When terrain clamping is applied, you'll see:

1. **Bounding Volume** - A wireframe sphere showing the object's bounds
2. **Content Bounding Volume** - Individual tile bounding volumes
3. **Coordinate Axes** (if available) - RGB axes showing object orientation
   - Red = X axis
   - Green = Y axis
   - Blue = Z axis

## Automatic Visualization

The bounding box is automatically enabled when `applyTerrainClamping()` is called. You'll see:

- A wireframe sphere around your 3D tileset
- Console logs with detailed bounding box information

## Manual Control

### Enable Bounding Box

```javascript
import { drawBoundingBox } from "./lib/terrainClamp.js";

// Enable visualization
drawBoundingBox(tileset, scene, true);
```

### Disable Bounding Box

```javascript
// Disable visualization
drawBoundingBox(tileset, scene, false);
```

### Check Specific Tileset

```javascript
// Get the tileset from your catalog item
const tileset = catalogItem.tileset;

// Draw its bounding box
drawBoundingBox(tileset, terria.cesium.scene, true);
```

## Console Output

When visualization is enabled, you'll see console logs like:

```
[drawBoundingBox] === Bounding Box Info ===
[drawBoundingBox] Center (Cartesian): Cartesian3 {x: ..., y: ..., z: ...}
[drawBoundingBox] Center (Lat/Lon/Height): {latitude: 10.3, longitude: 123.9, height: 412.67}
[drawBoundingBox] Radius: 250.5
[drawBoundingBox] Calculated base height: 162.17
[drawBoundingBox] Calculated top height: 663.17
[drawBoundingBox] === End Bounding Box Info ===
```

This helps you verify:

- **Base height**: Where the bottom of the object is
- **Top height**: Where the top of the object is
- **Radius**: How large the bounding sphere is

## Interpreting the Visualization

### Correct Positioning

- The bounding sphere should touch or be slightly above the terrain
- The bottom of the sphere should align with the terrain surface (+ your height offset)

### Object Underground (Problem)

- If you can only see the top half of the bounding sphere
- The bottom is below the terrain surface

### Object Too High (Problem)

- Large gap between terrain and the bottom of the bounding sphere
- Object appears to float too high

## Debugging Workflow

1. **Load your 3D tileset** with terrain clamping enabled
2. **Check the console logs** for bounding box info
3. **Verify visually**:
   - Is the bounding sphere touching the terrain?
   - Is the base height reasonable?
4. **Compare values**:
   - Terrain height vs Calculated base height
   - They should be close (within your heightOffset)

## Example: Checking Gaisano Building

```javascript
// Load the building with visualization
const tileset = await createClampedGaisanoTileset(scene, {
  enableClamping: true,
  heightOffset: 10 // 10m above terrain
});

// The bounding box will be automatically visible
// Check the console for detailed info

// To disable later:
drawBoundingBox(tileset, scene, false);
```

## Troubleshooting

### Bounding Box Not Showing

1. Make sure the tileset is loaded and visible
2. Check that `scene` is properly initialized
3. Look for errors in the console

### Bounding Box Wrong Size

The bounding sphere is an approximation. For complex buildings:

- It may be larger than the actual geometry
- This is normal - it's designed to contain all the geometry

### Want More Precise Bounds?

Check the root tile's bounding volume:

```javascript
console.log(tileset.root.boundingVolume);
```

This may give more accurate minimum/maximum heights.

## Disable After Testing

For production, you may want to disable the visualization:

```javascript
// In your terrain clamp code, comment out or remove:
// drawBoundingBox(tileset, scene, true);

// Or explicitly disable:
tileset.debugShowBoundingVolume = false;
tileset.debugShowContentBoundingVolume = false;
```
