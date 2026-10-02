"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Header() {
    const pathname = usePathname();
    const router = useRouter();
    const [role, setRole] = useState('');

    useEffect(() => {
        setRole(localStorage.getItem('user_role') || '');
    }, [pathname]);

    const handleLogout = () => {
        localStorage.removeItem('session_token');
        localStorage.removeItem('user_role');
        router.push('/login');
    };

    if (pathname === '/login' || pathname === '/') return null;

    return (
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center text-lg shadow-sm">
                        <i className="fa-solid fa-file-pdf"></i>
                    </div>
                    <h1 className="text-xl font-black text-slate-800 tracking-tight">LMS Extractor</h1>
                </div>
                
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
                    <Link 
                        href="/extractor" 
                        className={`px-4 py-1.5 rounded-md text-sm font-bold transition flex items-center gap-2 ${pathname === '/extractor' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <i className="fa-solid fa-wand-magic-sparkles"></i> Workspace
                    </Link>
                    {role === 'super_admin' && (
                        <Link 
                            href="/admin" 
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition flex items-center gap-2 ${pathname === '/admin' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <i className="fa-solid fa-shield-halved"></i> Super Admin
                        </Link>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    <button onClick={handleLogout} className="text-slate-500 hover:text-red-600 transition flex items-center gap-2 text-sm font-bold px-3 py-1.5 rounded-lg hover:bg-red-50">
                        <i className="fa-solid fa-arrow-right-from-bracket"></i> Logout
                    </button>
                </div>
            </div>
        </header>
    );
}
