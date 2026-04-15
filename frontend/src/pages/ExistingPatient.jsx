import { useEffect, useState } from "react";
import axios from "axios";

export default function ExistingPatient() {
  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [stats, setStats] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);

  useEffect(() => {
    fetchAllPatients();
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await axios.get("http://127.0.0.1:8000/stats");
      setStats(res.data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const searchPatient = async () => {
    if (!search.trim()) {
      await fetchAllPatients();
      return;
    }
    setSearching(true);
    setLoading(true);
    try {
      const res = await axios.get(`http://127.0.0.1:8000/patients/${encodeURIComponent(search)}`);
      setPatients([res.data]);
      setLoading(false);
    } catch {
      alert("Patient not found");
      setPatients([]);
      setLoading(false);
    }
    setSearching(false);
  };

  const fetchAllPatients = async () => {
    setLoading(true);
    try {
      const res = await axios.get("http://127.0.0.1:8000/patients");
      setPatients(res.data);
      setLoading(false);
    } catch {
      setPatients([]);
      setLoading(false);
    }
  };

  const deletePatient = async (patientName) => {
    console.log('Starting delete process for:', patientName);

    if (!window.confirm(`Are you sure you want to delete ${patientName}'s record? This action cannot be undone.`)) {
      console.log('Delete cancelled by user');
      return;
    }

    try {
      // Show loading state
      const deleteBtn = document.querySelector(`button[title*="Delete ${patientName}"]`);
      if (deleteBtn) {
        deleteBtn.disabled = true;
        deleteBtn.textContent = '🗑️ Deleting...';
      }

      console.log('Making DELETE request to:', `http://127.0.0.1:8000/patients/${encodeURIComponent(patientName)}`);

      const response = await axios.delete(`http://127.0.0.1:8000/patients/${encodeURIComponent(patientName)}`);

      console.log('Delete response:', response);

      if (response.status === 200) {
        // Remove from local state - more robust filtering with safety checks
        setPatients((prev) => {
          const filtered = prev.filter((p) => {
            if (!p || !p.name) return false;
            return p.name.trim().toLowerCase() !== (patientName || "").trim().toLowerCase();
          });
          console.log('Filtered patients from', prev.length, 'to', filtered.length);
          return filtered;
        });

        // Force refresh the patient list from server to ensure consistency
        await fetchAllPatients();

        // Refresh stats after deletion
        await fetchStats();

        // Show success message
        alert(`${patientName}'s record has been deleted successfully.`);
      }
    } catch (err) {
      console.error('Delete error details:', err);
      console.error('Response data:', err.response?.data);
      console.error('Response status:', err.response?.status);

      let errorMessage = "Failed to delete patient";
      if (err.response?.data?.detail) {
        errorMessage += `: ${err.response.data.detail}`;
      } else if (err.message) {
        errorMessage += `: ${err.message}`;
      }

      alert(errorMessage);
    } finally {
      // Reset button state
      const deleteBtn = document.querySelector(`button[title*="Delete ${patientName}"]`);
      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = '🗑️ Delete';
      }
    }
  };

  return (
    <div className="existing-patients-container">
      <div className="page-header">
        <h1>🧑‍⚕️ Patient Records Management</h1>
        <p className="page-subtitle">View, search, and manage all patient records</p>
      </div>

      {/* Statistics Overview */}
      {stats && (
        <div className="stats-overview">
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-value">{stats.total_patients}</div>
            <div className="stat-label">Total Records</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-value">₹{stats.average_predicted_cost?.toLocaleString()}</div>
            <div className="stat-label">Avg. Cost</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⏳</div>
            <div className="stat-value">{stats.average_length_of_stay?.toFixed(1)}</div>
            <div className="stat-label">Avg. Stay (Days)</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🚨</div>
            <div className="stat-value">{stats.er_visit_percentage?.toFixed(1)}%</div>
            <div className="stat-label">ER Visit Rate</div>
          </div>
        </div>
      )}

      {/* Search and Controls */}
      <div className="form-card search-card">
        <div className="search-section">
          <h3>🔍 Search & Filter Patients</h3>
          <div className="search-controls">
            <div className="search-input-group">
              <input
                placeholder="Enter patient name to search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchPatient()}
                className="search-input"
              />
              <button
                className={`primary-bttn search-btn ${searching ? 'loading' : ''}`}
                onClick={searchPatient}
                disabled={searching}
              >
                {searching ? '🔍 Searching...' : '🔍 Search'}
              </button>
            </div>
            <button className="refresh-bttn" onClick={fetchAllPatients}>
              🔄 Refresh All Records
            </button>
          </div>
        </div>
      </div>

      {/* Records Table */}
      <div className="table-container">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading patient records...</p>
          </div>
        ) : (
          <>
            <div className="table-header">
              <h3>📋 Patient Records ({patients.length})</h3>
            </div>

            <table>
              <thead>
                <tr>
                  <th>👤 Patient Name</th>
                  <th>📅 Age Group</th>
                  <th>⚧️ Gender</th>
                  <th>⏳ Stay</th>
                  <th>🚨 ER</th>
                  <th>⚠️ Risk</th>
                  <th>📥 Admission</th>
                  <th>💰 Predicted Cost</th>
                  <th>⚙️ Actions</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p, i) => (
                  <tr key={i} className="patient-row">
                    <td className="patient-name">
                      <div className="name-cell">
                        <span className="name-text">{p.name}</span>
                        <span className="name-badge">Active</span>
                      </div>
                    </td>
                    <td>
                      <span className="age-display">{p.age_group || 'N/A'}</span>
                    </td>
                    <td>
                      <span className={`gender-badge ${p.gender === 'M' ? 'male' : 'female'}`}>
                        {p.gender === 'M' ? '👨 Male' : '👩 Female'}
                      </span>
                    </td>
                    <td>
                      <span className="stay-display">{p.length_of_stay} days</span>
                    </td>
                    <td>
                      <span className={`er-badge ${p.emergency_department_indicator}`}>
                        {p.emergency_department_indicator === 'Y' ? '🚨 Yes' : '🏥 No'}
                      </span>
                    </td>
                    <td>
                      <span className={`risk-badge ${p.apr_risk_of_mortality?.toLowerCase()}`}>
                        {p.apr_risk_of_mortality || 'Minor'}
                      </span>
                    </td>
                    <td>
                      <span className="admission-badge">{p.type_of_admission || 'Elective'}</span>
                    </td>
                    <td className="cost-cell">
                      <div className="cost-display">
                        <span className="cost-amount">₹{p.predicted_cost?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        <span className="cost-label">Estimated</span>
                      </div>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="view-btn"
                          onClick={() => setSelectedPatient(p)}
                          title="View Full Patient Details"
                        >
                          👁️ View
                        </button>
                        <button
                          className="delete-btn"
                          onClick={() => {
                            console.log('Delete button clicked for:', p.name);
                            deletePatient(p.name);
                          }}
                          title={`Delete ${p.name}'s record`}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {patients.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>No Patient Records Found</h3>
                <p>Try searching for a specific patient or refresh to load all records.</p>
                <button className="primary-btn" onClick={fetchAllPatients}>
                  🔄 Load All Records
                </button>
              </div>
            )}
          </>
        )}

        {/* Patient Details Modal */}
        {selectedPatient && (
          <div className="modal-overlay" onClick={() => setSelectedPatient(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>📋 Full Patient Profile</h3>
                <button className="close-btn" onClick={() => setSelectedPatient(null)}>×</button>
              </div>
              <div className="modal-body">
                <div className="detail-section">
                  <h4>👤 Demographics</h4>
                  <div className="detail-grid">
                    <p><strong>Name:</strong> {selectedPatient.name}</p>
                    <p><strong>Age Group:</strong> {selectedPatient.age_group}</p>
                    <p><strong>Gender:</strong> {selectedPatient.gender === 'M' ? 'Male' : 'Female'}</p>
                    <p><strong>Race:</strong> {selectedPatient.race}</p>
                    <p><strong>Ethnicity:</strong> {selectedPatient.ethnicity}</p>
                  </div>
                </div>

                <div className="detail-section">
                  <h4>📞 Contact Information</h4>
                  <div className="detail-grid">
                    <p><strong>Email:</strong> {selectedPatient.email || 'N/A'}</p>
                    <p><strong>Phone:</strong> {selectedPatient.phone || 'N/A'}</p>
                    <p><strong>Address:</strong> {selectedPatient.address || 'N/A'}</p>
                  </div>
                </div>

                <div className="detail-section">
                  <h4>🏥 Clinical Details</h4>
                  <div className="detail-grid">
                    <p><strong>Length of Stay:</strong> {selectedPatient.length_of_stay} days</p>
                    <p><strong>ER Visit:</strong> {selectedPatient.emergency_department_indicator === 'Y' ? 'Yes' : 'No'}</p>
                    <p><strong>Risk of Mortality:</strong> {selectedPatient.apr_risk_of_mortality}</p>
                    <p><strong>Type of Admission:</strong> {selectedPatient.type_of_admission}</p>
                    <p><strong>Payment Typology:</strong> {selectedPatient.payment_typology_1}</p>
                    <p><strong>Facility Name:</strong> {selectedPatient.facility_name || 'N/A'}</p>
                    <p><strong>Discharge Year:</strong> {selectedPatient.discharge_year || 'N/A'}</p>
                  </div>
                </div>

                <div className="detail-section">
                  <h4>📋 Medical History</h4>
                  <p>{selectedPatient.medical_history || 'No medical history recorded.'}</p>
                </div>

                <div className="detail-section">
                  <h4>🚨 Emergency Contact</h4>
                  <div className="detail-grid">
                    <p><strong>Contact Name:</strong> {selectedPatient.emergency_contact_name || 'N/A'}</p>
                    <p><strong>Contact Phone:</strong> {selectedPatient.emergency_contact_phone || 'N/A'}</p>
                  </div>
                </div>

                <div className="detail-section highlight">
                  <h4>💰 AI Financial Analysis</h4>
                  <div className="detail-grid">
                    <p><strong>Predicted Total Cost:</strong> ₹{selectedPatient.predicted_cost?.toLocaleString()}</p>
                    <p><strong>Prediction Date:</strong> {selectedPatient.prediction_date ? new Date(selectedPatient.prediction_date).toLocaleDateString() : 'N/A'}</p>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="primary-btn" onClick={() => setSelectedPatient(null)}>Close Profile</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
