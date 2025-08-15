import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLogin } from "../hooks/useLogin";
import ApiStatusIndicator from "../components/ApiStatusIndicators";

const Login = () => {
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState<string | undefined>();
  const navigate = useNavigate();
  const { trigger } = useLogin();

  // 🔹 Redirect if already authenticated
  useEffect(() => {
    const token = localStorage.getItem("access_token"); // or wherever you store the JWT
    if (token) {
      navigate("/"); // navigate to dashboard/home
    }
  }, [navigate]);

  const handleLogin = async () => {
    setStatus("loading");
    setMessage("Logging in...");
    try {
      const data = await trigger({ username, password });
      setStatus("success");
      setMessage("Login successful!");

      // Save username and role to localStorage for auto login
      localStorage.setItem("username", username);
      localStorage.setItem("role", data.role);

      // redirect after a short pause
      setTimeout(() => {
        navigate("/");
      }, 300);
    } catch (err: any) {
      setStatus("error");
      setMessage(err?.message || "Login failed (unknown error)");
      console.error("Login error:", err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-login-gradient">
      <div className="bg-white shadow-2xl rounded-3xl w-full max-w-md px-10 py-8">
        <div className="flex flex-col items-center">
          <img src="/SGVLogoLight.png" alt="Logo" className="h-20 mb-6" />
          <h2 className="text-2xl font-bold text-gray-600 mb-8">
            ECL Automation
          </h2>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              className="w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={status === "loading"}
            className={`w-full ${
              status === "loading" ? "bg-gray-400" : "bg-[#cc6ff1]/90"
            } cursor-pointer text-white font-bold py-2 rounded-md transition duration-200`}
          >
            {status === "loading" ? "Logging in..." : "Log In"}
          </button>
        </div>
      </div>

      <ApiStatusIndicator
        status={status}
        message={message}
        autoHide={true}
        onHide={() => setStatus("idle")}
      />
    </div>
  );
};

export default Login;
