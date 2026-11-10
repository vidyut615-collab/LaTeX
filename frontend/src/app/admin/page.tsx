// @ts-nocheck
"use client";

import React, { useState, useEffect } from 'react';
import { API_URL, authHeaders } from '@/utils/api';
import { 
    Users, 
    Receipt, 
    Cpu, 
    Key, 
    Trash2, 
    ShieldCheck, 
    UserPlus, 
    Download, 
    Settings, 
    Sparkles, 
    Eye, 
    EyeOff, 
    FlaskConical, 
    CheckCircle2, 
    AlertTriangle, 
    X, 
    Check, 
    Coins, 
    Layers, 
    TrendingUp,
    FileSpreadsheet,
    Activity
} from 'lucide-react';

export default function AdminPage() {
    // Admin States
    const [adminSubTab, setAdminSubTab] = useState('users'); // 'users', 'logs', 'settings'
    const [usersList, setUsersList] = useState([]);
    const [newUserName, setNewUserName] = useState('');
    const [newUserUsername, setNewUserUsername] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [adminLogs, setAdminLogs] = useState([]);
    
    // AI Provider States
    const [activeAiProvider, setActiveAiProvider] = useState('gemini');
    const [geminiKeyInput, setGeminiKeyInput] = useState('');
    const [showGeminiKey, setShowGeminiKey] = useState(false);
    const [geminiStatus, setGeminiStatus] = useState(null);
    const [groqKeyInput, setGroqKeyInput] = useState('');
    const [showGroqKey, setShowGroqKey] = useState(false);
    const [groqStatus, setGroqStatus] = useState(null);
    
    const [models, setModels] = useState([]);
    const [geminiModel, setGeminiModel] = useState('gemini-2.5-flash-lite');
    const [groqModel, setGroqModel] = useState('meta-models/muse-spark-open');
    const [loadingModels, setLoadingModels] = useState(false);
    const [groqModels, setGroqModels] = useState([]);
    const [loadingGroqModels, setLoadingGroqModels] = useState(false);
    const [sandboxFile, setSandboxFile] = useState(null);
    const [sandboxMode, setSandboxMode] = useState('questions');
    const [sandboxResult, setSandboxResult] = useState(null);
    const [sandboxLoading, setSandboxLoading] = useState(false);
    const [adminMsg, setAdminMsg] = useState('');
    const [configModal, setConfigModal] = useState(null); // 'gemini' | 'groq' | null
    const [savingConfig, setSavingConfig] = useState(false);

    // Password Reset States
    const [resetPasswordModal, setResetPasswordModal] = useState(null);
    const [newPassword, setNewPassword] = useState('');

    const fetchAdminData = async () => {
        try {
            if (adminSubTab === 'users') {
                const res = await fetch(`${API_URL}/api/admin/users`, { headers: authHeaders() });
                if (res.ok) setUsersList(await res.json());
            } else if (adminSubTab === 'logs') {
                const res = await fetch(`${API_URL}/api/admin/logs`, { headers: authHeaders() });
                if (res.ok) setAdminLogs(await res.json());
            } else if (adminSubTab === 'settings') {
                const res = await fetch(`${API_URL}/api/admin/settings`, { headers: authHeaders() });
                if (res.ok) {
                    const data = await res.json();
                    setGeminiStatus(data);
                    if (data.gemini_full_key) setGeminiKeyInput(data.gemini_full_key);
                    if (data.groq_full_key) setGroqKeyInput(data.groq_full_key);
                    if (data.active_ai_provider) setActiveAiProvider(data.active_ai_provider);
                    if (data.gemini_model) setGeminiModel(data.gemini_model);
                    if (data.groq_model) setGroqModel(data.groq_model);
                }
            }
        } catch (err) {
            console.error("Admin fetch error:", err);
        }
    };

    useEffect(() => {
        fetchAdminData();
    }, [adminSubTab]);

    const handleAddUser = async (e) => {
        e.preventDefault();
        setAdminMsg('');
        try {
            const res = await fetch(`${API_URL}/api/admin/users`, {
                method: 'POST',
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newUserName, username: newUserUsername, password: newUserPassword })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Could not add user");
            setAdminMsg("User added successfully!");
            setNewUserName('');
            setNewUserUsername('');
            setNewUserPassword('');
            fetchAdminData();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!confirm("Are you sure you want to delete this user?")) return;
        try {
            const res = await fetch(`${API_URL}/api/admin/users/${userId}`, { method: 'DELETE', headers: authHeaders() });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || "Failed to delete");
            }
            fetchAdminData();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        if (!resetPasswordModal) return;
        try {
            const res = await fetch(`${API_URL}/api/admin/users/${resetPasswordModal.id}/password`, {
                method: 'PUT',
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: newPassword })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || "Failed to reset password");
            }
            setAdminMsg("Password reset successfully!");
            setResetPasswordModal(null);
            setNewPassword('');
        } catch (err) {
            alert(err.message);
        }
    };

    const fetchModels = async () => {
        setLoadingModels(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/models?provider=gemini`, { headers: authHeaders() });
            if (res.ok) {
                setModels(await res.json());
            } else {
                const err = await res.json();
                alert("Error fetching models: " + err.detail);
            }
        } catch (err) {
            console.error(err);
        }
        setLoadingModels(false);
    };

    const fetchGroqModels = async () => {
        setLoadingGroqModels(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/models?provider=groq`, { headers: authHeaders() });
            if (res.ok) {
                setGroqModels(await res.json());
            } else {
                const err = await res.json();
                alert("Error fetching Groq models: " + err.detail);
            }
        } catch (err) {
            console.error(err);
        }
        setLoadingGroqModels(false);
    };

    const exportLogsExcel = () => {
        if(!adminLogs.length) return alert('No logs to export');
        let csv = 'Timestamp,User,File,Model,AI Pages,In Tokens,Out Tokens,Total Tokens,Est. Cost\n';
        adminLogs.forEach(log => {
            csv += `"${new Date(log.created_at).toLocaleString()}","${log.user_name}","${log.pdf_name}","${log.model_used||''}","${log.pages_count}","${log.input_tokens}","${log.output_tokens}","${log.total_tokens}","${log.estimated_cost}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "Audit_Logs.csv";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSandboxTest = async (e) => {
        e.preventDefault();
        if (!sandboxFile) return alert("Please upload an image first");
        setSandboxLoading(true);
        setSandboxResult(null);
        try {
            const formData = new FormData();
            formData.append('file', sandboxFile);
            formData.append('mode', sandboxMode);
            
            const res = await fetch(`${API_URL}/api/admin/test-model`, {
                method: 'POST',
                headers: authHeaders(), 
                body: formData
            });
            
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail);
            setSandboxResult(data);
        } catch(err) {
            alert(err.message);
        }
        setSandboxLoading(false);
    };

    const handleSetActiveProvider = async (provider) => {
        setActiveAiProvider(provider);
        setAdminMsg('');
        try {
            const res = await fetch(`${API_URL}/api/admin/settings`, {
                method: 'POST',
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    gemini_api_key: geminiKeyInput, 
                    groq_api_key: groqKeyInput,
                    active_ai_provider: provider,
                    gemini_model: geminiModel,
                    groq_model: groqModel
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Failed to switch active provider");
            setAdminMsg(`Active AI Engine switched to ${provider === 'gemini' ? 'Google Gemini' : 'Groq Vision'}`);
            fetchAdminData();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleSaveProviderConfig = async (providerToSave) => {
        setSavingConfig(true);
        setAdminMsg('');
        try {
            const res = await fetch(`${API_URL}/api/admin/settings`, {
                method: 'POST',
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    gemini_api_key: geminiKeyInput, 
                    groq_api_key: groqKeyInput,
                    active_ai_provider: activeAiProvider,
                    gemini_model: geminiModel,
                    groq_model: groqModel
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Failed to save configuration");
            setAdminMsg(`${providerToSave === 'gemini' ? 'Google Gemini' : 'Groq Vision'} configuration saved successfully!`);
            setConfigModal(null);
            fetchAdminData();
        } catch (err) {
            alert(err.message);
        }
        setSavingConfig(false);
    };

    // Calculate aggregated metrics
    const totalTokensUsed = adminLogs.reduce((acc, log) => acc + (log.total_tokens || 0), 0);
    const totalCostEstimated = adminLogs.reduce((acc, log) => acc + (log.estimated_cost || 0), 0);
    const totalAiPages = adminLogs.reduce((acc, log) => acc + (log.pages_count || 0), 0);

    return (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
            
            {/* Header & Sub-Nav */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-md">
                        <ShieldCheck className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-black text-slate-900 tracking-tight">Super Admin Command Center</h2>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">Root Access</span>
                        </div>
                        <p className="text-xs text-slate-500">Manage team members, inspect extraction token consumption, and configure AI vision models.</p>
                    </div>
                </div>

                {/* Sub Navigation Tabs */}
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button 
                        onClick={() => setAdminSubTab('users')} 
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                            adminSubTab === 'users' ? 'bg-white text-indigo-700 shadow-sm font-extrabold' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Users className="w-3.5 h-3.5" />
                        <span>Users ({usersList.length})</span>
                    </button>

                    <button 
                        onClick={() => setAdminSubTab('logs')} 
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                            adminSubTab === 'logs' ? 'bg-white text-indigo-700 shadow-sm font-extrabold' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>Token &amp; Cost Audit</span>
                    </button>

                    <button 
                        onClick={() => setAdminSubTab('settings')} 
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                            adminSubTab === 'settings' ? 'bg-white text-indigo-700 shadow-sm font-extrabold' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Cpu className="w-3.5 h-3.5" />
                        <span>AI Engine Settings</span>
                    </button>
                </div>
            </div>

            {adminMsg && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between animate-fade-in">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>{adminMsg}</span>
                    </div>
                    <button onClick={() => setAdminMsg('')} className="text-emerald-700 hover:text-emerald-900">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* TAB 1: USER MANAGEMENT */}
            {adminSubTab === 'users' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* Add User Form */}
                    <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                        <div className="flex items-center gap-2">
                            <UserPlus className="w-4 h-4 text-indigo-600" />
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Add Team Member</h3>
                        </div>

                        <form onSubmit={handleAddUser} className="space-y-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Full Name</label>
                                <input 
                                    type="text" 
                                    required 
                                    placeholder="e.g. Rahul Sharma" 
                                    value={newUserName} 
                                    onChange={e => setNewUserName(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 outline-none focus:border-indigo-600" 
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Username / ID</label>
                                <input 
                                    type="text" 
                                    required 
                                    placeholder="e.g. rahul_editor" 
                                    value={newUserUsername} 
                                    onChange={e => setNewUserUsername(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 outline-none focus:border-indigo-600" 
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Initial Password</label>
                                <input 
                                    type="password" 
                                    required 
                                    placeholder="••••••••" 
                                    value={newUserPassword} 
                                    onChange={e => setNewUserPassword(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 outline-none focus:border-indigo-600" 
                                />
                            </div>

                            <button 
                                type="submit" 
                                className="w-full mt-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow transition"
                            >
                                Create Member Account
                            </button>
                        </form>
                    </div>

                    {/* Users List Table */}
                    <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
                        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <span className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                                Active Team Accounts ({usersList.length})
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase border-b">
                                    <tr>
                                        <th className="px-5 py-3">Member Name</th>
                                        <th className="px-5 py-3">Username</th>
                                        <th className="px-5 py-3">Role</th>
                                        <th className="px-5 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {usersList.map(u => (
                                        <tr key={u.id} className="hover:bg-slate-50/80 transition">
                                            <td className="px-5 py-3 font-bold text-slate-800">{u.name}</td>
                                            <td className="px-5 py-3 font-mono text-slate-600 text-[11px]">{u.username}</td>
                                            <td className="px-5 py-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                    u.role === 'super_admin' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                                                }`}>
                                                    {u.role === 'super_admin' ? 'Super Admin' : 'Operator'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                {u.role !== 'super_admin' ? (
                                                    <div className="flex justify-end gap-2">
                                                        <button 
                                                            onClick={() => setResetPasswordModal(u)} 
                                                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition" 
                                                            title="Reset Password"
                                                        >
                                                            <Key className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteUser(u.id)} 
                                                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition" 
                                                            title="Delete User"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400 italic">Protected</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            )}

            {/* TAB 2: AUDIT LOGS & METRICS */}
            {adminSubTab === 'logs' && (
                <div className="space-y-6">
                    
                    {/* Metrics Overview Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total AI Extractions</span>
                            <div className="text-xl font-black text-slate-800">{adminLogs.length}</div>
                            <span className="text-[11px] text-slate-500">Processed jobs</span>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">AI Pages Processed</span>
                            <div className="text-xl font-black text-indigo-600">{totalAiPages}</div>
                            <span className="text-[11px] text-slate-500">Vision scanned pages</span>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Tokens Consumed</span>
                            <div className="text-xl font-black text-slate-800">{totalTokensUsed.toLocaleString()}</div>
                            <span className="text-[11px] text-slate-500">Prompt &amp; Completion tokens</span>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estimated API Cost</span>
                            <div className="text-xl font-black text-emerald-600">${totalCostEstimated.toFixed(4)}</div>
                            <span className="text-[11px] text-slate-500">Estimated API billing</span>
                        </div>
                    </div>

                    {/* Table Card */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
                        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Receipt className="w-4 h-4 text-indigo-600" />
                                <span className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                                    Token &amp; Cost Audit Trail
                                </span>
                            </div>

                            <button 
                                onClick={exportLogsExcel}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 transition flex items-center gap-1.5 shadow-sm"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span>Export CSV</span>
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase border-b">
                                    <tr>
                                        <th className="px-4 py-3">Timestamp</th>
                                        <th className="px-4 py-3">User</th>
                                        <th className="px-4 py-3">Document</th>
                                        <th className="px-4 py-3">Model</th>
                                        <th className="px-4 py-3">Pages</th>
                                        <th className="px-4 py-3">Input</th>
                                        <th className="px-4 py-3">Output</th>
                                        <th className="px-4 py-3 font-bold text-indigo-600">Total Tokens</th>
                                        <th className="px-4 py-3 font-bold text-emerald-600">Est. Cost</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {adminLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="p-8 text-center text-slate-400">
                                                No AI vision extractions recorded yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        adminLogs.map(log => (
                                            <tr key={log.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-3 text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                                                <td className="px-4 py-3 font-bold text-slate-800">{log.user_name}</td>
                                                <td className="px-4 py-3 text-slate-600 truncate max-w-xs">{log.pdf_name}</td>
                                                <td className="px-4 py-3 font-mono text-[11px] text-slate-600">{log.model_used || "gemini-2.5-flash-lite"}</td>
                                                <td className="px-4 py-3 text-slate-700 font-semibold">{log.pages_count}</td>
                                                <td className="px-4 py-3 text-slate-500">{log.input_tokens.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-slate-500">{log.output_tokens.toLocaleString()}</td>
                                                <td className="px-4 py-3 font-black text-indigo-600">{log.total_tokens.toLocaleString()}</td>
                                                <td className="px-4 py-3 font-bold text-emerald-600">${log.estimated_cost.toFixed(5)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            )}

            {/* TAB 3: AI PROVIDER SETTINGS & MODEL SANDBOX */}
            {adminSubTab === 'settings' && (
                <div className="space-y-6">
                    
                    {/* Providers Config Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* Gemini Card */}
                        <div className={`p-5 rounded-2xl border transition-all ${
                            activeAiProvider === 'gemini' 
                                ? 'bg-white border-indigo-300 ring-2 ring-indigo-100 shadow-md' 
                                : 'bg-white border-slate-200'
                        }`}>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
                                        G
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-900">Google Gemini</h4>
                                        <p className="text-xs text-slate-500 font-mono">{geminiModel || 'gemini-2.5-flash-lite'}</p>
                                    </div>
                                </div>

                                <button 
                                    type="button" 
                                    onClick={() => handleSetActiveProvider('gemini')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border flex items-center gap-1.5 ${
                                        activeAiProvider === 'gemini' 
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    <span className={`w-2 h-2 rounded-full ${activeAiProvider === 'gemini' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
                                    <span>{activeAiProvider === 'gemini' ? 'Active Engine' : 'Set Active'}</span>
                                </button>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                <span className="text-xs text-slate-500">
                                    Status: {geminiStatus?.gemini_configured ? (
                                        <strong className="text-emerald-600">Configured ({geminiStatus.gemini_preview})</strong>
                                    ) : (
                                        <strong className="text-amber-600">Key Not Set</strong>
                                    )}
                                </span>

                                <button 
                                    onClick={() => setConfigModal('gemini')}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1"
                                >
                                    <Settings className="w-3.5 h-3.5" />
                                    <span>Configure</span>
                                </button>
                            </div>
                        </div>

                        {/* Groq Card */}
                        <div className={`p-5 rounded-2xl border transition-all ${
                            activeAiProvider === 'groq' 
                                ? 'bg-white border-orange-300 ring-2 ring-orange-100 shadow-md' 
                                : 'bg-white border-slate-200'
                        }`}>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-lg">
                                        ⚡
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-900">Groq Vision</h4>
                                        <p className="text-xs text-slate-500 font-mono truncate max-w-xs">{groqModel || 'meta-models/muse-spark-open'}</p>
                                    </div>
                                </div>

                                <button 
                                    type="button" 
                                    onClick={() => handleSetActiveProvider('groq')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border flex items-center gap-1.5 ${
                                        activeAiProvider === 'groq' 
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    <span className={`w-2 h-2 rounded-full ${activeAiProvider === 'groq' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
                                    <span>{activeAiProvider === 'groq' ? 'Active Engine' : 'Set Active'}</span>
                                </button>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                <span className="text-xs text-slate-500">
                                    Status: {geminiStatus?.groq_configured ? (
                                        <strong className="text-emerald-600">Configured ({geminiStatus.groq_preview})</strong>
                                    ) : (
                                        <strong className="text-amber-600">Key Not Set</strong>
                                    )}
                                </span>

                                <button 
                                    onClick={() => setConfigModal('groq')}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1"
                                >
                                    <Settings className="w-3.5 h-3.5" />
                                    <span>Configure</span>
                                </button>
                            </div>
                        </div>

                    </div>

                    {/* Model API Sandbox */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
                        <div className="flex items-center gap-2">
                            <FlaskConical className="w-5 h-5 text-indigo-600" />
                            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                                Live Model API Sandbox &amp; Playground
                            </h3>
                        </div>

                        <p className="text-xs text-slate-500">
                            Upload a sample question snippet or page diagram to test prompt extraction against the active AI model in real time.
                        </p>

                        <form onSubmit={handleSandboxTest} className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                            <div className="sm:col-span-6">
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Upload Sample Image / PDF</label>
                                <input 
                                    type="file" 
                                    accept="image/*,.pdf" 
                                    onChange={e => setSandboxFile(e.target.files ? e.target.files[0] : null)} 
                                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 outline-none" 
                                    required 
                                />
                            </div>

                            <div className="sm:col-span-3">
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Extraction Target</label>
                                <select 
                                    value={sandboxMode} 
                                    onChange={e => setSandboxMode(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 outline-none font-bold"
                                >
                                    <option value="questions">Questions + Options</option>
                                    <option value="solutions">Solutions + Explanations</option>
                                </select>
                            </div>

                            <div className="sm:col-span-3 flex items-end">
                                <button 
                                    type="submit" 
                                    disabled={sandboxLoading} 
                                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow transition disabled:opacity-50"
                                >
                                    {sandboxLoading ? 'Querying Model...' : 'Run Test Query'}
                                </button>
                            </div>
                        </form>

                        {sandboxResult && (
                            <div className="mt-4 bg-slate-950 rounded-2xl p-4 text-emerald-400 text-xs font-mono border border-slate-800 max-h-80 overflow-auto">
                                <div className="text-slate-400 mb-2 border-b border-slate-800 pb-2 flex justify-between">
                                    <span>Tokens: {sandboxResult.tokens?.total || 0}</span>
                                    <span>In: {sandboxResult.tokens?.input || 0} | Out: {sandboxResult.tokens?.output || 0}</span>
                                </div>
                                <pre>{JSON.stringify(sandboxResult.data, null, 2)}</pre>
                            </div>
                        )}
                    </div>

                </div>
            )}

            {/* CONFIG MODAL */}
            {configModal && (
                <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-fade-in">
                        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <h4 className="text-sm font-bold text-slate-800">
                                Configure {configModal === 'gemini' ? 'Google Gemini' : 'Groq Vision'}
                            </h4>
                            <button onClick={() => setConfigModal(null)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={(e) => { e.preventDefault(); handleSaveProviderConfig(configModal); }} className="p-5 space-y-4">
                            {configModal === 'gemini' ? (
                                <>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Gemini API Key</label>
                                        <div className="relative">
                                            <input 
                                                type={showGeminiKey ? "text" : "password"} 
                                                placeholder="AIzaSy..." 
                                                value={geminiKeyInput} 
                                                onChange={e => setGeminiKeyInput(e.target.value)} 
                                                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 pr-10 text-xs outline-none focus:border-indigo-600 font-mono" 
                                                required
                                            />
                                            <button 
                                                type="button" 
                                                onClick={() => setShowGeminiKey(!showGeminiKey)} 
                                                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                                            >
                                                {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Gemini Model</label>
                                            <button type="button" onClick={fetchModels} className="text-[10px] font-bold text-indigo-600 hover:underline">
                                                {loadingModels ? 'Fetching...' : 'Fetch Live Models'}
                                            </button>
                                        </div>
                                        <select 
                                            value={geminiModel} 
                                            onChange={e => setGeminiModel(e.target.value)} 
                                            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs outline-none focus:border-indigo-600 font-mono"
                                        >
                                            <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite (Fast &amp; Accurate)</option>
                                            <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                                            <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                                            <option value="gemini-2.0-flash-exp">gemini-2.0-flash-exp</option>
                                            {models.filter(m => !['gemini-2.5-flash-lite','gemini-2.5-flash','gemini-2.5-pro','gemini-2.0-flash-exp'].includes(m.name)).map(m => (
                                                <option key={m.name} value={m.name}>{m.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Groq API Key</label>
                                        <div className="relative">
                                            <input 
                                                type={showGroqKey ? "text" : "password"} 
                                                placeholder="gsk_..." 
                                                value={groqKeyInput} 
                                                onChange={e => setGroqKeyInput(e.target.value)} 
                                                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 pr-10 text-xs outline-none focus:border-orange-500 font-mono" 
                                                required
                                            />
                                            <button 
                                                type="button" 
                                                onClick={() => setShowGroqKey(!showGroqKey)} 
                                                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                                            >
                                                {showGroqKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Groq Model</label>
                                            <button type="button" onClick={fetchGroqModels} className="text-[10px] font-bold text-orange-600 hover:underline">
                                                {loadingGroqModels ? 'Fetching...' : 'Fetch Live Models'}
                                            </button>
                                        </div>
                                        <select 
                                            value={groqModel} 
                                            onChange={e => setGroqModel(e.target.value)} 
                                            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs outline-none focus:border-orange-500 font-mono"
                                        >
                                            <option value="meta-models/muse-spark-open">meta-models/muse-spark-open (Meta Muse Spark MoE 816B)</option>
                                            <option value="qwen/qwen3.8-27b">qwen/qwen3.8-27b (Qwen 3.8 27B Vision)</option>
                                            <option value="llama-3.2-11b-vision-preview">llama-3.2-11b-vision-preview (Llama 3.2 11B Vision)</option>
                                            <option value="llama-3.2-90b-vision-preview">llama-3.2-90b-vision-preview (Llama 3.2 90B Vision)</option>
                                            {groqModels.filter(m => !['meta-models/muse-spark-open', 'qwen/qwen3.8-27b', 'llama-3.2-11b-vision-preview', 'llama-3.2-90b-vision-preview'].includes(m.name)).map(m => (
                                                <option key={m.name} value={m.name}>{m.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </>
                            )}

                            <div className="pt-2 flex gap-2">
                                <button 
                                    type="button" 
                                    onClick={() => setConfigModal(null)} 
                                    className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={savingConfig} 
                                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow"
                                >
                                    {savingConfig ? 'Saving...' : 'Save Settings'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* PASSWORD RESET MODAL */}
            {resetPasswordModal && (
                <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-fade-in">
                        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <h4 className="text-sm font-bold text-slate-800">
                                Reset Password for {resetPasswordModal.username}
                            </h4>
                            <button onClick={() => setResetPasswordModal(null)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleResetPassword} className="p-5 space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">New Password</label>
                                <input 
                                    type="password" 
                                    required 
                                    placeholder="••••••••" 
                                    value={newPassword} 
                                    onChange={e => setNewPassword(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 outline-none focus:border-indigo-600" 
                                />
                            </div>

                            <div className="pt-2 flex gap-2">
                                <button 
                                    type="button" 
                                    onClick={() => setResetPasswordModal(null)} 
                                    className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow"
                                >
                                    Update Password
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
