# Bounding Volumes: Sphere vs Box - Explained

## TL;DR

We use **Bounding Sphere** because:

- ✅ Available immediately from `tileset.boundingSphere`
- ✅ Simple math: `base = centerHeight - radius`
- ✅ Rotation-invariant (same size from any angle)
- ✅ Used by Cesium internally

We **try to improve** accuracy by checking `tileset.root.boundingVolume.minimumHeight` when available.

---

## The Full Story

### What is a Bounding Volume?

A **bounding volume** is a simple geometric shape that completely contains a 3D object. It's used for:

- **Culling**: Don't render objects outside the view
- **Collision detection**: Quick checks if objects might intersect
- **Level of Detail (LOD)**: Decide which detail level to show
- **Terrain clamping**: Find the object's base height

### Types of Bounding Volumes

#### 1. 🔵 Bounding Sphere

**What it is:**
A sphere centered at the object's center that contains all geometry.

**Pros:**

- ✅ **Simple**: Just center point + radius
- ✅ **Fast**: Single distance check for culling
- ✅ **Rotation-invariant**: Same size regardless of object orientation
- ✅ **Always available**: `tileset.boundingSphere` exists once loaded
- ✅ **Used by Cesium**: Internal culling and LOD use spheres

**Cons:**

- ❌ **Less precise**: For elongated objects, contains lots of empty space
- ❌ **Overestimation**: May be much larger than actual geometry

**Example:**

```
     ___
   /     \      For a tall building (50m × 50m × 200m):
  |   📍  |     Sphere radius ≈ 150m (diagonal)
   \ ___ /      Contains ~70% empty space at corners
```

**Math:**

```javascript
const centerHeight = Cartographic.fromCartesian(boundingSphere.center).height;
const radius = boundingSphere.radius;
const baseHeight = centerHeight - radius; // Simple!
```

---

#### 2. 📦 Bounding Box (Axis-Aligned)

**What it is:**
A box aligned with X, Y, Z axes that contains all geometry.

**Pros:**

- ✅ **More precise**: Better fit for rectangular objects
- ✅ **Less empty space**: Typically 30-50% more efficient than sphere

**Cons:**

- ❌ **Rotation-dependent**: Size changes when object rotates
- ❌ **More complex**: Need min/max for 3 dimensions
- ❌ **Not always available**: May need calculation from vertices

**Example:**

```
    ┌─────────┐
    │         │    For same building:
    │    📍   │    Box: 50 × 50 × 200m
    │         │    Much more efficient!
    └─────────┘
```

---

#### 3. 📐 Oriented Bounding Box (OBB)

**What it is:**
A box oriented to best fit the object's geometry.

**Pros:**

- ✅ **Most precise**: Best fit for any shaped object
- ✅ **Rotation-invariant**: Oriented with the object
- ✅ **Efficient**: Minimal empty space

**Cons:**

- ❌ **Most complex**: Requires orientation matrix
- ❌ **Slower checks**: More math for collision/culling
- ❌ **Not standard**: Not all tilesets provide it

---

#### 4. 🌍 Geographic Region

**What it is:**
Min/max latitude, longitude, and height.

**Pros:**

- ✅ **Geographic**: Natural for mapping applications
- ✅ **Precise heights**: Often includes `minimumHeight` and `maximumHeight`
- ✅ **Common**: Most 3D Tiles use region bounding volumes

**Cons:**

- ❌ **Geographic only**: Doesn't work well for objects not aligned with Earth
- ❌ **Complex**: Need geodetic coordinate transforms

**Example in 3D Tiles JSON:**

```json
{
  "boundingVolume": {
    "region": [
      2.1623,
      0.5012, // west, south (radians)
      2.1624,
      0.5013, // east, north (radians)
      80.0, // minimumHeight (meters) ← WE WANT THIS!
      663.0 // maximumHeight (meters)
    ]
  }
}
```

---

## Our Approach in terrainClamp.js

### Step 1: Get Bounding Sphere (Always Available)

```javascript
const boundingSphere = tileset.boundingSphere;
const center = boundingSphere.center;
const radius = boundingSphere.radius;

// Calculate approximate base
const centerHeight = Cartographic.fromCartesian(center).height;
let objectBaseHeight = centerHeight - radius;
```

**Why start here?**

- Available immediately once tileset loads
- Simple, reliable calculation
- Works for all tileset types

### Step 2: Try to Get More Precise Height (If Available)

```javascript
if (tileset.root?.boundingVolume?.minimumHeight !== undefined) {
  objectBaseHeight = tileset.root.boundingVolume.minimumHeight;
  // This is more accurate! Often from the tileset JSON
}
```

**Why this is better?**

- `minimumHeight` is the actual lowest point of geometry
- Comes from the tileset metadata
- Much more precise than sphere approximation

### Step 3: Calculate Terrain Clamping

