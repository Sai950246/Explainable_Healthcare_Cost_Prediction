import { useEffect, useState } from "react";
import axios from "axios";

export default function Dashboard() {
  const [status, setStatus] = useState("Checking...");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [hospitalStats, setHospitalStats] = useState(null);

  useEffect(() => {
    // Load user data from localStorage
    const userData = localStorage.getItem("user");
    if (userData) {
      setUser(JSON.parse(userData));
    }

    loadDashboardData();
    // Set up auto-refresh every 60 seconds for real-time updates
    const interval = setInterval(loadDashboardData, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      // Check backend status
      const statusRes = await axios.get("http://127.0.0.1:8000/stats");
      setStatus("🟢 System Online");
      setHospitalStats(statusRes.data);

      // Load AI model metrics
      const metricsRes = await axios.get("http://127.0.0.1:8000/model-metrics");
      setMetrics(metricsRes.data);

      setLastUpdate(new Date());
    } catch (error) {
      setStatus("🔴 System Offline");
      console.error("Dashboard data load error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const getPerformanceColor = (r2Score) => {
    if (r2Score >= 0.85) return "#27ae60";
    if (r2Score >= 0.75) return "#f39c12";
    return "#e74c3c";
  };

  const getMAEColor = (mae) => {
    if (mae <= 1500) return "#27ae60";
    if (mae <= 2500) return "#f39c12";
    return "#e74c3c";
  };

  const getPerformanceGrade = (r2Score) => {
    if (r2Score >= 0.85) return "Excellent";
    if (r2Score >= 0.75) return "Good";
    if (r2Score >= 0.65) return "Fair";
    return "Needs Improvement";
  };

  if (loading) {
    return (
      <div className="hospital-loading">
        <div className="hospital-logo">
          <div className="cross-icon">✚</div>
          <h2>MediCare AI</h2>
        </div>
        <div className="loading-spinner"></div>
        <h3>Loading Your Dashboard...</h3>
        <p>Initializing your personal healthcare analytics</p>
      </div>
    );
  }

  return (
    <div className="hospital-dashboard">
      {/* Professional Header */}
      <div className="hospital-header">
        <div className="header-main">
          <div className="hospital-brand">
            <div className="hospital-icon">🏥</div>
            <div className="brand-info">
              <h1>MediCare AI Platform</h1>
              <p>Your Personal Healthcare Analytics & Cost Prediction</p>
            </div>
          </div>

          <div className="header-status">
            <div className="system-status">
              <span className={`status-indicator ${status.includes('🟢') ? 'online' : 'offline'}`}>
                {status.includes('🟢') ? '●' : '●'}
              </span>
              <span className="status-text">{status}</span>
            </div>
            <div className="last-sync">
              Last sync: {lastUpdate.toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* User Profile Section */}
        <div className="user-section">
          <div className="welcome-message">
            <h3>{user ? `${getGreeting()}, ${user.name || user.email}!` : "Welcome to MediCare AI"}</h3>
            <p>Your personal AI-powered healthcare analytics platform</p>
          </div>

          <div className="user-profile-section">
            <div className="user-profile" onClick={() => setShowProfile(!showProfile)}>
              <div className="user-avatar">
                {user?.name ? user.name.charAt(0).toUpperCase() : "👤"}
              </div>
              <div className="user-info">
                <div className="user-name">{user?.name || "Healthcare User"}</div>
                <div className="user-role">Healthcare Professional</div>
              </div>
              <div className="profile-dropdown-icon">
                {showProfile ? "▲" : "▼"}
              </div>
            </div>

            {/* Profile Dropdown */}
            {showProfile && (
              <div className="profile-dropdown">
                <div className="profile-header">
                  <div className="profile-avatar-large">
                    {user?.name ? user.name.charAt(0).toUpperCase() : "👤"}
                  </div>
                  <div className="profile-details">
                    <div className="profile-name">{user?.name || "Healthcare User"}</div>
                    <div className="profile-email">{user?.email}</div>
                    <div className="profile-role">Healthcare Professional</div>
                    <div className="profile-hospital">MediCare AI Platform</div>
                  </div>
                </div>

                <div className="profile-actions">
                  <button className="profile-btn settings">
                    ⚙️ System Settings
                  </button>
                  <button className="profile-btn reports">
                    📊 Generate Reports
                  </button>
                  <button className="profile-btn help">
                    ❓ Help & Training
                  </button>
                  <button className="profile-btn logout" onClick={handleLogout}>
                    🔒 Secure Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions-section">
        <h2>🚀 Quick Actions</h2>
        <div className="actions-grid">
          <button className="action-btn primary" onClick={() => window.location.href = '/new-patient'}>
            ➕ New Patient Assessment
          </button>
          <button className="action-btn secondary" onClick={() => window.location.href = '/existing-patient'}>
            📋 View All Patients
          </button>
          <button className="action-btn accent" onClick={() => window.location.href = '/eda'}>
            📊 Advanced Analytics
          </button>
          <button className="action-btn info" onClick={() => loadDashboardData()}>
            🔄 Refresh Data
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="hospital-overview">
        <div className="overview-grid">
          <div className="overview-card patients">
            <div className="card-icon">👥</div>
            <div className="card-content">
              <div className="card-value">{hospitalStats?.total_patients || 0}</div>
              <div className="card-label">Total Patients</div>
              <div className="card-subtitle">Active Records</div>
            </div>
          </div>

          <div className="overview-card costs">
            <div className="card-icon">💰</div>
            <div className="card-content">
              <div className="card-value">
                ₹{hospitalStats?.average_predicted_cost ?
                  Math.round(hospitalStats.average_predicted_cost).toLocaleString() : '0'}
              </div>
              <div className="card-label">Avg. Prediction Cost</div>
              <div className="card-subtitle">For Existing Patient</div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Model Performance Section */}
      {metrics && (
        <div className="ai-performance-section">
          <div className="section-header">
            <h2>🤖 AI Model Performance</h2>
            <div className="model-info">
              <span className="model-name">{metrics.best_model || "Advanced ML Model"}</span>
              <span className="model-status">{metrics.model_status || "Optimized"}</span>
            </div>
          </div>

          <div className="performance-metrics">
            {/* R² Score */}
            <div className="metric-card r2-metric">
              <div className="metric-header">
                <div className="metric-icon">📈</div>
                <div className="metric-info">
                  <h3>R² Score</h3>
                  <p>Coefficient of Determination</p>
                </div>
              </div>
              <div className="metric-value" style={{color: getPerformanceColor(metrics.R2_score)}}>
                {typeof metrics.R2_percentage === 'number' ? metrics.R2_percentage.toFixed(1) : (typeof metrics.R2_score === 'number' ? (metrics.R2_score * 100).toFixed(1) : 0)}%
              </div>
              <div className="metric-grade">
                {getPerformanceGrade(metrics.R2_score)}
              </div>
              <div className="metric-bar">
                <div
                  className="metric-fill"
                  style={{
                    width: `${Math.max(0, Math.min(100, (metrics.R2_score || 0) * 100))}%`,
                    backgroundColor: getPerformanceColor(metrics.R2_score)
                  }}
                ></div>
              </div>
              <div className="metric-description">
                {metrics.R2_score >= 0.85 ? 'Exceptional predictive accuracy' :
                 metrics.R2_score >= 0.75 ? 'Strong predictive power' :
                 metrics.R2_score >= 0.65 ? 'Moderate accuracy' : 'Requires model improvement'}
              </div>
            </div>

            {/* Mean Absolute Error */}
            <div className="metric-card mae-metric">
              <div className="metric-header">
                <div className="metric-icon">🎯</div>
                <div className="metric-info">
                  <h3>Mean Absolute Error</h3>
                  <p>Average Prediction Error</p>
                </div>
              </div>
              <div className="metric-value" style={{color: getMAEColor(metrics.MAE)}}>
                ₹{typeof metrics.MAE === 'number' ? Math.round(metrics.MAE).toLocaleString() : 0}
              </div>
              <div className="metric-grade">
                {metrics.MAE <= 1500 ? 'High Accuracy' :
                 metrics.MAE <= 2500 ? 'Good Accuracy' : 'Fair Accuracy'}
              </div>
              <div className="metric-bar">
                <div
                  className="metric-fill mae"
                  style={{
                    width: `${Math.min(100, (metrics.MAE || 0) / 50)}%`,
                    backgroundColor: getMAEColor(metrics.MAE)
                  }}
                ></div>
              </div>
              <div className="metric-description">
                {metrics.MAE <= 1500 ? 'Very precise cost predictions' :
                 metrics.MAE <= 2500 ? 'Reliable cost estimates' :
                 metrics.MAE <= 4000 ? 'Acceptable prediction range' : 'Wide prediction variance'}
              </div>
            </div>

            {/* Cross-Validation Score */}
            <div className="metric-card cv-metric">
              <div className="metric-header">
                <div className="metric-icon">🔬</div>
                <div className="metric-info">
                  <h3>Root Mean Squared Error</h3>
                  <p>Prediction Variance</p>
                </div>
              </div>
              <div className="metric-value">
                ₹{typeof metrics.RMSE === 'number' ? Math.round(metrics.RMSE).toLocaleString() : 0}
              </div>
              <div className="metric-grade">
                {metrics.RMSE <= 2000 ? 'Low Variance' :
                 metrics.RMSE <= 3500 ? 'Moderate Variance' : 'High Variance'}
              </div>
              <div className="metric-bar">
                <div
                  className="metric-fill"
                  style={{
                    width: `${Math.min(100, (metrics.RMSE || 0) / 50)}%`,
                    backgroundColor: metrics.RMSE <= 2000 ? '#27ae60' :
                                   metrics.RMSE <= 3500 ? '#f39c12' : '#e74c3c'
                  }}
                ></div>
              </div>
              <div className="metric-description">
                Measures variability of prediction errors
              </div>
            </div>

            {/* Cross-Validation Score */}
            <div className="metric-card cv-metric">
              <div className="metric-header">
                <div className="metric-icon">🔬</div>
                <div className="metric-info">
                  <h3>Cross-Validation</h3>
                  <p>Model Stability (5-fold)</p>
                </div>
              </div>
              <div className="metric-value">
                {typeof metrics.CV_R2_mean_percentage === 'number' ? metrics.CV_R2_mean_percentage.toFixed(1) : (typeof metrics.CV_R2_mean === 'number' ? (metrics.CV_R2_mean * 100).toFixed(1) : 0)}%
              </div>
              <div className="metric-grade">
                {metrics.CV_R2_mean >= 0.8 ? 'Highly Stable' :
                 metrics.CV_R2_mean >= 0.7 ? 'Stable' : 'Variable'}
              </div>
              <div className="metric-bar">
                <div
                  className="metric-fill"
                  style={{
                    width: `${Math.max(0, Math.min(100, (metrics.CV_R2_mean || 0) * 100))}%`,
                    backgroundColor: metrics.CV_R2_mean >= 0.8 ? '#27ae60' :
                                   metrics.CV_R2_mean >= 0.7 ? '#f39c12' : '#e74c3c'
                  }}
                ></div>
              </div>
              <div className="metric-description">
                Consistent performance across different data subsets
              </div>
            </div>
          </div>

          {/* Model Insights */}
          <div className="model-insights">
            <h3>💡 AI Model Insights</h3>
            <div className="insights-grid">
              <div className="insight-item">
                <div className="insight-icon">🧠</div>
                <div className="insight-content">
                  <h4>Model Type</h4>
                  <p>{metrics.model_type || metrics.best_model || "Gradient Boosting"}</p>
                </div>
              </div>
              <div className="insight-item">
                <div className="insight-icon">⚡</div>
                <div className="insight-content">
                  <h4>Status</h4>
                  <p>{metrics.model_status || metrics.accuracy_grade || "Optimized"}</p>
                </div>
              </div>
              <div className="insight-item">
                <div className="insight-icon">📊</div>
                <div className="insight-content">
                  <h4>Training Samples</h4>
                  <p>{metrics.training_samples ? metrics.training_samples.toLocaleString() : 0} Records</p>
                </div>
              </div>
              <div className="insight-item">
                <div className="insight-icon">🎯</div>
                <div className="insight-content">
                  <h4>Grade</h4>
                  <p>{metrics.accuracy_grade || "Good"}</p>
                </div>
              </div>
              <div className="insight-item">
                <div className="insight-icon">⚙️</div>
                <div className="insight-content">
                  <h4>Estimators</h4>
                  <p>{metrics.estimators || 500} Trees</p>
                </div>
              </div>
              <div className="insight-item">
                <div className="insight-icon">📈</div>
                <div className="insight-content">
                  <h4>Depth</h4>
                  <p>Max {metrics.max_depth || 12} Levels</p>
                </div>
              </div>
              <div className="insight-item">
                <div className="insight-icon">🔄</div>
                <div className="insight-content">
                  <h4>Learning Rate</h4>
                  <p>{metrics.learning_rate || 0.03}</p>
                </div>
              </div>
              <div className="insight-item">
                <div className="insight-icon">🕐</div>
                <div className="insight-content">
                  <h4>Last Updated</h4>
                  <p>{metrics.last_trained ? new Date(metrics.last_trained).toLocaleDateString() : lastUpdate.toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* System Health Footer */}
      <div className="system-footer">
        <div className="footer-content">
          <div className="system-health">
            <span className="health-icon">💚</span>
            <span className="health-text">All Systems Operational</span>
          </div>
          <div className="version-info">
            MediCare AI v2.0 | Last updated: {lastUpdate.toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
}
