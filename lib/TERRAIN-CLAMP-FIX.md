# Terrain Clamp Fix for TerriaJS Integration

## Problem Identified

When `Cesium3DTilesCatalogItem` is loaded in TerriaJS, the terrain clamping adjustments were being overwritten. Here's why:

### How Cesium3DTiles are Rendered in TerriaJS

1. **Mixin Architecture**: `Cesium3DTilesCatalogItem` extends `Cesium3dTilesMixin` which manages the tileset
2. **Model Matrix Recalculation**: The `mapItems` computed property (in `Cesium3dTilesMixin`) continuously recalculates and applies `tileset.modelMatrix` based on:
   - `tileset.root.transform` (original root transform)
   - Catalog item traits (origin, rotation, scale)
3. **Automatic Updates**: Every time observable properties change, `mapItems` runs and resets the `modelMatrix`

### The Issue

The original terrain clamping code modified `tileset.modelMatrix` directly:

```javascript
tileset.modelMatrix = clampedMatrix; // This gets overwritten!
```

TerriaJS's `mapItems` computed would then recalculate:

```typescript
this.tileset.modelMatrix = this.modelMatrix; // Overwrites our clamping!
```

This happened because TerriaJS computes `modelMatrix` from `originalRootTransform`:

```typescript
@computed
get modelMatrix(): Matrix4 {
  const modelMatrixFromTraits =
    this.computeModelMatrixFromTransformationTraits(
      this.originalRootTransform  // Uses this as the base!
    );
  return modelMatrixFromTraits;
}
```

## The Solution

**Modify `tileset.root.transform` instead of `tileset.modelMatrix`**

Since TerriaJS uses `root.transform` as the basis for its `modelMatrix` calculations, modifying the root transform ensures the terrain clamping persists.

### Changes Made

1. **Primary approach**: Update `tileset.root.transform` with the clamping offset
2. **Fallback**: If `root.transform` is not available, apply to `modelMatrix` (for non-TerriaJS usage)

### Updated Code Pattern

```javascript
// Apply to root transform (persists through TerriaJS recalculations)
if (defined(tileset.root) && defined(tileset.root.transform)) {
  const currentRootTransform = tileset.root.transform;
  const clampedRootTransform = Matrix4.multiply(
    currentRootTransform,
    translationMatrix,
    new Matrix4()
  );
  tileset.root.transform = clampedRootTransform;
} else {
  // Fallback for standalone usage
  tileset.modelMatrix = clampedMatrix;
}
```

## Functions Updated

- `applyTerrainClamping()` - Main clamping function
- `adjustTilesetHeight()` - Manual height adjustment helper

## Testing

To verify the fix works:

1. Load a 3D tiles catalog item in TerriaJS
2. Check that terrain clamping is applied correctly
3. Verify that the clamping persists even after:
   - Camera movements
   - Other catalog items are loaded
   - Scene properties change

## Technical Details

### TerriaJS Transform Pipeline

```
tileset.root.transform (stored as originalRootTransform)
    ↓
Combined with traits (origin, rotation, scale)
    ↓
Computed modelMatrix
    ↓
Applied to tileset.modelMatrix (every render update)
```

By modifying `root.transform`, we inject our clamping offset at the beginning of this pipeline, ensuring it's preserved through all subsequent calculations.
