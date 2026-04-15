import { NavLink } from "react-router-dom";

export default function Sidebar() {
  return (
    <div className="sidebar">
      <h2>🏥 Medical Cost</h2>
      <nav>
        <NavLink to="/">Dashboard</NavLink>
        <NavLink to="/new-patient">New Patient</NavLink>
        <NavLink to="/existing-patient">Existing Patient</NavLink>
        <NavLink to="/eda">EDA & Data</NavLink>
      </nav>
    </div>
  );
}
