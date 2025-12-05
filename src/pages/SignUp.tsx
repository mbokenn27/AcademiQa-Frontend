import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

// === HTTP BASES ===
const API_ROOT = (import.meta.env.VITE_API_BASE || 'http://localhost:8000').replace(/\/+$/, '');
const API_BASE = /\/api\/?$/.test(API_ROOT) ? API_ROOT : `${API_ROOT}/api`;


const signUpSchema = z
  .object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
    first_name: z.string().min(1, "First name is required"),
    last_name: z.string().min(1, "Last name is required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignUpForm = z.infer<typeof signUpSchema>;

export default function SignUp() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpForm>({
    resolver: zodResolver(signUpSchema),
  });

  const onSubmit = async (data: SignUpForm) => {
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE}/auth/register/`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: data.username,
          email: data.email,
          password: data.password,
          first_name: data.first_name,
          last_name: data.last_name,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess("Account created successfully! Redirecting to login...");
        setTimeout(() => {
          navigate("/login", { replace: true });
        }, 2000);
      } else {
        if (result.username) {
          setError(`Username: ${result.username[0]}`);
        } else if (result.email) {
          setError(`Email: ${result.email[0]}`);
        } else if (result.password) {
          setError(`Password: ${result.password[0]}`);
        } else if (result.non_field_errors) {
          setError(result.non_field_errors[0]);
        } else {
          setError(result.detail || "Registration failed. Please try again.");
        }
      }
      
    } catch (err: any) {
      console.error("Registration error:", err);
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
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

      {/* Dark Overlay + Centered Form */}
      <div className="flex-1 flex items-center justify-center bg-black bg-opacity-60 px-4 py-12">
        
        {/* Smaller Form Card */}
        <div className="relative max-w-sm w-full bg-white bg-opacity-95 rounded-xl shadow-xl p-6 backdrop-blur-sm">
          <div className="text-center mb-6">
            <h6 className="text-2xl font-bold text-gray-900">Create Account</h6>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700">First Name</label>
                <Input
                  {...register("first_name")}
                  type="text"
                  placeholder="John"
                  className="mt-1"
                />
                {errors.first_name && (
                  <p className="text-red-500 text-xs mt-1">{errors.first_name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700">Last Name</label>
                <Input
                  {...register("last_name")}
                  type="text"
                  placeholder="Doe"
                  className="mt-1"
                />
                {errors.last_name && (
                  <p className="text-red-500 text-xs mt-1">{errors.last_name.message}</p>
                )}
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-semibold text-gray-700">Username</label>
              <Input
                {...register("username")}
                type="text"
                placeholder="e.g., john_doe2025"
                className="mt-1"
              />
              {errors.username && (
                <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700">Email Address</label>
              <Input
                {...register("email")}
                type="email"
                placeholder="you@example.com"
                className="mt-1"
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700">Password</label>
              <Input
                {...register("password")}
                type="password"
                placeholder="••••••••"
                className="mt-1"
              />
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700">Confirm Password</label>
              <Input
                {...register("confirmPassword")}
                type="password"
                placeholder="••••••••"
                className="mt-1"
              />
              {errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 text-lg font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl shadow-lg transform transition hover:scale-105 disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <i className="ri-loader-4-line animate-spin mr-2"></i>
                  Creating Account...
                </>
              ) : (
                "Sign Up Free"
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link to="/login" className="font-bold text-primary hover:underline">
              Log in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
