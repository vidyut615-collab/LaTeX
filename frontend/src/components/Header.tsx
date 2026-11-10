// @ts-nocheck
"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { API_URL, authHeaders } from '@/utils/api';
import { 
    FileText, 
    Sparkles, 
    ShieldCheck, 
    LogOut, 
    CheckCircle2, 
    AlertCircle, 
    Layers, 
    User,
    Activity
} from 'lucide-react';

export default function Header() {
    const pathname = usePathname();
    const router = useRouter();
    const [role, setRole] = useState('');
    const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

    useEffect(() => {
        setRole(localStorage.getItem('user_role') || '');
        
        // Check backend health
        const checkBackend = async () => {
            try {
                const res = await fetch(`${API_URL}/api/auth/status`, { 
                    headers: authHeaders(),
                    signal: AbortSignal.timeout(3000) 
                });
                setBackendOnline(res.ok);
            } catch {
                setBackendOnline(false);
            }
        };

        checkBackend();
        const interval = setInterval(checkBackend, 30000);
        return () => clearInterval(interval);
    }, [pathname]);

    const handleLogout = () => {
        localStorage.removeItem('session_token');
        localStorage.removeItem('user_role');
        router.push('/login');
    };

    if (pathname === '/login' || pathname === '/') return null;

    return (
        <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-slate-200/80 transition-all duration-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
                
                {/* Brand Logo & Title */}
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 ring-1 ring-white/20">
                        <FileText className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 tracking-tight text-base sm:text-lg">
                                Testpress <span className="text-indigo-600 font-black">Extractor</span>
                            </span>
                            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                                LMS Bulk Ready
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500 hidden md:block">
                            EdTech Word Document &amp; Explanation Extraction Engine
                        </p>
                    </div>
                </div>

                {/* Navigation Pills */}
                <nav className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 shadow-inner">
                    <Link 
                        href="/extractor" 
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-2 ${
                            pathname === '/extractor' 
                                ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/60 font-bold' 
                                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                        }`}
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Workspace</span>
                    </Link>

                    {role === 'super_admin' && (
                        <Link 
                            href="/admin" 
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-2 ${
                                pathname === '/admin' 
                                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/60 font-bold' 
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                            }`}
                        >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Super Admin</span>
                        </Link>
                    )}
                </nav>

                {/* Right Status & Actions */}
                <div className="flex items-center gap-3">
                    
                    {/* Backend Health Pill */}
                    <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-slate-50 border-slate-200/70">
                        {backendOnline === null ? (
                            <>
                                <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse"></span>
                                <span className="text-slate-500 text-[11px]">Connecting...</span>
                            </>
                        ) : backendOnline ? (
                            <>
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                                <span className="text-emerald-700 text-[11px] font-semibold">Engine Live</span>
                            </>
                        ) : (
                            <>
                                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                <span className="text-rose-600 text-[11px] font-semibold">Offline</span>
                            </>
                        )}
                    </div>

                    {/* Role Pill */}
                    {role && (
                        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200/60">
                            <User className="w-3 h-3 text-slate-500" />
                            <span className="capitalize text-[11px] font-semibold">{role.replace('_', ' ')}</span>
                        </div>
                    )}

                    {/* Logout Button */}
                    <button 
                        onClick={handleLogout} 
                        className="text-slate-600 hover:text-rose-600 transition-all duration-150 flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-100"
                        title="Sign Out"
                    >
                        <LogOut className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Logout</span>
                    </button>
                </div>

            </div>
        </header>
    );
}
