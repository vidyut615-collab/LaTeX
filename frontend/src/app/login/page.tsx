// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { API_URL, authHeaders } from "@/utils/api";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const router = useRouter();

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem("session_token");
            if (token) {
                const res = await fetch(`${API_URL}/api/auth/status`, { headers: authHeaders() });
                if (res.ok) {
                    const data = await res.json();
                    if (data.authenticated) router.push("/extractor");
                }
            }
        };
        checkAuth();
    }, [router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        try {
            const res = await fetch(`${API_URL}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (res.ok && data.token) {
                localStorage.setItem("session_token", data.token);
                localStorage.setItem("user_role", data.user.role);
                router.push("/extractor");
            } else {
                setError(data.detail || "Login failed");
            }
        } catch (err) {
            setError("Network error. Please make sure the backend is running.");
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-8">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg shadow-indigo-200">
                        <i className="fa-solid fa-file-pdf"></i>
                    </div>
                    <h1 className="text-2xl font-black text-slate-800">LMS Extractor</h1>
                    <p className="text-slate-500 text-sm mt-2">Login to access the workspace</p>
                </div>
                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Username</label>
                        <input type="text" value={username} onChange={e=>setUsername(e.target.value)} className="w-full border border-slate-300 rounded-xl p-3 outline-none focus:border-indigo-500 transition" required />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Password</label>
                        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full border border-slate-300 rounded-xl p-3 outline-none focus:border-indigo-500 transition" required />
                    </div>
                    {error && <p className="text-red-500 text-sm font-semibold">{error}</p>}
                    <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-200">
                        Sign In
                    </button>
                </form>
            </div>
        </div>
    );
}
