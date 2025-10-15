# Authentication-Based Private Catalog

## Overview

The application now supports loading a private catalog (`/api/twin/private-catalog.json`) only for authenticated users. This allows you to have public and private data layers in your Terria map.

**Important:** All requests to `/api/` endpoints and domains containing `codex.localhost` automatically include the JWT token in the `Authorization: Bearer <token>` header.

## How It Works

### 1. Authentication Check

The application checks if the user is authenticated by:

- Reading the `access_token` cookie
- Decoding the JWT token
- Verifying it's not expired

### 2. Request Interception

**Global interceptors** are installed that automatically add authentication headers to:

- **XMLHttpRequest** - Used by TerriaJS for loading data layers
- **fetch API** - Used for modern HTTP requests
- All requests to URLs containing `/api/` or `codex.localhost`

This means:

- Private catalog JSON → Authenticated ✓
- GeoJSON data files → Authenticated ✓
- WMS/WFS requests → Authenticated ✓
- Any API endpoint → Authenticated ✓

### 3. Catalog Loading

**On Initial Load:**

- Public catalog loads from `initializationUrls` in `config.json` (e.g., `/api/twin/catalog.json`)
- If user is already authenticated (has valid token), private catalog loads automatically

**After Login:**

- When user logs in through the login modal, the `useAuth` hook detects the authentication state change
- Private catalog is loaded immediately via `terria.catalog.group.loadMembers()`
- Private data layers become available in the catalog

### 3. Implementation Details

**Files Modified:**

1. **`index.js`**
   - Added `isUserAuthenticated()` helper function
   - Loads private catalog on initial load if user is authenticated
   - Includes periodic check for authentication changes (fallback)

2. **`lib/Views/UserInterface.jsx`**
   - Added `useEffect` hook that watches `isAuthenticated` state
   - Loads private catalog immediately when user logs in
   - Uses `terria._privateCatalogLoaded` flag to prevent duplicate loading

3. **`wwwroot/config.json`**
   - Public catalog defined in `initializationUrls`
   - Private catalog NOT in config (loaded dynamically via code)

## Private Catalog File

Create your private catalog file at: `/api/twin/private-catalog.json`

Example structure:

```json
{
  "catalog": [
    {
      "type": "group",
      "name": "Private Data",
      "members": [
        {
          "type": "geojson",
          "name": "Confidential Locations",
          "url": "/api/data/confidential.geojson"
        }
      ]
    }
  ]
}
```

## API Endpoint Requirements

Your backend API must:

1. Serve `/api/twin/private-catalog.json`
2. Check authentication before serving this file
3. Return 401/403 for unauthenticated requests
4. Include proper CORS headers if needed

Example Django view:

```python
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from django.http import JsonResponse

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def private_catalog(request):
    catalog_data = {
        "catalog": [
            # Your private catalog items
        ]
    }
    return JsonResponse(catalog_data)
```

## Testing

1. **Not Authenticated:**
   - Visit the app without logging in
   - Only public catalog items should be visible
   - Console should NOT show "loading private catalog"

2. **Already Authenticated:**
   - Login to your backend
   - Refresh the Terria map
   - Console should show "User is authenticated, loading private catalog..."
   - Private data layers should appear in catalog

3. **Login During Session:**
   - Open app without authentication
   - Click "Login" button
   - After successful login, close modal
   - Console should show "User authenticated, loading private catalog..."
   - Private data layers should appear immediately

## Security Notes

1. **Backend Protection:** The private catalog endpoint MUST be protected on the backend. The frontend check is for UX only.

2. **Data Protection:** Private data URLs referenced in the catalog should also require authentication.

3. **Token Security:**
   - Access tokens are stored in cookies
   - Cookies should use `Secure` flag in production
   - Tokens have expiration times

4. **Domain Restrictions:**
   - Set domain restrictions on Cesium Ion and Bing Maps keys
   - This prevents unauthorized use even if keys are exposed in `config.json`

## Troubleshooting

**Private catalog not loading:**

- Check browser console for errors
- Verify `/api/twin/private-catalog.json` endpoint is accessible
- Check authentication token is valid
- Verify backend CORS headers allow the request

**Catalog loads but no data:**

- Check the JSON structure of private catalog
- Verify data URLs are correct and accessible
- Check backend authentication on data endpoints

**Loads twice:**

- This is normal - one check on init, one on login
- The `_privateCatalogLoaded` flag prevents duplicate loading
- No performance impact
