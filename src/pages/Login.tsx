import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLogin } from "../hooks/useLogin";
import ApiStatusIndicator from "../components/ApiStatusIndicators";
import BackgroundComponent from "../components/BGComponent";
import { ArrowRightStartOnRectangleIcon } from "@heroicons/react/24/outline";
import sgvLogo from "../assets/sgv_logo.png";

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
    <div className="flex h-screen w-screen items-center justify-center relative">
      <BackgroundComponent />
      {status !== "loading" && (
        <div className="w-1/2 overflow-hidden rounded-3xl shadow-md shadow-[#ccc] relative">
          <div className="bg-white flex flex-row items-center justify-center px-4 py-6 pt-8 text-center sm:px-16 text-black relative">
            <div>
              <img
                src={sgvLogo}
                alt="Logo"
                height={80}
                width={80}
                className="mr-2 rounded-[3px]"
              />
            </div>
            <div className="flex flex-col mr-8">
              <h3 className="text-2xl text-black mt-2"> ECL Automation</h3>
              <p className="text-lg text-black mt-2">
                An Integrated Stress Testing Internal Tool
              </p>
            </div>
          </div>
          <form
            onSubmit={handleLogin}
            className="flex flex-col  bg-white px-4 pb-6 pt-8 sm:px-16"
          >
            <div>
              <label htmlFor="username" className="block uppercase">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                className="mt-1 block w-full rounded-md border-2 border-yellow-500 focus:border-yellow-500 focus:ring-yellow-500 px-3 py-4"
              />
            </div>
            <div className="mt-6">
              <label htmlFor="password" className="block uppercase">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border-2 border-yellow-500 focus:border-yellow-500 focus:ring-yellow-500 px-3 py-4"
              />
            </div>
            <div className="my-10">
              {status === "error" && message && (
                <p className="text-red-500">{message}</p>
              )}
              <button
                type="submit"
                className="bg-[#762627] text-white font-bold py-6 w-full rounded-md flex items-center justify-center gap-2"
                // onClick={handleLogin}
              >
                {status !== "idle" ? "Logging in..." : "Log In"}
                <ArrowRightStartOnRectangleIcon className="h-6 w-6" />
              </button>
            </div>
          </form>
        </div>
      )}
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
