import { useState } from "react";
import axios from "axios";

export default function EDA() {
  const [name, setName] = useState("");
  const [shapData, setShapData] = useState(null);
  const [loading, setLoading] = useState(false);

  const featureNameMap = {
    "num__Length of Stay": "Duration of Hospitalization",
    "num__Emergency Department Indicator": "Emergency Room Admission",
    "num__APR DRG Code": "Clinical Diagnosis Type (DRG)",
    "num__APR MDC Code": "Major Diagnostic Category",
    "num__APR Severity of Illness Code": "Illness Severity Level",
    "num__severity_x_mortality": "Severity & Mortality Risk Interaction",
    "num__drg_x_severity": "Diagnosis & Severity Interaction",
    "num__mdc_x_severity": "Category & Severity Interaction",
    "num__los_x_severity": "Stay Duration & Severity Interaction",
    "num__los_x_emergency": "Stay Duration & ER Interaction",
    "num__emergency_x_severity": "ER & Severity Interaction",
    "num__facility_code": "Hospital Facility Profile",
    "num__drg_frequency": "Case Volume for Diagnosis",
    "cat__Age Group": "Patient Age Category",
    "cat__Gender": "Biological Sex",
    "cat__Race": "Patient Race",
    "cat__Ethnicity": "Patient Ethnicity",
    "cat__Type of Admission": "Admission Priority",
    "cat__Patient Disposition": "Discharge Destination",
    "cat__APR Risk of Mortality": "Clinical Mortality Risk",
    "cat__APR Medical Surgical Description": "Procedure Type (Medical/Surgical)",
    "cat__Payment Typology 1": "Primary Insurance Provider",
  };

  const formatFeatureLabel = (rawLabel) => {
    if (!rawLabel) return "";

    if (featureNameMap[rawLabel]) return featureNameMap[rawLabel];

    let clean = rawLabel
      .replace(/^num__/, "")
      .replace(/^cat__/, "")
      .replace(/_/g, " ");

    // Handle One-hot encoded style: "Age Group_18 to 29"
    const splitIndex = clean.indexOf(" ");
    if (splitIndex !== -1) {
      const base = clean.substring(0, splitIndex);
      const value = clean.substring(splitIndex + 1);
      if (Object.values(featureNameMap).includes(base)) {
        return `${base}: ${value}`;
      }
    }

    return clean;
  };

  const fetchShap = async () => {
    if (!name.trim()) {
      alert("Please enter a patient name.");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get(
        `http://127.0.0.1:8000/shap/${encodeURIComponent(name.trim())}`
      );

      console.log("SHAP API RESPONSE:", res.data);

      //Normalize response safely
      const normalizedData = {
        name: res.data.name,
        predicted_cost: res.data.predicted_cost,
        shap_values: res.data.shap_values || res.data.shap || {}
      };
      setShapData(normalizedData);

    } catch (err) {
      alert("Patient not found or SHAP data missing.");
      setShapData(null);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const ShapBarChart = ({ shapValues }) => {
    if (!shapValues || typeof shapValues !== "object" || Object.keys(shapValues).length === 0) {
      return (
        <div className="card">
          <p style={{ padding: "20px" }}>No SHAP values available for this patient.</p>
        </div>
      );
    }

    let entries = [];

    // Handle both object and array formats
    if (Array.isArray(shapValues)) {
      entries = shapValues.map((v, i) => [`Feature ${i + 1}`, v]);
    } else if (typeof shapValues === "object") {
      entries = Object.entries(shapValues);
    }

    if (!entries.length) return null;

    const features = entries
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 15);

    const width = 740;
    const barHeight = 36;
    const height = features.length * barHeight + 100;
    const margin = { top: 40, left: 280, right: 80, bottom: 60 };

    const maxVal = Math.max(...features.map(([, v]) => Math.abs(v))) || 1;

    const scaleX = (v) =>
      margin.left +
      ((v + maxVal) / (2 * maxVal)) *
        (width - margin.left - margin.right);

    const zeroX = scaleX(0);

    return (
      <div className="card shap-chart-card">
        <div className="chart-header">
          <h3>🔍 SHAP Feature Impact</h3>
          <div className="chart-legend">
            <span className="legend-item">
              <span className="legend-dot increase" /> Increases cost
            </span>
            <span className="legend-item">
              <span className="legend-dot decrease" /> Decreases cost
            </span>
          </div>
        </div>

        <div className="chart-wrapper">
          <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
            <line
              x1={zeroX}
              y1={margin.top - 10}
              x2={zeroX}
              y2={height - margin.bottom}
              stroke="#888"
              strokeDasharray="4 4"
            />

            <text
              x={width / 2}
              y={height - 18}
              fill="#7a8398"
              fontSize="13"
              textAnchor="middle"
            >
              SHAP Value (₹ impact on prediction)
            </text>

            {features.map(([feature, value], idx) => {
              const y = margin.top + idx * barHeight;
              const barLength = Math.abs(scaleX(value) - zeroX);
              const isPositive = value > 0;

              return (
                <g key={feature}>
                  <text
                    x={margin.left - 16}
                    y={y + 22}
                    fill="#34495e"
                    fontSize="12"
                    textAnchor="end"
                    fontWeight="500"
                  >
                    {formatFeatureLabel(feature)}
                  </text>

                  <rect
                    className={isPositive ? "bar increase" : "bar decrease"}
                    x={isPositive ? zeroX : zeroX - barLength}
                    y={y + 10}
                    width={barLength}
                    height={18}
                    rx="8"
                  />

                  <text
                    x={
                      isPositive
                        ? zeroX + barLength + 12
                        : zeroX - barLength - 12
                    }
                    y={y + 22}
                    fill={value >= 0 ? "#e74c3c" : "#27ae60"}
                    fontSize="12"
                    fontWeight="bold"
                    textAnchor={isPositive ? "start" : "end"}
                  >
                    {value > 0 ? "+" : ""}
                    ₹
                    {Math.abs(value) < 1 && Math.abs(value) > 0
                      ? value.toFixed(2)
                      : Math.round(value).toLocaleString()}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    );
  };

  return (
    <>
      <h1>📊 Explainable AI (EDA & SHAP)</h1>

      <div className="info-box eda-intro">
        <h3>🧠 Understand how the model makes decisions</h3>
        <p>
          SHAP explains the impact of each feature on the predicted
          cost. Features shown in{" "}
          <span className="color-increase">red</span> increase the prediction,
          while those in{" "}
          <span className="color-decrease">green</span> decrease it.
        </p>
      </div>

      <div className="form-card shap-search">
        <h3>🔍 Analyze a patient prediction</h3>
        <div className="search-input-group">
          <input
            placeholder="Enter patient name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="shap-input"
            onKeyDown={(e) => e.key === "Enter" && fetchShap()}
          />
          <button
            className={`primary-btn analyze-btn ${loading ? "loading" : ""}`}
            onClick={fetchShap}
            disabled={loading}
          >
            {loading ? "⏳ Analyzing..." : "🔮 Analyze"}
          </button>
        </div>
      </div>

      {shapData && shapData.shap_values && (
        <>
          <div className="card prediction-summary">
            <div className="prediction-summary-header">
              <div>
                <h2>💰 Prediction Summary</h2>
                <p>
                  Patient <b>{shapData.name}</b> has a predicted cost of:
                </p>
              </div>
              <div className="prediction-cost">
                <span className="cost-amount">
                  ₹{Math.round(shapData.predicted_cost)}
                </span>
                <span className="cost-label">Annual Premium</span>
              </div>
            </div>

            <div className="prediction-notes">
              <p>
                Below is the SHAP breakdown for this prediction. The bars
                represent how much each feature pushed the prediction up or
                down compared to the model's baseline.
              </p>
            </div>
          </div>

          <ShapBarChart shapValues={shapData.shap_values} />

          <div className="info-box shap-explanation">
            <h3>🧠 What this means</h3>
            <ul>
              <li>
                Large positive SHAP (red) → strong driver increasing cost.
              </li>
              <li>
                Negative SHAP (green) → reduces predicted cost.
              </li>
              <li>
                Helps understand personalized insurance pricing decisions.
              </li>
            </ul>
          </div>
        </>
      )}
    </>
  );
}