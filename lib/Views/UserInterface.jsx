import PropTypes from "prop-types";
import RelatedMaps from "terriajs/lib/ReactViews/RelatedMaps/RelatedMaps";
import { MenuLeft } from "terriajs/lib/ReactViews/StandardUserInterface/customizable/Groups";
import MenuItem from "terriajs/lib/ReactViews/StandardUserInterface/customizable/MenuItem";
import StandardUserInterface from "terriajs/lib/ReactViews/StandardUserInterface/StandardUserInterface";
import version from "../../version";
import React, { useState } from "react";
import {
  AuthProvider,
  Navigation,
  LoginModal,
  useAuth,
  Logo
} from "@smartmetro/codex-auth";
import Cookies from "js-cookie";

// Helper function to load private catalog with authentication
const loadPrivateCatalogWithAuth = async (terria) => {
  const accessToken = Cookies.get("access_token");

  if (!accessToken) {
    console.error("[UserInterface] No access token found");
    return;
  }

  try {
    console.log(
      "[UserInterface] Loading private catalog with authentication..."
    );

    // Fetch the catalog JSON with auth header
    const response = await fetch("/api/twin/private-catalog.json", {
      credentials: "include",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      }
    });

    console.log(
      "[UserInterface] Private catalog response status:",
      response.status
    );

    if (!response.ok) {
      throw new Error(
        `Failed to load private catalog: ${response.status} ${response.statusText}`
      );
    }

    const catalogData = await response.json();
    console.log("[UserInterface] Private catalog data:", catalogData);

    // Load the catalog into terria
    if (catalogData.catalog && Array.isArray(catalogData.catalog)) {
      console.log("[UserInterface] Checking for new catalog items...");

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
              `[UserInterface] Catalog item "${item.name}" already exists, skipping...`
            );
          }
          return !itemExists;
        });

        console.log(
          `[UserInterface] Found ${newItems.length} new items to add (${catalogData.catalog.length - newItems.length} already loaded)`
        );

        // Add only new items
        for (const item of newItems) {
          console.log("[UserInterface] Adding new catalog item:", item.name);

          // Use addMembersFromJson with the proper stratum
          const result = await terria.catalog.group.addMembersFromJson(
            "user", // Use user stratum for dynamically added items
            [item] // Pass as array
          );

          console.log("[UserInterface] Item added, result:", result);
        }

        console.log(
          "[UserInterface] Final catalog order:",
          terria.catalog.group.memberModels?.map((m) => m.name || m.uniqueId)
        );

        if (newItems.length > 0) {
          console.log(
            "[UserInterface] Private catalog updated with new items!"
          );
        } else {
          console.log("[UserInterface] Private catalog is up to date.");
        }
      } catch (error) {
        console.error("[UserInterface] Failed to load private catalog:", error);
        console.error("[UserInterface] Error stack:", error.stack);
      }
    } else {
      console.error(
        "[UserInterface] Invalid catalog data structure:",
        catalogData
      );
    }
  } catch (error) {
    console.error("[UserInterface] Failed to load private catalog:", error);
    throw error;
  }
};

export const TerriaUserInterfaceInner = ({
  terria,
  viewState,
  themeOverrides
}) => {
  const [showLogin, setShowLogin] = useState(false);
  const { isAuthenticated, user } = useAuth();

  // Debug: Log authentication state changes
  React.useEffect(() => {
    console.log("[UserInterface] Auth state changed:", {
      isAuthenticated,
      user,
      hasAccessToken: !!Cookies.get("access_token")
    });
  }, [isAuthenticated, user]);

  // Load private catalog when user becomes authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      console.log(
        "[UserInterface] User authenticated, checking for private catalog updates..."
      );

      loadPrivateCatalogWithAuth(terria).catch((error) => {
        console.error("[UserInterface] Failed to load private catalog:", error);
      });
    }
  }, [isAuthenticated, terria]);

  const navLinks = [
    { label: "Digital Twin", href: "/twin", active: true },
    { label: "Insights", href: "/insights" }
  ];

  // Only show Manager for authenticated users
  if (isAuthenticated) {
    navLinks.push({ label: "Manager", href: "/manager" });
  }

  const logo = <Logo />;

  const relatedMaps = viewState.terria.configParameters.relatedMaps;
  const aboutButtonHrefUrl =
    viewState.terria.configParameters.aboutButtonHrefUrl;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden"
      }}
    >
      <Navigation
        logo={logo}
        logoHref="/"
        links={navLinks}
        onLoginClick={() => setShowLogin(true)}
      />
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          position: "relative",
          display: "flex",
          flexDirection: "column"
        }}
      >
        <StandardUserInterface
          terria={terria}
          viewState={viewState}
          themeOverrides={themeOverrides}
          version={version}
        >
          <MenuLeft>
            {aboutButtonHrefUrl ? (
              <MenuItem
                caption="About"
                href={aboutButtonHrefUrl}
                key="about-link"
              />
            ) : null}
            {relatedMaps && relatedMaps.length > 0 ? (
              <RelatedMaps relatedMaps={relatedMaps} />
            ) : null}
          </MenuLeft>
        </StandardUserInterface>
      </div>
      <LoginModal
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        logo={logo}
        title="SMART METRO Codex"
        subtitle="Sign in to access all Codex applications"
        onLoginSuccess={() => {
          console.log("User logged in successfully!");
          setShowLogin(false);
        }}
      />
    </div>
  );
};

TerriaUserInterfaceInner.propTypes = {
  terria: PropTypes.object.isRequired,
  viewState: PropTypes.object.isRequired,
  themeOverrides: PropTypes.object
};

export const TerriaUserInterface = ({ terria, viewState, themeOverrides }) => {
  return (
    <AuthProvider apiBaseUrl="">
      <TerriaUserInterfaceInner
        terria={terria}
        viewState={viewState}
        themeOverrides={themeOverrides}
      />
    </AuthProvider>
  );
};
