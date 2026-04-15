import { Routes, Route, NavLink, useLocation, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import EDA from "./pages/EDA";
import NewPatient from "./pages/NewPatient";
import ExistingPatient from "./pages/ExistingPatient";
import "./App.css";

const SESSION_DURATION = 30 * 60 * 1000; // 30 minute

export default function App() {
  const location = useLocation();

  const token = localStorage.getItem("authToken");
  const loginTime = localStorage.getItem("loginTime");

  const isAuthPage =
    location.pathname === "/login" || location.pathname === "/register";

  //  SESSION EXPIRY CHECK
  const isSessionExpired = () => {
    if (!token || !loginTime) return true;
    return Date.now() - Number(loginTime) > SESSION_DURATION;
  };

  if (isSessionExpired() && !isAuthPage) {
    localStorage.clear();
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      {/* 🔐 AUTH PAGES */}
      {isAuthPage ? (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Routes>
      ) : (
        /* 🏥 MAIN APP */
        <div className="app">
          <aside className="sidebar">
            <h2>🏥 Medical App</h2>

            <nav>
              <NavLink to="/" end>Dashboard</NavLink>
              <NavLink to="/new-patient">New Patient</NavLink>
              <NavLink to="/existing-patient">Existing Patient</NavLink>
              <NavLink to="/eda">EDA</NavLink>
            </nav>

            <button
              className="logout-btn"
              onClick={() => {
                localStorage.clear();
                window.location.href = "/login";
              }}
            >
              <span>🔒</span> Logout
            </button>
          </aside>

          <main className="main-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/new-patient" element={<NewPatient />} />
              <Route path="/existing-patient" element={<ExistingPatient />} />
              <Route path="/eda" element={<EDA />} />
            </Routes>
          </main>
        </div>
      )}
    </>
  );
}