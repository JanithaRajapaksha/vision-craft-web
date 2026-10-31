"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { setAuthSession, getStoredUser, isFounder } from "@/lib/auth";
import {
  LogIn,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  User,
} from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If already logged in, redirect appropriately
  useEffect(() => {
    const existingUser = getStoredUser();
    if (existingUser) {
      if (redirectPath) {
        router.push(redirectPath);
      } else if (isFounder(existingUser)) {
        router.push("/admin");
      } else {
        router.push("/portal");
      }
    }
  }, [redirectPath, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Authentication failed. Please verify your credentials.");
      }

      setAuthSession(data.access_token, data.user);

      if (redirectPath) {
        router.push(redirectPath);
      } else if (data.user.role === "FOUNDER" || data.user.role === "SUPER_ADMIN") {
        router.push("/admin");
      } else {
        router.push("/portal");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFounder = (founderEmail: string) => {
    setEmail(founderEmail);
    setPassword("Password123!");
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl py-8 px-6 sm:px-8 shadow-2xl backdrop-blur-md">
      {errorMessage && (
        <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start space-x-3 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Email Address
          </label>
          <div className="relative rounded-lg shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Mail className="h-4 w-4" />
            </div>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. name@example.com"
              className="block w-full pl-10 pr-3 py-2.5 bg-slate-950/60 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Password
          </label>
          <div className="relative rounded-lg shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Lock className="h-4 w-4" />
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="block w-full pl-10 pr-3 py-2.5 bg-slate-950/60 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm shadow-md transition-all disabled:opacity-50"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </>
          )}
        </button>
      </form>

      {/* Customer Register Prompt */}
      <div className="mt-6 pt-5 border-t border-slate-800 text-center">
        <p className="text-xs text-slate-400">
          Don't have a customer account yet?{" "}
          <Link
            href="/register"
            className="font-semibold text-blue-400 hover:text-blue-300 transition-colors"
          >
            Register here
          </Link>
        </p>
      </div>

      {/* Quick Demo Login Pills for Co-Founders */}
      <div className="mt-6 pt-4 border-t border-slate-800/60">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2 text-center">
          Quick Co-Founder Demo Access
        </span>
        <div className="grid grid-cols-2 gap-2">
          {[
            { name: "Janitha", email: "janitha@visioncraft.lk" },
            { name: "Lalitha", email: "lalitha@visioncraft.lk" },
            { name: "Thakshila", email: "thakshila@visioncraft.lk" },
            { name: "Melanka", email: "melanka@visioncraft.lk" },
          ].map((f) => (
            <button
              key={f.email}
              type="button"
              onClick={() => handleQuickFounder(f.email)}
              className="py-1 px-2.5 bg-slate-800/70 hover:bg-slate-700/80 border border-slate-700/60 rounded-md text-[11px] text-slate-300 hover:text-white transition text-left flex items-center space-x-1.5"
            >
              <ShieldCheck className="w-3 h-3 text-blue-400 shrink-0" />
              <span className="truncate">{f.name} (Founder)</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background glowing ambient light */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-blue-600/15 blur-[120px] rounded-full pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center mb-4">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700/80 p-1 flex items-center justify-center shadow-lg group-hover:border-blue-500 transition-colors">
              <Image
                src="/logo.jpg"
                alt="VisionCraft Logo"
                width={40}
                height={40}
                className="rounded-lg object-contain"
              />
            </div>
            <div className="text-left">
              <span className="text-xl font-bold tracking-tight text-white block">
                Vision<span className="text-blue-500">Craft</span>
              </span>
              <span className="text-xs text-slate-400 block -mt-0.5">Engineering & FDM</span>
            </div>
          </Link>
        </div>

        <h2 className="text-center text-2xl font-bold tracking-tight text-white">
          Sign in to your account
        </h2>
        <p className="mt-1 text-center text-xs text-slate-400">
          Enter your credentials to access the Customer Portal or Management Hub
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <Suspense
          fallback={
            <div className="bg-slate-900 border border-slate-800 rounded-2xl py-12 text-center text-slate-500">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <span className="text-xs">Loading login form...</span>
            </div>
          }
        >
          <LoginForm />
        </Suspense>

        <div className="text-center mt-6">
          <Link
            href="/"
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors inline-flex items-center space-x-1"
          >
            <span>&larr; Return to VisionCraft Homepage</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

