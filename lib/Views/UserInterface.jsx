import PropTypes from "prop-types";
import RelatedMaps from "terriajs/lib/ReactViews/RelatedMaps/RelatedMaps";
import { MenuLeft } from "terriajs/lib/ReactViews/StandardUserInterface/customizable/Groups";
import MenuItem from "terriajs/lib/ReactViews/StandardUserInterface/customizable/MenuItem";
import StandardUserInterface from "terriajs/lib/ReactViews/StandardUserInterface/StandardUserInterface";
import version from "../../version";
import { useEffect, useRef, useState } from "react";
import {
  AuthProvider,
  Navigation,
  LoginModal,
  useAuth,
  Logo
} from "@smartmetro/codex-auth";
import Cookies from "js-cookie";

export const TerriaUserInterfaceInner = ({
  terria,
  viewState,
  themeOverrides
}) => {
  const [showLogin, setShowLogin] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const prevAuthRef = useRef(isAuthenticated);

  // Debug: Log authentication state changes
  // useEffect(() => {
  //  console.log("[UserInterface] Auth state changed:", {
  //    isAuthenticated,
  //    user,
  //    hasAccessToken: !!Cookies.get("access_token")
  //  });
  // }, [isAuthenticated, user]);

  // Force refresh when user logs out (isAuthenticated becomes false)
  useEffect(() => {
    if (prevAuthRef.current === true && isAuthenticated === false) {
      console.log("[UserInterface] User logged out, refreshing page...");
      window.location.reload();
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated]);

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
    <AuthProvider>
      <TerriaUserInterfaceInner
        terria={terria}
        viewState={viewState}
        themeOverrides={themeOverrides}
      />
    </AuthProvider>
  );
};
