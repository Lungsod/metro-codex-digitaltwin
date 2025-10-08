import ConsoleAnalytics from "terriajs/lib/Core/ConsoleAnalytics";
import GoogleAnalytics from "terriajs/lib/Core/GoogleAnalytics";
import registerCatalogMembers from "terriajs/lib/Models/Catalog/registerCatalogMembers";
import registerSearchProviders from "terriajs/lib/Models/SearchProviders/registerSearchProviders";
import ShareDataService from "terriajs/lib/Models/ShareDataService";
import Terria from "terriajs/lib/Models/Terria";
import ViewState from "terriajs/lib/ReactViewModels/ViewState";
import registerCustomComponentTypes from "terriajs/lib/ReactViews/Custom/registerCustomComponentTypes";
import updateApplicationOnHashChange from "terriajs/lib/ViewModels/updateApplicationOnHashChange";
import updateApplicationOnMessageFromParentWindow from "terriajs/lib/ViewModels/updateApplicationOnMessageFromParentWindow";
import loadPlugins from "./lib/Core/loadPlugins";
import showGlobalDisclaimer from "./lib/Views/showGlobalDisclaimer";
import plugins from "./plugins";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";

// Helper function to check if user is authenticated
const isUserAuthenticated = () => {
  const accessToken = Cookies.get("access_token");

  if (!accessToken) {
    return false;
  }

  try {
    const decoded = jwtDecode(accessToken);
    const currentTime = Date.now() / 1000;

    // Check if token is expired
    if (decoded.exp < currentTime) {
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to decode token:", error);
    return false;
  }
};

// Helper function to load private catalog with authentication
const loadPrivateCatalogWithAuth = async (terria) => {
  const accessToken = Cookies.get("access_token");

  if (!accessToken) {
    console.error("No access token found");
    return;
  }

  try {
    console.log("Loading private catalog with authentication...");

    // Fetch the catalog JSON with auth header
    const response = await fetch("/api/twin/private-catalog.json", {
      credentials: "include",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      }
    });

    console.log("Private catalog response status:", response.status);

    if (!response.ok) {
      throw new Error(
        `Failed to load private catalog: ${response.status} ${response.statusText}`
      );
    }

    const catalogData = await response.json();
    console.log("Private catalog data:", catalogData);

    // Load the catalog into terria
    if (catalogData.catalog && Array.isArray(catalogData.catalog)) {
      console.log("Checking for new catalog items...");

      try {
        // Get existing catalog member names/IDs
        const existingMembers = terria.catalog.group.memberModels || [];
        const existingNames = new Set(
          existingMembers.map((m) => m.name || m.uniqueId)
        );

        // Filter out items that are already loaded
        const newItems = catalogData.catalog.filter((item) => {
          const itemExists =
            existingNames.has(item.name) || existingNames.has(item.id);
          if (itemExists) {
            console.log(
              `Catalog item "${item.name}" already exists, skipping...`
            );
          }
          return !itemExists;
        });

        console.log(
          `Found ${newItems.length} new items to add (${catalogData.catalog.length - newItems.length} already loaded)`
        );

        // Add only new items (they will appear at the top of the catalog)
        for (const item of newItems) {
          console.log("Adding new catalog item:", item.name);

          // Use addMembersFromJson with the proper stratum
          const result = await terria.catalog.group.addMembersFromJson(
            "user", // Use user stratum for dynamically added items
            [item] // Pass as array
          );

          console.log("Item added, result:", result);
        }

        console.log(
          "Final catalog order:",
          terria.catalog.group.memberModels?.map((m) => m.name || m.uniqueId)
        );

        if (newItems.length > 0) {
          console.log("Private catalog updated with new items!");
        } else {
          console.log("Private catalog is up to date.");
        }
      } catch (error) {
        console.error("Failed to load private catalog:", error);
        console.error("Error stack:", error.stack);
      }
    } else {
      console.error("Invalid catalog data structure:", catalogData);
    }
  } catch (error) {
    console.error("Failed to load private catalog:", error);
    throw error;
  }
};

const terriaOptions = {
  baseUrl: "/twin/build/TerriaJS"
};

// we check exact match for development to reduce chances that production flag isn't set on builds(?)
if (process.env.NODE_ENV === "development") {
  terriaOptions.analytics = new ConsoleAnalytics();
} else {
  terriaOptions.analytics = new GoogleAnalytics();
}

// Construct the TerriaJS application, arrange to show errors to the user, and start it up.
const terria = new Terria(terriaOptions);

// Configure authentication for all API requests
// Intercept XMLHttpRequest for data loading
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function (method, url, ...args) {
  this._url = url;
  return originalXHROpen.apply(this, [method, url, ...args]);
};

XMLHttpRequest.prototype.send = function (...args) {
  // If request is to /api/ (but NOT /api/auth/*), add authentication header
  // Skip auth endpoints to avoid interfering with the AuthProvider
  if (
    this._url &&
    (this._url.includes("/api/") || this._url.includes("codex.localhost")) &&
    !this._url.includes("/api/accounts/")
  ) {
    const accessToken = Cookies.get("access_token");
    if (accessToken && !this.getResponseHeader("Authorization")) {
      console.log("Adding auth header to XHR request:", this._url);
      try {
        this.setRequestHeader("Authorization", `Bearer ${accessToken}`);
      } catch (e) {
        console.warn(
          "Failed to set Authorization header (may already be sent):",
          e.message
        );
      }
    }
  }
  return originalXHRSend.apply(this, args);
};

