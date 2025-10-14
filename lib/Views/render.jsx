import { observer } from "mobx-react";
import PropTypes from "prop-types";
import React, { Suspense } from "react";
import { createRoot } from "react-dom/client";
import Variables from "../Styles/variables.scss";
import "./global.scss";
import { Loader } from "./Loader";
import { terriaStore } from "./terriaStore";

// Lazy load the entire TerriaUserInterface component
const LazyTerriaUserInterface = React.lazy(() =>
  import("./UserInterface").then((module) => ({
    default: module.TerriaUserInterface
  }))
);

const Root = observer(({ themeOverrides }) => {
  const { terria, viewState, status } = terriaStore;

  if (status === "loading") {
    return <Loader />;
  }

  return (
    <Suspense fallback={<Loader />}>
      <LazyTerriaUserInterface
        terria={terria}
        viewState={viewState}
        themeOverrides={themeOverrides}
      />
    </Suspense>
  );
});

Root.propTypes = {
  themeOverrides: PropTypes.object
};

export const renderUi = (root) => {
  if (!root) {
    console.error("Root is not provided.");
    return;
  }

  root.render(<Root themeOverrides={Variables} />);
};
