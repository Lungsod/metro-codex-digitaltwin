import PropTypes from "prop-types";

export default function LineMeasureModal({ distance, units, onDone, onPrint }) {
  return (
    <div className="codex-dt-measure-overlay">
      <div className="codex-dt-measure-modal codex-dt-measure-compact">
        <h2 className="codex-dt-measure-title">Line Measure Tool</h2>

        <p className="codex-dt-measure-hint">Click on map to add a point</p>

        <div className="codex-dt-measure-distance">
          <span className="label">Distance</span>
          <span className="value">
            {Math.round(distance)} {units}
          </span>
        </div>

        <div className="codex-dt-measure-actions">
          <button
            className="codex-dt-btn codex-dt-btn-secondary"
            onClick={onPrint}
          >
            Print
          </button>

          <button
            className="codex-dt-btn codex-dt-btn-primary"
            onClick={onDone}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

LineMeasureModal.propTypes = {
  distance: PropTypes.number.isRequired,
  units: PropTypes.string.isRequired,
  onDone: PropTypes.func.isRequired,
  onPrint: PropTypes.func.isRequired
};
