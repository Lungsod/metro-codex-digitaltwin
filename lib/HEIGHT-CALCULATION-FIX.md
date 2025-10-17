# Terrain Clamping Height Calculation Fix

## Problem Identified

The 3D objects were appearing underground because the height calculation was using the **bounding sphere center height** instead of the **object base height**.

### Original Issue

```javascript
// OLD CODE - INCORRECT
const originalHeight = originalCartographic.height; // Center of bounding sphere
const heightDifference = terrainHeight - originalHeight + heightOffset;
// Result: Object center placed at terrain → bottom half goes underground
```

**Example from logs:**

- Bounding sphere center height: ~412.67m
- Terrain height: ~80.15m
- Height difference: -332.52m
- **Result**: Object moved down 332m, placing its CENTER at terrain level, pushing the bottom underground

## The Solution

Calculate the **object base height** by subtracting the bounding sphere radius from the center height:

```javascript
// NEW CODE - CORRECT
const centerHeight = centerCartographic.height;
const radius = boundingSphere.radius;
const objectBaseHeight = centerHeight - radius; // Bottom of object

const desiredBaseHeight = terrainHeight + heightOffset;
const heightDifference = desiredBaseHeight - objectBaseHeight;
// Result: Object BASE placed at terrain + offset → entire object above ground
```

### Calculation Breakdown

1. **Find object base**: `objectBaseHeight = centerHeight - radius`
2. **Set desired height**: `desiredBaseHeight = terrainHeight + heightOffset`
3. **Calculate adjustment**: `heightDifference = desiredBaseHeight - objectBaseHeight`

### Example with Real Values

Given:

- Center height: 412.67m
- Bounding radius: ~250m (estimated)
- Terrain height: 80.15m
- Height offset: 10m

Calculation:

```
objectBaseHeight = 412.67 - 250 = 162.67m
desiredBaseHeight = 80.15 + 10 = 90.15m
heightDifference = 90.15 - 162.67 = -72.52m
```

**Result**: Object moved down 72.52m, placing its BASE 10m above terrain ✓

## Changes Made

### 1. Calculate Object Base Height

```javascript
const center = boundingSphere.center;
const radius = boundingSphere.radius;
const centerHeight = Cartographic.fromCartesian(center).height;
const objectBaseHeight = centerHeight - radius;
```

### 2. Improved Height Detection

- Try to get `minimumHeight` from bounding volume if available
- Fall back to calculated base height (center - radius)
- Added detailed logging for debugging

### 3. Correct Height Difference Calculation

```javascript
const desiredBaseHeight = terrainHeight + heightOffset;
const heightDifference = desiredBaseHeight - objectBaseHeight;
```

### 4. Updated Default Height Offset

- Changed from `0` to `10` meters (objects float 10m above terrain by default)
- Can be customized via `heightOffset` parameter

## Enhanced Logging

The fix includes detailed logging to help diagnose issues:

```
[applyTerrainClamping] Bounding sphere center height: X
[applyTerrainClamping] Bounding sphere radius: Y
[applyTerrainClamping] Calculated object base height: Z
[applyTerrainClamping] Terrain height: T
[applyTerrainClamping] Desired base height: T + offset
[applyTerrainClamping] Height difference to apply: difference
```

## Usage

### Default (10m above terrain)

```javascript
const tileset = await createClampedTileset(url, {
  scene: scene,
  enableClamping: true
});
```

### Custom height offset

```javascript
const tileset = await createClampedTileset(url, {
  scene: scene,
  enableClamping: true,
  heightOffset: 5 // 5 meters above terrain
});
```

### Place exactly on terrain

```javascript
const tileset = await createClampedTileset(url, {
  scene: scene,
  enableClamping: true,
  heightOffset: 0 // Exactly at terrain level
});
```

## Testing

After this fix, you should see:

1. Objects positioned with their base at terrain level (+ offset)
2. No objects appearing underground
3. Consistent height across different terrain elevations
4. Detailed logs showing the calculation process
