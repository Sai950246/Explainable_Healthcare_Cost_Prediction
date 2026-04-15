import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });

  const register = async () => {
    try {
      await axios.post("http://127.0.0.1:8000/auth/register", form);
      alert("Registration successful!");
      navigate("/auth/login");
    } catch {
      alert("User already exists");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Create Account</h1>
        <p className="subtitle">Join the Medical App</p>

        <input
          placeholder="Username"
          onChange={e => setForm({ ...form, username: e.target.value })}
        />
        <input
          placeholder="Email address"
          onChange={e => setForm({ ...form, email: e.target.value })}
        />
        <input
          type="password"
          placeholder="Password"
          onChange={e => setForm({ ...form, password: e.target.value })}
        />

        <button className="primary-btn" onClick={register} onKeyDown={e => e.key === "Enter" && register()}>
          Register
        </button>

        <div className="divider">OR</div>

        <button className="social-btn google" onClick={() => alert("Google login coming soon 🚀")}>
          Sign up with Google
        </button>

        <p className="switch-text">
          Already have an account?{" "}
          <span onClick={() => navigate("/login")}>
            Login
          </span>
        </p>
      </div>
    </div>
  );
}