```javascript
const desiredBaseHeight = terrainHeight + heightOffset;
const heightDifference = desiredBaseHeight - objectBaseHeight;

// Apply the translation
tileset.root.transform = Matrix4.multiply(
  tileset.root.transform,
  Matrix4.fromTranslation(Cartesian3.fromElements(0, 0, heightDifference)),
  new Matrix4()
);
```

---

## Visualization Comparison

### Bounding Sphere (What You See with `drawBoundingSphere()`)

````
         ___...___
      .'           `.
    /                 \
   /      Building     \
  |    +-----------+    |   ← Cyan wireframe sphere
  |    |           |    |
  |    |           |    |   Radius: ~250m
  |    |           |    |   Base: centerHeight - radius
   \   +-----------+   /
    \                 /
     `.___     ___.'/
          `` ̈́```

  Bottom touches terrain at: base height
````

### Actual Bounding Box (If We Had It)

```
       +-----------+
       |           |
       |  Building |        ← More precise box
       |           |        Width: 50m, Height: 200m
       |           |        Base: actual minimum height
       +-----------+

  Bottom touches terrain at: minimum height
```

### The Difference

For a typical building:

- **Sphere base**: centerHeight - radius ≈ 412m - 250m = **162m**
- **Actual minimum**: From geometry = **150m**
- **Error**: ~12m (acceptable for terrain clamping!)

---

## Why Not Use Bounding Box?

### 1. Availability

Cesium3DTileset doesn't directly expose an axis-aligned or oriented bounding box. You'd need to:

- Parse the tileset JSON structure
- Convert region/box bounding volumes to Cartesian
- Handle different bounding volume types
- Wait for root tile to load

### 2. Complexity

```javascript
// Sphere: Simple
const base = centerHeight - radius;

// Box: Complex
const region = boundingVolume.region;
const west = region[0],
  south = region[1];
const east = region[2],
  north = region[3];
const minHeight = region[4],
  maxHeight = region[5];
// Still need conversions and checks...
```

### 3. Performance

- Sphere checks are O(1) - single distance calculation
- Box checks are O(1) but more operations
- For terrain clamping, we only do this once, so performance doesn't matter much
- But Cesium uses spheres internally, so it's optimized

### 4. Rotation Independence

- If you rotate the tileset, sphere stays the same size
- Box would need recalculation
- Sphere-based terrain clamping works regardless of orientation

---

## When Would You Want Bounding Box?

### Use Cases for Bounding Box:

1. **Precise collision detection** - For game physics
2. **Tight culling** - Rendering optimization
3. **Volume calculations** - Computing actual space used
4. **Floor planning** - Architectural applications

### For Terrain Clamping: Sphere is Fine Because:

- We only need approximate base height
- `minimumHeight` gives us precision when available
- 10-20m error is acceptable (smaller than heightOffset)
- User can adjust `heightOffset` if needed

---

## How to Visualize Both

### Draw Bounding Sphere

```javascript
import {
  drawBoundingSphere,
  explainBoundingVolumes
} from "./lib/terrainClamp.js";

// Draw cyan wireframe sphere
drawBoundingSphere(tileset, scene, true);

// Log detailed explanation
explainBoundingVolumes(tileset);
```

### Check Bounding Volume Details

```javascript
console.log("Sphere:", tileset.boundingSphere);
console.log("Root Volume:", tileset.root?.boundingVolume);
```

### Console Output Will Show:

```
🔵 BOUNDING SPHERE
├─ Center height: 412.67 m
├─ Radius: 250.50 m
├─ Base (center - radius): 162.17 m
└─ Top (center + radius): 663.17 m

📦 BOUNDING VOLUME
├─ minimumHeight: 150.00 m (MORE PRECISE!)
├─ maximumHeight: 650.00 m
└─ 💡 We use this when available!
```

---

## Summary

| Feature       | Bounding Sphere | Bounding Box | Our Choice             |
| ------------- | --------------- | ------------ | ---------------------- |
| Availability  | ✅ Always       | ❌ Sometimes | Sphere + minimumHeight |
| Precision     | ⚠️ Approximate  | ✅ Good      | ✅ Best of both        |
| Simplicity    | ✅ Very simple  | ⚠️ Complex   | ✅ Simple              |
| Rotation      | ✅ Invariant    | ❌ Dependent | ✅ Invariant           |
| Performance   | ✅ Fast         | ✅ Fast      | ✅ Fast                |
| Cesium Native | ✅ Yes          | ❌ No        | ✅ Yes                 |

**Winner: Bounding Sphere (with minimumHeight fallback)** 🏆

We get:

- ✅ Reliability (always available)
- ✅ Simplicity (easy math)
- ✅ Precision (use minimumHeight when available)
- ✅ Performance (Cesium-native)

Perfect balance for terrain clamping! 🎯
