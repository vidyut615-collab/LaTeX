// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { API_URL, authHeaders } from "@/utils/api";
import { 
    FileText, 
    Lock, 
    User, 
    Eye, 
    EyeOff, 
    ArrowRight, 
    CheckCircle2, 
    Sparkles, 
    ShieldCheck, 
    Zap
} from "lucide-react";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem("session_token");
            if (token) {
                try {
                    const res = await fetch(`${API_URL}/api/auth/status`, { headers: authHeaders() });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.authenticated) router.push("/extractor");
                    }
                } catch (e) {
                    // Ignore background check failure
                }
            }
        };
        checkAuth();
    }, [router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);
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
                setError(data.detail || "Invalid username or password");
            }
        } catch (err) {
            setError("Cannot connect to server. Please ensure the backend is running.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
            {/* Background decorative glows & grid */}
            <div className="absolute inset-0 bg-grid-slate-dark pointer-events-none opacity-40"></div>
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-10 right-10 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 rounded-3xl overflow-hidden shadow-2xl border border-slate-700/60 studio-glass-dark z-10">
                
                {/* Left Brand / Feature Showcase Panel */}
                <div className="md:col-span-5 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-8 sm:p-10 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-800 text-white relative">
                    <div>
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white mb-5 shadow-lg shadow-indigo-500/30 ring-1 ring-white/20">
                            <FileText className="w-6 h-6" />
                        </div>
                        
                        {/* Powered by Truskill Badge */}
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 mb-4 shadow-sm">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Powered by Truskill</span>
                        </div>

                        <h2 className="text-2xl font-black tracking-tight text-white leading-tight">
                            Document Intelligence for EdTech
                        </h2>

                        <p className="text-xs text-slate-300 mt-3 leading-relaxed">
                            Convert complex multi-column question banks and solution sets into pristine, bulk-uploadable Testpress Word documents and answer keys.
                        </p>
                    </div>

                    <div className="mt-8 space-y-3.5 border-t border-slate-800/80 pt-6">
                        <div className="flex items-start gap-3">
                            <div className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                            </div>
                            <p className="text-xs text-slate-300">
                                <strong className="text-white font-semibold">Smart Paragraph Assembly:</strong> Smooth, contiguous explanations without margin fragmentation.
                            </p>
                        </div>

                        <div className="flex items-start gap-3">
                            <div className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                            </div>
                            <p className="text-xs text-slate-300">
                                <strong className="text-white font-semibold">Diagram &amp; Math Preservation:</strong> Extracts visual figures, formulas, and diagrams into bulk media bundles.
                            </p>
                        </div>

                        <div className="flex items-start gap-3">
                            <div className="w-5 h-5 rounded-md bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                            </div>
                            <p className="text-xs text-slate-300">
                                <strong className="text-white font-semibold">Pre-Flight Validation:</strong> Automated completeness audit before extraction runs.
                            </p>
                        </div>
                    </div>

                    <div className="mt-8 text-[11px] text-slate-400 flex items-center justify-between">
                        <span>Protected Workspace</span>
                        <span className="flex items-center gap-1 text-slate-300 font-medium">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                            FastAPI &amp; Next.js
                        </span>
                    </div>
                </div>

                {/* Right Form Panel */}
                <div className="md:col-span-7 bg-white p-8 sm:p-10 flex flex-col justify-center">
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                                Sign in to your account
                            </h3>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                Truskill LMS
                            </span>
                        </div>
                        <p className="text-xs text-slate-500">
                            Enter your credentials to access the extraction workspace
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2.5 animate-fade-in">
                            <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></div>
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                Username
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                    <User className="w-4 h-4" />
                                </div>
                                <input 
                                    type="text" 
                                    value={username} 
                                    onChange={e => setUsername(e.target.value)} 
                                    placeholder="Enter username"
                                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition-all duration-150" 
                                    required 
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                    <Lock className="w-4 h-4" />
                                </div>
                                <input 
                                    type={showPassword ? "text" : "password"} 
                                    value={password} 
                                    onChange={e => setPassword(e.target.value)} 
                                    placeholder="••••••••"
                                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-11 py-3 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition-all duration-150" 
                                    required 
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:pointer-events-none"
                        >
                            {isLoading ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    <span>Authenticating...</span>
                                </>
                            ) : (
                                <>
                                    <span>Sign in to Workspace</span>
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                </div>

            </div>

            <div className="mt-8 text-center text-xs text-slate-400 z-10 flex items-center justify-center gap-1.5 font-medium">
                <span>&copy; {new Date().getFullYear()} Testpress LMS Extractor</span>
                <span>&bull;</span>
                <span className="text-slate-300 font-semibold">Powered by Truskill</span>
            </div>
        </div>
    );
}
