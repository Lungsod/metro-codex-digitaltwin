# Integration Guide: Terrain Clamping for Gaisano 3D Tile

This guide explains how to integrate the terrain clamping solution into your TerriaJS digital twin project to fix the issue where the gaisano 3D tile appears under terrain in 3D terrain mode.

## Quick Start

### 1. Add the Terrain Clamping Module

Copy the `lib/terrainClamp.js` file to your project's lib directory (it's already there).

### 2. Update Your Catalog Configuration

Modify your catalog configuration to use the clamped tileset. You can do this by:

#### Option A: Programmatic Integration (Recommended)

Add this code to your `index.js` or appropriate initialization file:

```javascript
import { createClampedGaisanoTileset } from "./lib/terrainClamp.js";

// After terria is initialized
terria.loadInitSources().then(async () => {
  // Wait for the scene to be ready
  const scene = terria.viewer.scene;

  try {
    // Create the clamped gaisano tileset
    const gaisanoTileset = await createClampedGaisanoTileset(scene, {
      heightOffset: 0, // Adjust if needed
      enableClamping: true,
      maximumScreenSpaceError: 16,
      dynamicScreenSpaceError: true
    });

    // Add to the scene
    scene.primitives.add(gaisanoTileset);

    // Zoom to the tileset
    terria.viewer.camera.viewBoundingSphere(gaisanoTileset.boundingSphere);

    console.log("Gaisano tileset loaded with terrain clamping");
  } catch (error) {
    console.error("Failed to load gaisano tileset:", error);
  }
});
```

#### Option B: Catalog JSON Integration

The terrain clamping functionality has been integrated into your UserInterface.jsx file. To use it with your catalog items, simply use the `3d-tiles-clamped` type:

```json
{
  "name": "Gaisano Building (Clamped)",
  "type": "3d-tiles-clamped",
  "url": "./gaisano/tileset.json",
  "customProperties": {
    "enableClamping": true,
    "heightOffset": 0
  }
}
```

The custom catalog member type `3d-tiles-clamped` is automatically registered when the UI loads and includes terrain clamping functionality.

### 3. Configure Terrain

Ensure terrain is properly configured in your `config.json`:

```json
{
  "parameters": {
    "useCesiumIonTerrain": true,
    "cesiumIonAccessToken": "your-ion-access-token-here"
  }
}
```

## Configuration Options

### Height Offset

Adjust the `heightOffset` parameter if the building appears too high or low:

```javascript
const gaisanoTileset = await createClampedGaisanoTileset(scene, {
  heightOffset: 5 // Raise 5 meters above terrain
});
```

### Debug Mode

Enable debug mode to see what's happening:

```javascript
const gaisanoTileset = await createClampedGaisanoTileset(scene, {
  enableDebug: true
});
```

## Testing

### Using the Test HTML File

1. Open `examples/terrain-clamp-test.html` in your browser
2. Use the controls to test different scenarios:
   - Toggle terrain on/off
   - Toggle clamping on/off
   - Adjust height offset
   - Switch between 2D/3D modes

### Testing in Your TerriaJS Application

1. Load your application
2. Navigate to the gaisano area
3. Toggle between 3D smooth and 3D terrain modes
4. The building should stay on the terrain surface in both modes

## Troubleshooting

### Building Still Appears Under Terrain

1. **Check Height Offset**: Try increasing the `heightOffset` value
2. **Verify Terrain Loading**: Ensure terrain is fully loaded before applying clamping
3. **Timing Issues**: Add a delay before applying clamping:

```javascript
setTimeout(async () => {
  await applyTerrainClamping(tileset, scene, heightOffset);
}, 2000); // Wait 2 seconds
```

### Performance Issues

1. **Disable Debug**: Set `enableDebug: false`
2. **Reduce Updates**: Don't apply clamping on every frame
3. **Cache Results**: Store the calculated height and reuse

### Integration Issues

1. **Module Loading**: Ensure proper import paths
2. **Async/Await**: Make sure to await the tileset loading
3. **Scene Access**: Verify the scene is available when clamping is applied

## Advanced Usage

### Multiple Tilesets

For multiple tilesets that need clamping:

```javascript
const tilesets = [
  { url: "./gaisano/tileset.json", name: "Gaisano" },
  { url: "./other-building/tileset.json", name: "Other Building" }
];

for (const tilesetInfo of tilesets) {
  const tileset = await createClampedTileset(tilesetInfo.url, {
    scene: terria.viewer.scene,
    heightOffset: 0
  });

  scene.primitives.add(tileset);
}
```

### Dynamic Height Adjustment

Create a UI control for users to adjust the height:

```javascript
// Add to your TerriaJS UI
const heightControl = {
  name: "Building Height",
  type: "slider",
  min: -50,
  max: 50,
  value: 0,
  onChange: async (value) => {
    if (gaisanoTileset) {
      adjustTilesetHeight(gaisanoTileset, value - currentHeight);
      currentHeight = value;
    }
  }
};

// Add to your view model or UI component
```

## File Locations

After integration, your project structure should include:

```
metro-codex-digitaltwin/
├── lib/
│   ├── terrainClamp.js          # Core clamping functionality
│   └── README-terrain-clamp.md  # Documentation
├── examples/
│   ├── clamped-gaisano-example.js  # Example implementations
│   └── terrain-clamp-test.html     # Test page
├── gaisano/
│   ├── tileset.json             # Your 3D tileset
│   └── Data/                    # Tile data
├── index.js                     # Modified with clamping code
└── serverconfig.json            # Your server config
```

## Best Practices

1. **Initialize After Scene Ready**: Ensure the scene is fully initialized before applying clamping
2. **Handle Loading States**: Show loading indicators while tilesets are being processed
3. **Error Handling**: Wrap clamping operations in try-catch blocks
4. **Performance**: Apply clamping once unless you need dynamic updates
5. **Testing**: Test in both 3D smooth and 3D terrain modes

## Support

If you encounter issues:

1. Check the browser console for error messages
2. Verify the tileset loads without clamping first
3. Test with the standalone HTML file
4. Ensure terrain provider is working correctly

## Future Enhancements

Consider these improvements for production use:

1. **Caching**: Cache terrain heights for better performance
2. **Multi-point Sampling**: Sample multiple points for better accuracy
3. **Automatic Detection**: Automatically detect when clamping is needed
4. **Persistence**: Save user height preferences
5. **Animation**: Smooth transitions when applying height adjustments
