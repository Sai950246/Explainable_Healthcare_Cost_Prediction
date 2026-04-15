import { useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";

export default function NewPatient() {
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState({
    // Core Clinical Fields (used by model)
    name: "",
    length_of_stay: "",
    emergency_department_indicator: "N",
    age_group: "30 to 49",
    gender: "M",
    race: "White",
    ethnicity: "Not Span/Hispanic",
    type_of_admission: "Emergency",
    patient_disposition: "Home",
    apr_risk_of_mortality: "Minor",
    apr_severity_of_illness_description: "Minor",
    apr_medical_surgical_description: "Medical",
    payment_typology_1: "Medicare",
    facility_name: "Unknown",
    discharge_year: 2024,
    apr_drg_code: 0,
    apr_mdc_code: 0,
    apr_severity_code: 2,
    ccs_diagnosis_code: 0,
    ccs_procedure_code: 0,

    // UI-only Fields for UX Redesign
    email: "",
    phone: "",
    address: "",
    medical_history: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
  });
  const [cost, setCost] = useState(null);
  const [shapValues, setShapValues] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const steps = [
    { id: 1, title: "Demographics", icon: "👤" },
    { id: 2, title: "Contact Info", icon: "📞" },
    { id: 3, title: "Clinical Details", icon: "🏥" },
    { id: 4, title: "Medical History", icon: "📋" },
    { id: 5, title: "Emergency Contacts", icon: "🚨" },
    { id: 6, title: "Review & Predict", icon: "🧠" }
  ];

  // Enhanced feature name mapping for better human readability
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

  // Helper function to clean and format feature labels for humans
  const formatFeatureLabel = (rawLabel) => {
    // Check direct map first
    if (featureNameMap[rawLabel]) return featureNameMap[rawLabel];

    let clean = rawLabel
      .replace(/^num__/, "")
      .replace(/^cat__/, "")
      .replace(/_/g, " ");

    // Handle One-Hot Encoded category values (e.g., "Age Group_18 to 29")
    const parts = clean.split(/ (.+)/);
    if (parts.length > 1 && parts[0] in Object.values(featureNameMap)) {
      return `${parts[0]}: ${parts[1]}`;
    }

    return clean;
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError(null);
    setSuccess(false);
  };

  const nextStep = () => {
    if (currentStep === 1 && !form.name) {
      setError("Please enter the patient's full name.");
      return;
    }
    if (currentStep < steps.length) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handlePredict = async (retryCount = 0) => {
    if (!form.name || !form.length_of_stay) {
      setError("Please fill in all required fields (Name and Length of Stay).");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      console.log(`Sending prediction request (Attempt ${retryCount + 1}) with data:`, form);
      // Filter only core fields for prediction
      const predictionData = {
        name: form.name,
        length_of_stay: Number(form.length_of_stay),
        emergency_department_indicator: form.emergency_department_indicator,
        apr_drg_code: Number(form.apr_drg_code || 0),
        apr_mdc_code: Number(form.apr_mdc_code || 0),
        apr_severity_code: Number(form.apr_severity_code || 1),
        ccs_diagnosis_code: Number(form.ccs_diagnosis_code || 0),
        ccs_procedure_code: Number(form.ccs_procedure_code || 0),
        age_group: form.age_group,
        gender: form.gender,
        race: form.race || "White",
        ethnicity: form.ethnicity || "Not Span/Hispanic",
        type_of_admission: form.type_of_admission || "Emergency",
        patient_disposition: form.patient_disposition || "Home",
        apr_risk_of_mortality: form.apr_risk_of_mortality || "Minor",
        apr_medical_surgical_description: form.apr_medical_surgical_description || "Medical",
        payment_typology_1: form.payment_typology_1 || "Medicare",
        facility_name: form.facility_name || "Unknown",
        discharge_year: Number(form.discharge_year || 2024),
        // New UI-only fields for persistence
        email: form.email || "",
        phone: form.phone || "",
        address: form.address || "",
        medical_history: form.medical_history || "",
        emergency_contact_name: form.emergency_contact_name || "",
        emergency_contact_phone: form.emergency_contact_phone || "",
      };

      const res = await axios.post("http://127.0.0.1:8000/predict", predictionData);
      
      console.log("Prediction response:", res.data);
      setCost(res.data.predicted_cost);
      setShapValues(res.data.shap_values);
      setSuccess(true);
    } catch (err) {
      console.error("Prediction error details:", err);
      
      // Implement retry mechanism for 503 errors (model training)
      if (err.response?.status === 503 && retryCount < 3) {
        setError(`Model is initializing. Retrying in 5 seconds... (Attempt ${retryCount + 1}/3)`);
        setTimeout(() => handlePredict(retryCount + 1), 5000);
        return;
      }

      const errorMessage = err.response?.data?.detail || "Prediction failed. The model might still be training or there's a data formatting issue.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadReceipt = () => {
    if (!cost) return alert("Please predict cost first!");

    try {
      const doc = new jsPDF();
      const timestamp = new Date().toLocaleString();
      const reportID = `HOSP-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // --- 1. Audit Trail & Metadata ---
      console.log(`[Audit Trail] Generating PDF Report ${reportID} for ${form.name} at ${timestamp}`);
      doc.setProperties({
        title: `Hospital Cost Receipt - ${form.name}`,
        subject: 'Clinical Cost Prediction Report',
        author: 'Medical Cost AI System',
        keywords: 'healthcare, billing, shap, prediction',
        creator: 'jsPDF Medical Billing Module'
      });

      // --- 2. Header & Branding ---
      doc.setFillColor(41, 128, 185); // Header Color
      doc.rect(0, 0, 210, 35, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.text("MEDICAL COST PREDICTION RECEIPT", 20, 23);
      doc.setFontSize(10);
      doc.text(`Report ID: ${reportID}`, 150, 23);

      // --- 3. Patient Identification ---
      doc.setTextColor(44, 62, 80);
      doc.setFontSize(14);
      doc.text("I. PATIENT IDENTIFICATION", 20, 45);
      doc.setDrawColor(44, 62, 80);
      doc.line(20, 47, 190, 47);

      doc.setFontSize(11);
      doc.text(`Name: ${form.name || 'N/A'}`, 25, 55);
      doc.text(`Age Group: ${form.age_group || 'N/A'}`, 25, 63);
      const genderlabel = 
        form.gender === 'M' ? "Male" :
        form.gender === 'F' ? "Female" : "Other";
      doc.text(`Gender: ${genderlabel}`, 25, 71);

      // --- 4. Clinical Metrics ---
      doc.setFontSize(14);
      doc.text("II. CLINICAL METRICS", 20, 85);
      doc.line(20, 87, 190, 87);

      doc.setFontSize(11);
      const metrics = [
        ["Length of Stay:", `${form.length_of_stay || 0} days`],
        ["Emergency Department Visit:", form.emergency_department_indicator === 'Y' ? 'Yes' : 'No'],
        ["Risk of Mortality:", form.apr_risk_of_mortality || 'Minor'],
        ["Severity of Illness:", form.apr_severity_of_illness_description || 'Minor'],
        ["Type of Admission:", form.type_of_admission || 'Elective'],
        ["Payment Type:", form.payment_typology_1 || 'Medicare']
      ];

      let metricsY = 95;
      metrics.forEach(([label, value]) => {
        doc.text(label, 25, metricsY);
        doc.text(value, 80, metricsY);
        metricsY += 8;
      });

      // --- 5. Financial Information ---
      doc.setFontSize(14);
      doc.text("III. FINANCIAL INFORMATION", 20, 150);
      doc.line(20, 152, 190, 152);

      doc.setFillColor(236, 240, 241);
      doc.rect(20, 157, 170, 20, 'F');
      doc.setFontSize(16);
      doc.setTextColor(41, 128, 185);
      doc.text(`Predicted Total Cost: Rs. ${Math.round(cost).toLocaleString()}`, 30, 171);

      // --- 6. Data Visualization (SHAP Analysis) ---
      if (shapValues && Object.keys(shapValues).length > 0) {
        doc.setTextColor(44, 62, 80);
        doc.setFontSize(14);
        doc.text("IV. TOP FEATURE CONTRIBUTIONS (SHAP Analysis)", 20, 190);
        doc.line(20, 192, 190, 192);

        doc.setFontSize(10);
        let yPos = 200;

        const sortedShap = Object.entries(shapValues)
          .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
          .slice(0, 6);

        sortedShap.forEach(([feature, value]) => {
          const friendlyName = formatFeatureLabel(feature);
          const effect = value > 0 ? "Increases" : "Decreases";

          const amount =
            Math.abs(value) < 1 && Math.abs(value) > 0
              ? value.toFixed(2)
              : Math.round(Math.abs(value)).toLocaleString();

          doc.text(`• ${friendlyName}:`, 25, yPos);

          doc.setTextColor(
            value > 0 ? 192 : 39,
            value > 0 ? 57 : 174,
            value > 0 ? 43 : 96
          );

          doc.text(`${effect} cost by Rs. ${amount}`, 85, yPos);

          doc.setTextColor(44, 62, 80);
          yPos += 8;
        });
      }

      // --- 7. Compliance & HIPAA Footer ---
      doc.setFontSize(8);
      doc.setTextColor(127, 140, 141);
      const footerText = "CONFIDENTIAL: This document contains Protected Health Information (PHI) and is HIPAA compliant. For medical billing purposes only.";
      doc.text(footerText, 20, 275);
      doc.text(`Generated on: ${timestamp} | Audit ID: ${reportID}`, 20, 282);

      doc.save(`${form.name.replace(/\s+/g, '_')}_Receipt_${reportID.slice(-4)}.pdf`);
    } catch (err) {
      console.error("PDF Generation failed:", err);
      alert("Error generating the PDF report. Please check the console for details.");
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="form-section demographics-section" role="tabpanel" aria-labelledby="step-1">
            <div className="section-header">
              <div className="section-icon">👤</div>
              <h3>Patient Demographics</h3>
            </div>
            <div className="form-grid">
              <div className="input-group">
                <label htmlFor="name">Full Name <span className="required" aria-hidden="true">*</span></label>
                <div className="input-wrapper">
                  <input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="e.g. John Doe"
                    value={form.name}
                    onChange={handleChange}
                    aria-required="true"
                    required
                  />
                  <span className="input-icon" aria-hidden="true">📝</span>
                </div>
                <small className="helper-text">Enter the full legal name of the patient.</small>
              </div>
              <div className="input-group">
                <label htmlFor="age_group">Age Group</label>
                <div className="input-wrapper">
                  <select id="age_group" name="age_group" value={form.age_group} onChange={handleChange}>
                    <option value="0 to 17">0 to 17</option>
                    <option value="18 to 29">18 to 29</option>
                    <option value="30 to 49">30 to 49</option>
                    <option value="50 to 69">50 to 69</option>
                    <option value="70 or Older">70 or Older</option>
                  </select>
                  <span className="input-icon" aria-hidden="true">📅</span>
                </div>
              </div>
              <div className="input-group">
                <label htmlFor="gender">Gender</label>
                <div className="input-wrapper">
                  <select id="gender" name="gender" value={form.gender} onChange={handleChange}>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="O">Other</option>
                  </select>
                  <span className="input-icon" aria-hidden="true">⚧</span>
                </div>
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="form-section contact-section" role="tabpanel" aria-labelledby="step-2">
            <div className="section-header">
              <div className="section-icon">📞</div>
              <h3>Contact Information</h3>
            </div>
            <div className="form-grid">
              <div className="input-group">
                <label htmlFor="email">Email Address</label>
                <div className="input-wrapper">
                  <input id="email" name="email" type="email" placeholder="email@example.com" value={form.email} onChange={handleChange} />
                  <span className="input-icon" aria-hidden="true">📧</span>
                </div>
              </div>
              <div className="input-group">
                <label htmlFor="phone">Phone Number</label>
                <div className="input-wrapper">
                  <input id="phone" name="phone" type="tel" placeholder="+1 (555) 000-0000" value={form.phone} onChange={handleChange} />
                  <span className="input-icon" aria-hidden="true">📱</span>
                </div>
              </div>
              <div className="input-group full-width">
                <label htmlFor="address">Residential Address</label>
                <div className="input-wrapper">
                  <input id="address" name="address" type="text" placeholder="Street, City, State, ZIP" value={form.address} onChange={handleChange} />
                  <span className="input-icon" aria-hidden="true">🏠</span>
                </div>
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="form-section clinical-section" role="tabpanel" aria-labelledby="step-3">
            <div className="section-header">
              <div className="section-icon">🏥</div>
              <h3>Clinical Details</h3>
            </div>
            <div className="form-grid">
              <div className="input-group">
                <label htmlFor="length_of_stay">Length of Stay (days)</label>
                <div className="input-wrapper">
                  <input
                    id="length_of_stay"
                    name="length_of_stay"
                    type="number"
                    value={form.length_of_stay}
                    onChange={handleChange}
                    min="1"
                    required
                  />
                  <span className="input-icon" aria-hidden="true">⏳</span>
                </div>
              </div>
              <div className="input-group">
                <label htmlFor="type_of_admission">Admission Type</label>
                <div className="input-wrapper">
                  <select id="type_of_admission" name="type_of_admission" value={form.type_of_admission} onChange={handleChange}>
                    <option value="Emergency">Emergency</option>
                    <option value="Urgent">Urgent</option>
                    <option value="Elective">Elective</option>
                    <option value="Newborn">Newborn</option>
                    <option value="Trauma">Trauma Center</option>
                  </select>
                  <span className="input-icon" aria-hidden="true">📥</span>
                </div>
              </div>
              <div className="input-group">
                <label htmlFor="emergency_department_indicator">ER Visit?</label>
                <div className="input-wrapper">
                  <select id="emergency_department_indicator" name="emergency_department_indicator" value={form.emergency_department_indicator} onChange={handleChange}>
                    <option value="Y">Yes</option>
                    <option value="N">No</option>
                  </select>
                  <span className="input-icon" aria-hidden="true">🚨</span>
                </div>
              </div>
              <div className="input-group">
                <label htmlFor="apr_risk_of_mortality">Risk of Mortality</label>
                <div className="input-wrapper">
                  <select id="apr_risk_of_mortality" name="apr_risk_of_mortality" value={form.apr_risk_of_mortality} onChange={handleChange}>
                    <option value="Minor">Minor</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Major">Major</option>
                    <option value="Extreme">Extreme</option>
                  </select>
                  <span className="input-icon" aria-hidden="true">⚠️</span>
                </div>
              </div>
              <div className="input-group">
                <label htmlFor="apr_severity_of_illness_description">Severity of Illness</label>
                <div className="input-wrapper">
                  <select id="apr_severity_of_illness_description" name="apr_severity_of_illness_description" value={form.apr_severity_of_illness_description} onChange={handleChange}>
                    <option value="Minor">Minor</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Major">Major</option>
                    <option value="Extreme">Extreme</option>
                  </select>
                  <span className="input-icon" aria-hidden="true">📊</span>
                </div>
              </div>
              <div className="input-group">
                <label htmlFor="payment_typology_1">Primary Payer</label>
                <div className="input-wrapper">
                  <select id="payment_typology_1" name="payment_typology_1" value={form.payment_typology_1} onChange={handleChange}>
                    <option value="Medicare">Medicare</option>
                    <option value="Medicaid">Medicaid</option>
                    <option value="Private Health Insurance">Private Insurance</option>
                    <option value="Self-Pay">Self-Pay</option>
                    <option value="Blue Cross/Blue Shield">Blue Cross/Blue Shield</option>
                  </select>
                  <span className="input-icon" aria-hidden="true">💳</span>
                </div>
              </div>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="form-section history-section" role="tabpanel" aria-labelledby="step-4">
            <div className="section-header">
              <div className="section-icon">📋</div>
              <h3>Medical History</h3>
            </div>
            <div className="input-group full-width">
              <label htmlFor="medical_history">Clinical History & Pre-existing Conditions</label>
              <textarea
                id="medical_history"
                name="medical_history"
                rows="6"
                placeholder="List any chronic illnesses, allergies, or past surgeries..."
                value={form.medical_history}
                onChange={handleChange}
                className="custom-textarea"
                style={{
                  width: '100%',
                  padding: '15px',
                  borderRadius: '12px',
                  border: '2px solid #e1e8ed',
                  fontFamily: 'inherit',
                  fontSize: '1rem',
                  resize: 'vertical'
                }}
              />
            </div>
          </div>
        );
      case 5:
        return (
          <div className="form-section emergency-section" role="tabpanel" aria-labelledby="step-5">
            <div className="section-header">
              <div className="section-icon">🚨</div>
              <h3>Emergency Contact</h3>
            </div>
            <div className="form-grid">
              <div className="input-group">
                <label htmlFor="emergency_contact_name">Contact Name</label>
                <div className="input-wrapper">
                  <input id="emergency_contact_name" name="emergency_contact_name" type="text" placeholder="Full name" value={form.emergency_contact_name} onChange={handleChange} />
                  <span className="input-icon" aria-hidden="true">👤</span>
                </div>
              </div>
              <div className="input-group">
                <label htmlFor="emergency_contact_phone">Contact Phone</label>
                <div className="input-wrapper">
                  <input id="emergency_contact_phone" name="emergency_contact_phone" type="tel" placeholder="Phone number" value={form.emergency_contact_phone} onChange={handleChange} />
                  <span className="input-icon" aria-hidden="true">📞</span>
                </div>
              </div>
            </div>
          </div>
        );
      case 6:
        return (
          <div className="form-section review-section" role="tabpanel" aria-labelledby="step-6">
            <div className="section-header">
              <div className="section-icon">🧠</div>
              <h3>Review & Prediction</h3>
            </div>
            <div className="review-card" style={{ background: '#f8f9fa', padding: '20px', borderRadius: '15px', border: '1px dashed #667eea' }}>
              <p><strong>Patient Name:</strong> {form.name}</p>
              <p><strong>Age/Gender:</strong> {form.age_group} | {form.gender === 'M' ? 'Male' : form.gender === 'F' ? 'Female' : 'other'}</p>
              <p><strong>Length of Stay:</strong> {form.length_of_stay} days</p>
              <p><strong>Primary Payer:</strong> {form.payment_typology_1}</p>
              <p className="small-text">Click "Predict Cost" to generate AI analysis based on the above clinical data.</p>
            </div>
            <div className="form-actions" style={{ padding: '20px 0' }}>
              <button
                className={`primary-btn predict-btn ${isLoading ? 'loading' : ''}`}
                onClick={handlePredict}
                disabled={isLoading}
              >
                {isLoading ? (
                  <><div className="spinner"></div> Analyzing data..</>
                ) : (
                  <>🧠 Predict Hospital Cost</>
                )}
              </button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="new-patient-container">
      <div className="page-header">
        <div className="header-icon" aria-hidden="true">👨‍⚕️</div>
        <div className="header-content">
          <h1>New Patient Registration</h1>
          <p>AI-Powered Clinical Admission & Cost Analysis System</p>
        </div>
      </div>

      <div className="form-card patient-form">
        <div className="form-header">
          <h2 id="form-title">📋 Admission Form</h2>
          <div className="form-progress" role="tablist" aria-label="Registration Progress">
            {steps.map((step) => (
              <div key={step.id} className="progress-container">
                <div
                  className={`progress-step ${currentStep >= step.id ? 'active' : ''}`}
                  title={step.title}
                  role="tab"
                  aria-selected={currentStep === step.id}
                  aria-controls={`step-${step.id}`}
                >
                  {currentStep > step.id ? '✓' : step.id}
                </div>
                {step.id < steps.length && <div className={`progress-line ${currentStep > step.id ? 'active' : ''}`}></div>}
              </div>
            ))}
          </div>
          <div className="step-label" style={{ marginTop: '10px', fontWeight: '500', fontSize: '0.9rem' }}>
            Step {currentStep}: {steps[currentStep - 1].title}
          </div>
        </div>

        {error && <div className="error-message" style={{ background: '#fdecea', color: '#e74c3c', padding: '15px', textAlign: 'center', fontWeight: '600' }} role="alert">⚠️ {error}</div>}
        {success && <div className="success-message" style={{ background: '#e8f5e9', color: '#27ae60', padding: '15px', textAlign: 'center', fontWeight: '600' }} role="alert">✅ Prediction successful!</div>}

        <div className="form-body">
          {renderStep()}
        </div>

        <div className="form-navigation" style={{ display: 'flex', justifyContent: 'space-between', padding: '0 40px 40px 40px' }}>
          <button
            className="secondary-btn"
            onClick={prevStep}
            disabled={currentStep === 1 || isLoading}
            style={{ visibility: currentStep === 1 ? 'hidden' : 'visible' }}
          >
            ← Previous
          </button>
          {currentStep < steps.length && (
            <button className="primary-btn" onClick={nextStep} disabled={isLoading}>
              Next Step →
            </button>
          )}
        </div>

        {cost && (
          <div className="results-section">
            <div className="cost-result-card success-animation">
              <div className="result-header">
                <div className="result-icon">💰</div>
                <h3>Clinical Prediction Outcome</h3>
              </div>

              <div className="cost-display">
                <div className="cost-amount">₹{Math.round(cost).toLocaleString()}</div>
                <div className="cost-subtitle">Estimated Total Hospitalization Cost</div>
              </div>

              <div className="insights-section">
                <h4>🔍 Intelligent Cost Drivers</h4>
                <div className="shap-analysis">
                  {shapValues &&
                    Object.entries(shapValues)
                      .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
                      .slice(0, 5)
                      .map(([feature, value]) => (
                        <div key={feature} className={`shap-item ${value > 0 ? 'increase' : 'decrease'}`}>
                          <div className="shap-label">
                            {formatFeatureLabel(feature)}
                          </div>
                          <div className="shap-value">
                            {value > 0 ? '+' : ''}₹{Math.abs(value) < 1 && Math.abs(value) > 0 ? value.toFixed(2) : Math.round(Math.abs(value)).toLocaleString()}
                          </div>
                          <div className="shap-bar">
                            <div
                              className="shap-bar-fill"
                              style={{
                                width: `${Math.min(Math.abs(value) / 1000 * 100, 100)}%`,
                                backgroundColor: value > 0 ? '#e74c3c' : '#27ae60'
                              }}
                            ></div>
                          </div>
                        </div>
                      ))}
                </div>
              </div>

              <div className="action-buttons">
                <button className="secondary-btn" onClick={() => { setCost(null); setShapValues(null); setCurrentStep(1); }}>
                  🔄 New Admission
                </button>
                <button className="primary-btn download-btn" onClick={downloadReceipt}>
                  📄 Generate Clinical Receipt
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
