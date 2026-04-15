import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = async () => {
    try {
      const res = await axios.post("http://127.0.0.1:8000/auth/login", {
        email: email,
        password: password
      });

      // ✅ STORE AUTH SESSION
      localStorage.setItem("authToken", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      localStorage.setItem("loginTime", Date.now()); // ⭐ IMPORTANT

      navigate("/");
    } catch {
      alert("Invalid email or password");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Welcome Back</h1>
        <p className="subtitle">Login to your account</p>

        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />

        <button className="primary-btn" onClick={login} onKeyDown={e => e.key === "Enter" && login()}>
          Login
        </button>

        <div className="divider">OR</div>

        <button
          className="social-btn google"
          onClick={() => alert("Google login coming soon 🚀")}
        >
          Continue with Google
        </button>

        <button
          className="social-btn facebook"
          onClick={() => alert("Facebook login coming soon 🚀")}
        >
          Continue with Facebook
        </button>

        <p className="switch-text">
          New user?{" "}
          <span onClick={() => navigate("/register")}>
            Create account
          </span>
        </p>
      </div>
    </div>
  );
}