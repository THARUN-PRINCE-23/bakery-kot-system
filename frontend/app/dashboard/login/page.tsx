"use client";

import { useState } from "react";
import { login } from "../../../lib/api";

export default function DashboardLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const { token } = await login({ username: username.trim(), password });
      window.localStorage.setItem("authToken", token);
      window.location.href = "/dashboard";
    } catch (e: any) {
      setError(e.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold mb-4">Dashboard Login</h1>
        {error && (
          <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <label className="block text-sm text-gray-700 mb-3">
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 p-2"
            placeholder="admin"
          />
        </label>
        <label className="block text-sm text-gray-700 mb-4">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 p-2"
            placeholder="••••••••"
          />
        </label>
        <button
          onClick={submit}
          disabled={busy}
          className="w-full rounded bg-emerald-600 px-4 py-2 text-white shadow hover:-translate-y-0.5 hover:shadow-md transition disabled:opacity-60"
        >
          {busy ? "Signing in..." : "Sign In"}
        </button>
      </div>
    </main>
  );
}
