# Terrain Clamping for 3D Tiles

This module provides a solution for clamping 3D tiles to terrain height in Cesium/TerriaJS. It addresses the issue where 3D tiles appear under terrain when using 3D terrain mode instead of 3D smooth mode.

## Problem

When loading 3D tiles (like the gaisano building) in Cesium with terrain enabled, the tiles may appear below the terrain surface. This happens because the tileset's vertical positioning doesn't account for the actual terrain height at that location.

## Solution

The terrain clamping solution automatically detects the terrain height at the tileset's position and adjusts the tileset's model matrix to place it correctly on the terrain surface.

## Usage

### Basic Usage

```javascript
import { createClampedGaisanoTileset } from "./lib/terrainClamp.js";

// Load the gaisano tileset with terrain clamping
const tileset = await createClampedGaisanoTileset(viewer.scene, {
  heightOffset: 0, // Optional: adjust height if needed
  enableClamping: true
});

// Add to scene
viewer.scene.primitives.add(tileset);
```

### Advanced Usage with Example

```javascript
import {
  loadGaisanoWithClamping,
  createHeightAdjustmentControl
} from "./examples/clamped-gaisano-example.js";

// Load with clamping and additional options
const tileset = await loadGaisanoWithClamping(viewer, {
  heightOffset: 5, // Raise building 5 meters above terrain
  enableDebug: true,
  maximumScreenSpaceError: 8
});

// Create a UI control for manual height adjustment
createHeightAdjustmentControl(viewer, tileset);
```

### Manual Clamping

For more control, you can load the tileset normally and apply clamping manually:

```javascript
import { loadGaisanoManualClamping } from "./examples/clamped-gaisano-example.js";

const tileset = await loadGaisanoManualClamping(viewer, {
  autoClamp: true,
  heightOffset: 0
});
```

## API Reference

### createClampedTileset(url, options)

Creates a clamped 3D tileset that adjusts its height to match terrain.

**Parameters:**

- `url` (string|Resource): The URL to the tileset JSON file
- `options` (Object): Configuration options
  - `scene` (Scene): The Cesium scene (required for clamping)
  - `heightOffset` (number): Additional height offset after clamping (default: 0)
  - `enableClamping` (boolean): Whether to enable terrain clamping (default: true)
  - Any other Cesium3DTileset options

**Returns:** Promise<Cesium3DTileset>

### createClampedGaisanoTileset(scene, options)

Convenience function specifically for the gaisano tileset.

**Parameters:**

- `scene` (Scene): The Cesium scene
- `options` (Object): Additional options

**Returns:** Promise<Cesium3DTileset>

### adjustTilesetHeight(tileset, heightOffset)

Manually adjust a tileset's height.

**Parameters:**

- `tileset` (Cesium3DTileset): The tileset to adjust
- `heightOffset` (number): The height offset in meters

## Configuration Options

### Height Offset

The `heightOffset` parameter allows you to fine-tune the vertical position of the tileset after clamping:

- Positive values: Raise the tileset above terrain
- Negative values: Lower the tileset (may cause intersection with terrain)
- Default: 0 (exactly on terrain surface)

### Clamping Behavior

- The system samples terrain height at the tileset's center position
- Multiple sample points can be used for better accuracy (in manual mode)
- The tileset's model matrix is adjusted to place it at the correct height
- Clamping is re-applied when new tiles are loaded

## Troubleshooting

### Tileset Still Appears Under Terrain

1. Check the `heightOffset` value - try increasing it
2. Ensure terrain is loaded and visible in the scene
3. Verify the tileset has finished loading (`tileset.readyPromise`)

### Performance Issues

1. Disable debug mode (`enableDebug: false`)
2. Reduce the number of sample points for height detection
3. Consider applying clamping only once rather than continuously

### Inconsistent Height

1. The terrain provider might not have high-resolution data for the area
2. Try using multiple sample points for better averaging
3. Manually adjust the `heightOffset` to compensate

## Integration with TerriaJS

To integrate with your TerriaJS application:

1. Add the terrain clamping module to your project
2. Import and use the functions in your catalog initialization
3. Ensure the scene is available before attempting to clamp

```javascript
// In your TerriaJS initialization code
import { createClampedGaisanoTileset } from "./lib/terrainClamp.js";

// After the viewer is initialized
const tileset = await createClampedGaisanoTileset(terria.viewer.scene, {
  heightOffset: 2
});

terria.viewer.scene.primitives.add(tileset);
```

## File Structure

```
metro-codex-digitaltwin/
├── lib/
│   ├── terrainClamp.js          # Core terrain clamping functionality
│   └── README-terrain-clamp.md  # This documentation
├── examples/
│   └── clamped-gaisano-example.js  # Example usage and advanced features
└── gaisano/
    ├── tileset.json             # Your 3D tileset
    └── Data/                    # Tile data
```

## Dependencies

- Cesium/TerriaJS
- ES6 modules support
- Async/await support

## Notes

- The clamping works best with terrain providers that have accurate height data
- The solution modifies the tileset's model matrix, which affects all tiles in the set
- For large tilesets, consider applying clamping only to the root tile for performance
- The height adjustment is applied in world coordinates, not local tile coordinates
