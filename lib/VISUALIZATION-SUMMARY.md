# Bounding Box Visualization - Summary

## What Was Added

I've added bounding box visualization tools to help you verify terrain clamping is working correctly.

## Key Features

### 1. Automatic Visualization

When `applyTerrainClamping()` is called, the tileset's bounding box is automatically displayed:

- ✅ Wireframe bounding sphere
- ✅ Content bounding volumes
- ✅ Detailed console logs with height calculations

### 2. New Functions

#### `drawBoundingBox(tileset, scene, enable)`

Manually toggle bounding box visualization on/off.

```javascript
import { drawBoundingBox } from "./lib/terrainClamp.js";

// Enable
drawBoundingBox(tileset, scene, true);

// Disable
drawBoundingBox(tileset, scene, false);
```

#### `drawHeightMarkers(tileset, scene, terrainHeight)`

Log detailed height information for debugging.

### 3. Enhanced Logging

When terrain clamping runs, you'll see:

```
[drawBoundingBox] === Bounding Box Info ===
[drawBoundingBox] Center Height: 412.67 m
[drawBoundingBox] Radius: 250.50 m
[drawBoundingBox] Calculated base height: 162.17 m
[drawBoundingBox] Calculated top height: 663.17 m
[drawBoundingBox] === End Bounding Box Info ===
```

## How to Use

### Automatic (Recommended)

Just load your 3D tileset as normal - the bounding box will appear automatically when terrain clamping is applied.

### Manual Toggle

Use the browser console:

```javascript
// Enable
tileset.debugShowBoundingVolume = true;

// Disable
tileset.debugShowBoundingVolume = false;
```

### Quick Debug Script

See `DEBUG-CONSOLE-COMMANDS.md` for a complete console script you can copy/paste.

## What to Look For

### ✅ Correct Positioning

- Bounding sphere touches or is slightly above terrain
- Bottom of sphere aligns with terrain surface (+ your height offset)
- Console shows `Base - Terrain: ~10.00 m` (or your heightOffset value)

### ❌ Object Underground

- Only top half of bounding sphere visible
- Console shows negative `Base - Terrain` value
- **Fix**: Increase `heightOffset` or check height calculation

### ❌ Object Too High

- Large gap between terrain and sphere bottom
- Console shows `Base - Terrain` >> 10m
- **Fix**: Decrease `heightOffset` or check terrain height sampling

## Files Modified

- ✅ `lib/terrainClamp.js` - Added visualization functions
- ✅ `lib/BOUNDING-BOX-VISUALIZATION.md` - Detailed guide
- ✅ `lib/DEBUG-CONSOLE-COMMANDS.md` - Console commands reference
- ✅ `lib/HEIGHT-CALCULATION-FIX.md` - Height calculation explanation

## Next Steps

1. **Rebuild the project** (if you haven't already):

   ```bash
   yarn gulp --baseHref="/twin/"
   ```

2. **Load your application** in the browser

3. **Load a 3D tileset** - you should see the bounding box automatically

4. **Check the console** for detailed height information

5. **Verify positioning** - the bounding sphere bottom should be at terrain + offset

6. **Optional**: Use the console commands in `DEBUG-CONSOLE-COMMANDS.md` for more detailed analysis

## Disabling for Production

To disable automatic visualization, comment out this line in `applyTerrainClamping()`:

```javascript
// drawBoundingBox(tileset, scene, true);
```

Or set the properties manually:

```javascript
tileset.debugShowBoundingVolume = false;
tileset.debugShowContentBoundingVolume = false;
```

## Troubleshooting

**Bounding box not showing?**

- Check console for errors
- Verify tileset is loaded: `console.log(tileset)`
- Make sure scene is initialized: `console.log(scene)`

**Wrong size?**

- Bounding spheres are approximations
- They contain all geometry, so may be larger than expected
- Check `tileset.root.boundingVolume` for more precise bounds

**Can't see the whole box?**

- Zoom out or adjust camera angle
- Box might be partially underground (which is what we're trying to fix!)