// Also intercept fetch API
const originalFetch = window.fetch;
window.fetch = function (url, options = {}) {
  // If request is to /api/ (but NOT /api/auth/*), add authentication header
  // Skip auth endpoints to avoid interfering with the AuthProvider
  const urlString = typeof url === "string" ? url : url.url;
  if (
    urlString &&
    (urlString.includes("/api/") || urlString.includes("codex.localhost")) &&
    !urlString.includes("/api/accounts/")
  ) {
    const accessToken = Cookies.get("access_token");
    if (accessToken) {
      console.log("Adding auth header to fetch request:", urlString);

      // Don't override if Authorization header already exists
      const existingHeaders = options.headers || {};
      const hasAuthHeader =
        existingHeaders instanceof Headers
          ? existingHeaders.has("Authorization")
          : existingHeaders.Authorization || existingHeaders.authorization;

      if (!hasAuthHeader) {
        // Create a new options object to avoid mutating the original
        options = {
          ...options,
          headers:
            existingHeaders instanceof Headers
              ? existingHeaders
              : {
                  ...existingHeaders,
                  Authorization: `Bearer ${accessToken}`
                }
        };

        // If it was a Headers object, add the auth header properly
        if (options.headers instanceof Headers) {
          options.headers.set("Authorization", `Bearer ${accessToken}`);
        }
      }
    }
  }
  return originalFetch.call(this, url, options);
};

// Create the ViewState before terria.start so that errors have somewhere to go.
const viewState = new ViewState({
  terria: terria
});

// Register all types of catalog members in the core TerriaJS.  If you only want to register a subset of them
// (i.e. to reduce the size of your application if you don't actually use them all), feel free to copy a subset of
// the code in the registerCatalogMembers function here instead.
registerCatalogMembers();

// Register custom search providers in the core TerriaJS. If you only want to register a subset of them, or to add your own,
// insert your custom version of the code in the registerSearchProviders function here instead.
registerSearchProviders();

// Register custom components in the core TerriaJS.  If you only want to register a subset of them, or to add your own,
// insert your custom version of the code in the registerCustomComponentTypes function here instead.
registerCustomComponentTypes(terria);

if (process.env.NODE_ENV === "development") {
  window.viewState = viewState;
}

export default terria
  .start({
    applicationUrl: window.location,
    configUrl: "config.json",
    shareDataService: new ShareDataService({
      terria: terria
    }),
    beforeRestoreAppState: () => {
      // Load plugins before restoring app state because app state may
      // reference plugin components and catalog items.
      return loadPlugins(viewState, plugins).catch((error) => {
        console.error(`Error loading plugins`);
        console.error(error);
      });
    }
  })
  .catch(function (e) {
    terria.raiseErrorToUser(e);
  })
  .finally(function () {
    // Override the default document title with appName. Check first for default
    // title, because user might have already customized the title in
    // index.ejs
    if (document.title === "Terria Map") {
      document.title = terria.appName;
    }

    // Load init sources like init files and share links
    terria.loadInitSources().then((result) => result.raiseError(terria));

    // Load private catalog if user is authenticated (always check for updates)
    if (isUserAuthenticated()) {
      console.log(
        "User is authenticated, checking for private catalog updates..."
      );
      loadPrivateCatalogWithAuth(terria).catch((error) => {
        console.error("Error loading private catalog:", error);
      });
    }

    try {
      // Automatically update Terria (load new catalogs, etc.) when the hash part of the URL changes.
      updateApplicationOnHashChange(terria, window);
      updateApplicationOnMessageFromParentWindow(terria, window);

      // Show a modal disclaimer before user can do anything else.
      if (terria.configParameters.globalDisclaimer) {
        showGlobalDisclaimer(viewState);
      }

      // Add font-imports
      const fontImports = terria.configParameters.theme?.fontImports;
      if (fontImports) {
        const styleSheet = document.createElement("style");
        styleSheet.type = "text/css";
        styleSheet.innerText = fontImports;
        document.head.appendChild(styleSheet);
      }
    } catch (e) {
      console.error(e);
      console.error(e.stack);
    }
  })
  .then(() => {
    return { terria, viewState };
  })
  .then(({ terria, viewState }) => {
    // Track previous authentication state to detect changes
    let wasAuthenticated = isUserAuthenticated();

    // Listen for authentication changes (when user logs in)
    const checkAndLoadPrivateCatalog = () => {
      const nowAuthenticated = isUserAuthenticated();

      // Only load catalog when authentication state changes from false to true (user just logged in)
      if (nowAuthenticated && !wasAuthenticated) {
        console.log(
          "User authenticated via periodic check, checking for private catalog updates..."
        );
        loadPrivateCatalogWithAuth(terria).catch((error) => {
          console.error("Failed to load private catalog after login:", error);
        });
      }

      // Update the previous state
      wasAuthenticated = nowAuthenticated;
    };

    // Check periodically for authentication changes
    // This will catch when user logs in through the modal
    setInterval(checkAndLoadPrivateCatalog, 2000);

    return { terria, viewState };
  });
