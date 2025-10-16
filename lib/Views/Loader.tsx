import loadingGif from "../Styles/loading.gif";
import Styles from "./loader.scss";

export const Loader = () => {
  return (
    <div className={Styles.loaderUi}>
      <img src={loadingGif} />
    </div>
  );
};
