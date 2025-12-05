// src/pages/Login.tsx   ← ENV-BASED + ROLE ROUTING AFTER LOGIN
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { authService } from "@/services/auth"; // we'll use this to fetch current user after login

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});
type LoginForm = z.infer<typeof loginSchema>;

// Small helper to build API URLs like https://host[/api]/auth/...
const API = (path: string) => {
  const base = (import.meta as any).env?.VITE_API_BASE?.replace(/\/+$/, "") || "";
  const p = path.startsWith("/api/") ? path : `/api${path.startsWith("/") ? path : `/${path}`}`;
  return `${base}${p}`;
};

export default function Login() {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [step, setStep] = useState<"login" | "email" | "code" | "newpassword">("login");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setError("");
    try {
      // AuthContext.login stores tokens + user in storage/state, but doesn't return it.
      await login(data);

      // Get fresh user explicitly and route by role
      const me = await authService.getCurrentUser();
      const role =
        (me as any)?.role ||
        (me as any)?.profile?.role ||
        (me as any)?.profile_role;

      if (role === "admin") navigate("/admin", { replace: true });
      else navigate("/client", { replace: true });
    } catch (err: any) {
      setError(err?.message || "Invalid username or password");
    }
  };

  const requestResetCode = async () => {
    if (!email.includes("@")) return setError("Enter a valid email");
    setLoading(true); setError(""); setMessage("");
    try {
      const res = await fetch(API("/auth/password-reset/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage(data?.detail || "Check your email for the 6-digit code");
        setStep("code");
      } else {
        setError(data?.error || data?.detail || "Failed to send code");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (code.length !== 6) return setError("Enter full 6-digit code");
    setLoading(true); setError("");
    try {
      const res = await fetch(API("/auth/password-reset-confirm/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setStep("newpassword");
      else setError(data?.error || data?.detail || "Invalid code");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const completeReset = async () => {
    if (newPassword.length < 6) return setError("Password too short");
    setLoading(true); setError("");
    try {
      const res = await fetch(API("/auth/password-reset-complete/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, new_password: newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage("Password changed! You can now log in.");
        setStep("login");
        setEmail(""); setCode(""); setNewPassword("");
      } else {
        setError(data?.error || data?.detail || "Failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center flex flex-col"
      style={{
        backgroundImage:
          "url('https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1920&q=80')",
      }}
    >
      <div className="flex-1 flex items-center justify-center bg-black bg-opacity-60 px-4 py-12">
        <div className="relative max-w-sm w-full bg-white bg-opacity-95 rounded-xl shadow-xl p-6 backdrop-blur-sm">
          {step === "login" && (
            <>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Sign In</h2>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                  {error}
                </div>
              )}
              {message && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">
                  {message}
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700">Username</label>
                  <Input {...register("username")} placeholder="Enter your username" className="mt-1" />
                  {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700">Password</label>
                  <Input type="password" {...register("password")} placeholder="Enter your password" className="mt-1" />
                  {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 text-lg font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl shadow-lg transform transition hover:scale-105 disabled:opacity-70"
                >
                  {isSubmitting ? "Signing In..." : "Sign In"}
                </Button>
              </form>

              <p className="text-center text-sm text-gray-600 mt-6">
                Don’t have an account?{" "}
                <button type="button" onClick={() => navigate("/signup")} className="font-bold text-primary hover:underline">
                  Sign up here
                </button>
              </p>

              <p className="text-sm text-center mt-3">
                <button type="button" onClick={() => setStep("email")} className="text-primary hover:underline">
                  Forgot password?
                </button>
              </p>
            </>
          )}

          {step === "email" && (
            <>
              <h2 className="text-2xl font-bold text-center mb-6">Reset Password</h2>
              <p className="text-center text-gray-600 mb-6">Enter your email address</p>

              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="mb-6"
              />

              {error && <p className="text-red-600 text-sm text-center mb-4">{error}</p>}
              {message && <p className="text-green-600 text-sm text-center mb-4">{message}</p>}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("login")} className="flex-1">
                  Back
                </Button>
                <Button onClick={requestResetCode} disabled={loading || !email} className="flex-1">
                  {loading ? <Loader2 className="animate-spin mr-2" /> : "Send Code"}
                </Button>
              </div>
            </>
          )}

          {step === "code" && (
            <>
              <h2 className="text-2xl font-bold text-center mb-6">Enter Code</h2>
              <p className="text-center text-gray-600 mb-6">Check your email for the 6-digit code</p>

              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="text-center text-3xl tracking-widest font-mono mb-6"
                maxLength={6}
              />

              {error && <p className="text-red-600 text-sm text-center mb-4">{error}</p>}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("email")} className="flex-1">
                  Back
                </Button>
                <Button onClick={verifyCode} disabled={loading || code.length !== 6} className="flex-1">
                  {loading ? <Loader2 className="animate-spin mr-2" /> : "Verify"}
                </Button>
              </div>
            </>
          )}

          {step === "newpassword" && (
            <>
              <h2 className="text-2xl font-bold text-center mb-6">Set New Password</h2>

              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="mb-6"
              />

              {error && <p className="text-red-600 text-sm text-center mb-4">{error}</p>}
              {message && <p className="text-green-600 text-sm text-center mb-4">{message}</p>}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("login")} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={completeReset} disabled={loading || newPassword.length < 6} className="flex-1">
                  {loading ? <Loader2 className="animate-spin mr-2" /> : "Reset Password"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
