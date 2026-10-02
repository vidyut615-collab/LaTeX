// @ts-nocheck
"use client";

import React, { useState, useEffect } from 'react';
import { API_URL, authHeaders } from '@/utils/api';

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
    const [groqModel, setGroqModel] = useState('qwen/qwen3.8-27b');
    const [loadingModels, setLoadingModels] = useState(false);
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
            const res = await fetch(`${API_URL}/api/admin/models`, { headers: authHeaders() });
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
            
            // Assume authHeaders gives an object that doesn't conflict with FormData content type
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

    return (
        <div className="w-full max-w-5xl bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col h-full overflow-hidden">
            
            {/* Sub Navigation */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4 shrink-0">
                <div className="flex gap-2">
                    <button onClick={()=>setAdminSubTab('users')} 
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition ${adminSubTab==='users'?'bg-indigo-600 text-white shadow':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        <i className="fa-solid fa-users mr-2"></i>User Management
                    </button>
                    <button onClick={()=>setAdminSubTab('logs')} 
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition ${adminSubTab==='logs'?'bg-indigo-600 text-white shadow':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        <i className="fa-solid fa-receipt mr-2"></i>Token &amp; Dynamic Logs
                    </button>
                    <button onClick={()=>setAdminSubTab('settings')} 
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition ${adminSubTab==='settings'?'bg-indigo-600 text-white shadow':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        <i className="fa-solid fa-microchip mr-2"></i>AI Provider Settings
                    </button>
                </div>
                {adminMsg && <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">{adminMsg}</span>}
            </div>

            {/* TAB 1: USERS */}
            {adminSubTab === 'users' && (
                <div className="grid grid-cols-12 gap-6 flex-1 overflow-hidden">
                    {/* Add User Form */}
                    <div className="col-span-4 bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">Add New User</h4>
                        <form onSubmit={handleAddUser} className="space-y-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Full Name</label>
                                <input type="text" required placeholder="User's Name" value={newUserName} onChange={e=>setNewUserName(e.target.value)} 
                                    className="w-full border rounded p-1.5 text-xs bg-white" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Username / ID</label>
                                <input type="text" required placeholder="User ID" value={newUserUsername} onChange={e=>setNewUserUsername(e.target.value)} 
                                    className="w-full border rounded p-1.5 text-xs bg-white" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Password</label>
                                <input type="password" required placeholder="••••••••" value={newUserPassword} onChange={e=>setNewUserPassword(e.target.value)} 
                                    className="w-full border rounded p-1.5 text-xs bg-white" />
                            </div>
                            <button type="submit" className="w-full py-2 bg-indigo-600 text-white font-bold text-xs rounded hover:bg-indigo-700 shadow transition">
                                Create User
                            </button>
                        </form>
                    </div>

                    {/* Users List Table */}
                    <div className="col-span-8 flex flex-col flex-1 overflow-hidden border border-slate-200 rounded-xl">
                        <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 font-bold text-xs text-slate-700">
                            Active Team Members ({usersList.length})
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase border-b">
                                    <tr>
                                        <th className="px-4 py-2">Name</th>
                                        <th className="px-4 py-2">Username / ID</th>
                                        <th className="px-4 py-2">Role</th>
                                        <th className="px-4 py-2 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {usersList.map(u => (
                                        <tr key={u.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-2.5 font-bold text-slate-800">{u.name}</td>
                                            <td className="px-4 py-2.5 text-slate-600">{u.username}</td>
                                            <td className="px-4 py-2.5">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${u.role==='super_admin'?'bg-amber-100 text-amber-700':'bg-slate-100 text-slate-600'}`}>
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 text-right">
                                                {u.role !== 'super_admin' && (
                                                    <div className="flex justify-end gap-3">
                                                        <button onClick={() => setResetPasswordModal(u)} className="text-indigo-500 hover:text-indigo-700 text-xs" title="Reset Password">
                                                            <i className="fa-solid fa-key"></i>
                                                        </button>
                                                        <button onClick={()=>handleDeleteUser(u.id)} className="text-red-500 hover:text-red-700 text-xs" title="Delete User">
                                                            <i className="fa-solid fa-trash"></i>
                                                        </button>
                                                    </div>
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

            {/* TAB 2: AUDIT LOGS */}
            {adminSubTab === 'logs' && (
                <div className="flex-1 overflow-hidden border border-slate-200 rounded-xl flex flex-col">
                    <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center">
                        <span className="font-bold text-xs text-slate-700">Dynamic AI Token &amp; Cost Audit Trail</span>
                        <span className="text-[11px] text-slate-500">Only AI-processed jobs are recorded</span>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase border-b sticky top-0">
                                <tr>
                                    <th className="px-4 py-2">Timestamp</th>
                                    <th className="px-4 py-2">User</th>
                                    <th className="px-4 py-2">File</th>
                                    <th className="px-4 py-2">Model</th>
                                    <th className="px-4 py-2">AI Pages</th>
                                    <th className="px-4 py-2">In Tokens</th>
                                    <th className="px-4 py-2">Out Tokens</th>
                                    <th className="px-4 py-2">Total Tokens</th>
                                    <th className="px-4 py-2">Est. Cost</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {adminLogs.length === 0 ? (
                                    <tr><td colSpan="9" className="p-8 text-center text-slate-400">No dynamic extractions recorded yet.</td></tr>
                                ) : (
                                    adminLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-2 text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                                            <td className="px-4 py-2 font-bold text-slate-700">{log.user_name}</td>
                                            <td className="px-4 py-2 text-slate-600">{log.pdf_name}</td>
                                            <td className="px-4 py-2 text-slate-500 text-xs">{log.model_used || "gemini-2.0-flash"}</td>
                                            <td className="px-4 py-2 text-slate-700">{log.pages_count}</td>
                                            <td className="px-4 py-2 text-slate-500">{log.input_tokens.toLocaleString()}</td>
                                            <td className="px-4 py-2 text-slate-500">{log.output_tokens.toLocaleString()}</td>
                                            <td className="px-4 py-2 font-bold text-indigo-600">{log.total_tokens.toLocaleString()}</td>
                                            <td className="px-4 py-2 font-bold text-emerald-600">${log.estimated_cost.toFixed(5)}</td>
                                        </tr>
                                    ))
                                )}
                                {adminLogs.length > 0 && (
                                    <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold">
                                        <td colSpan="5" className="px-4 py-3 text-right text-slate-700 uppercase text-[10px]">Grand Total:</td>
                                        <td className="px-4 py-3 text-slate-700">{adminLogs.reduce((acc, log) => acc + log.input_tokens, 0).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-slate-700">{adminLogs.reduce((acc, log) => acc + log.output_tokens, 0).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-indigo-700">{adminLogs.reduce((acc, log) => acc + log.total_tokens, 0).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-emerald-700">${adminLogs.reduce((acc, log) => acc + log.estimated_cost, 0).toFixed(5)}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 3: AI PROVIDER SETTINGS */}
            {adminSubTab === 'settings' && (
                <div className="max-w-xl mx-auto p-6 bg-slate-50 rounded-xl border border-slate-200 w-full mt-4 flex-1 overflow-y-auto">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center text-lg">
                            <i className="fa-solid fa-microchip"></i>
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-slate-800">Global AI Provider Configuration</h4>
                            <p className="text-xs text-slate-500">Only Super Admins can manage these keys. Choose between Gemini or Groq.</p>
                        </div>
                    </div>

                    {/* Two Provider Rows */}
                    <div className="space-y-3 mb-6">
                        {/* Google Gemini Row */}
                        <div className={`p-4 rounded-xl border transition-all flex items-center justify-between ${activeAiProvider === 'gemini' ? 'bg-white border-indigo-300 shadow-sm ring-1 ring-indigo-200' : 'bg-white/70 border-slate-200 hover:border-slate-300'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${activeAiProvider === 'gemini' ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200' : 'bg-slate-100 text-slate-500'}`}>
                                    <i className="fa-brands fa-google"></i>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h5 className="text-sm font-bold text-slate-800">Google Gemini</h5>
                                        {geminiStatus && geminiStatus.gemini_configured ? (
                                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                                <i className="fa-solid fa-circle-check mr-1"></i>Key Added ({geminiStatus.gemini_preview})
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                                <i className="fa-solid fa-circle-exclamation mr-1"></i>No Key
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-0.5">Model: <span className="font-mono font-medium text-slate-700">{geminiModel || 'gemini-2.5-flash-lite'}</span></p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {/* Active / Inactive Toggle Switch */}
                                <button 
                                    type="button" 
                                    onClick={() => handleSetActiveProvider('gemini')}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition border ${activeAiProvider === 'gemini' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-xs' : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600 hover:bg-slate-100'}`}
                                >
                                    <span className={`w-2 h-2 rounded-full ${activeAiProvider === 'gemini' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
                                    {activeAiProvider === 'gemini' ? 'Active' : 'Set Active'}
                                </button>

                                {/* Configure Button */}
                                <button 
                                    type="button" 
                                    onClick={() => setConfigModal('gemini')} 
                                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                                >
                                    <i className="fa-solid fa-gear text-slate-500"></i> Configure
                                </button>
                            </div>
                        </div>

                        {/* Groq Vision Row */}
                        <div className={`p-4 rounded-xl border transition-all flex items-center justify-between ${activeAiProvider === 'groq' ? 'bg-white border-orange-300 shadow-sm ring-1 ring-orange-200' : 'bg-white/70 border-slate-200 hover:border-slate-300'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${activeAiProvider === 'groq' ? 'bg-orange-500 text-white shadow-sm shadow-orange-200' : 'bg-slate-100 text-slate-500'}`}>
                                    <i className="fa-solid fa-bolt"></i>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h5 className="text-sm font-bold text-slate-800">Groq Vision</h5>
                                        {geminiStatus && geminiStatus.groq_configured ? (
                                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                                <i className="fa-solid fa-circle-check mr-1"></i>Key Added ({geminiStatus.groq_preview})
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                                <i className="fa-solid fa-circle-exclamation mr-1"></i>No Key
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-0.5">Model: <span className="font-mono font-medium text-slate-700">qwen/qwen3.8-27b</span></p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {/* Active / Inactive Toggle Switch */}
                                <button 
                                    type="button" 
                                    onClick={() => handleSetActiveProvider('groq')}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition border ${activeAiProvider === 'groq' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-xs' : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600 hover:bg-slate-100'}`}
                                >
                                    <span className={`w-2 h-2 rounded-full ${activeAiProvider === 'groq' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
                                    {activeAiProvider === 'groq' ? 'Active' : 'Set Active'}
                                </button>

                                {/* Configure Button */}
                                <button 
                                    type="button" 
                                    onClick={() => setConfigModal('groq')} 
                                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                                >
                                    <i className="fa-solid fa-gear text-slate-500"></i> Configure
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* POPUP MODAL FOR CONFIGURATION */}
                    {configModal && (
                        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-fade-in">
                                {/* Modal Header */}
                                <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                                    <div className="flex items-center gap-2.5">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${configModal === 'gemini' ? 'bg-indigo-100 text-indigo-600' : 'bg-orange-100 text-orange-600'}`}>
                                            <i className={`fa-solid ${configModal === 'gemini' ? 'fa-brands fa-google' : 'fa-bolt'}`}></i>
                                        </div>
                                        <h4 className="text-sm font-bold text-slate-800">
                                            Configure {configModal === 'gemini' ? 'Google Gemini' : 'Groq Vision'}
                                        </h4>
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={() => setConfigModal(null)} 
                                        className="text-slate-400 hover:text-slate-600 text-sm p-1 rounded-lg hover:bg-slate-200/50"
                                    >
                                        <i className="fa-solid fa-xmark"></i>
                                    </button>
                                </div>

                                {/* Modal Body */}
                                <form onSubmit={(e) => { e.preventDefault(); handleSaveProviderConfig(configModal); }} className="p-5 space-y-4">
                                    {configModal === 'gemini' ? (
                                        <React.Fragment>
                                            <div>
                                                <div className="flex justify-between items-center mb-1">
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Gemini API Key</label>
                                                    {geminiStatus && geminiStatus.gemini_configured && (
                                                        <span className="text-[10px] font-semibold text-emerald-600">Saved: {geminiStatus.gemini_preview}</span>
                                                    )}
                                                </div>
                                                <div className="relative">
                                                    <input 
                                                        type={showGeminiKey ? "text" : "password"} 
                                                        placeholder="AIzaSy..." 
                                                        value={geminiKeyInput} 
                                                        onChange={e=>setGeminiKeyInput(e.target.value)} 
                                                        className="w-full border border-slate-300 bg-white rounded-lg p-2.5 pr-10 text-sm outline-none focus:border-indigo-500" 
                                                        required
                                                    />
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setShowGeminiKey(!showGeminiKey)} 
                                                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                                                    >
                                                        <i className={`fa-solid ${showGeminiKey ? 'fa-eye-slash' : 'fa-eye'}`}></i>
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
                                                    onChange={e=>setGeminiModel(e.target.value)} 
                                                    className="w-full border border-slate-300 bg-white rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500"
                                                >
                                                    <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite</option>
                                                    <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                                                    <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                                                    <option value="gemini-2.0-flash-exp">gemini-2.0-flash-exp</option>
                                                    {models.filter(m => !['gemini-2.5-flash-lite','gemini-2.5-flash','gemini-2.5-pro','gemini-2.0-flash-exp'].includes(m.name)).map(m => (
                                                        <option key={m.name} value={m.name}>{m.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </React.Fragment>
                                    ) : (
                                        <React.Fragment>
                                            <div>
                                                <div className="flex justify-between items-center mb-1">
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Groq API Key</label>
                                                    {geminiStatus && geminiStatus.groq_configured && (
                                                        <span className="text-[10px] font-semibold text-emerald-600">Saved: {geminiStatus.groq_preview}</span>
                                                    )}
                                                </div>
                                                <div className="relative">
                                                    <input 
                                                        type={showGroqKey ? "text" : "password"} 
                                                        placeholder="gsk_..." 
                                                        value={groqKeyInput} 
                                                        onChange={e=>setGroqKeyInput(e.target.value)} 
                                                        className="w-full border border-slate-300 bg-white rounded-lg p-2.5 pr-10 text-sm outline-none focus:border-orange-500" 
                                                        required
                                                    />
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setShowGroqKey(!showGroqKey)} 
                                                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                                                    >
                                                        <i className={`fa-solid ${showGroqKey ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                                    </button>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Vision Model</label>
                                                <input 
                                                    type="text" 
                                                    value="qwen/qwen3.8-27b" 
                                                    readOnly 
                                                    className="w-full border border-slate-200 bg-slate-100 text-slate-700 rounded-lg p-2.5 text-sm font-mono cursor-not-allowed outline-none"
                                                />
                                                <p className="text-[10px] text-slate-400 mt-1">Configured strictly for Groq Vision: <code>qwen/qwen3.8-27b</code></p>
                                            </div>
                                        </React.Fragment>
                                    )}

                                    <div className="pt-2 flex gap-2">
                                        <button 
                                            type="button" 
                                            onClick={() => setConfigModal(null)} 
                                            className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-bold text-xs rounded-lg hover:bg-slate-50 transition"
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            type="submit" 
                                            disabled={savingConfig} 
                                            className={`flex-1 py-2.5 text-white font-bold text-xs rounded-lg shadow transition ${configModal === 'gemini' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-orange-500 hover:bg-orange-600'}`}
                                        >
                                            {savingConfig ? 'Saving...' : 'Save Configuration'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                    
                {/* Sandbox Tester */}
                <div className="mt-8 bg-slate-50 rounded-xl border border-slate-200 p-6 shadow-inner">
                    <h3 className="text-md font-bold text-slate-800 mb-2"><i className="fa-solid fa-flask text-indigo-500 mr-2"></i> Model API Sandbox</h3>
                    <p className="text-xs text-slate-500 mb-4">Test your selected model instantly. Upload an image, choose a mode, and see the raw JSON output. No logs are saved.</p>
                    
                    <form onSubmit={handleSandboxTest} className="space-y-4">
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Image File</label>
                                <input type="file" accept="image/*,.pdf" onChange={e => setSandboxFile(e.target.files[0])} className="w-full mt-1 border border-slate-300 bg-white rounded-lg p-2 text-sm outline-none" required />
                            </div>
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Extract Mode</label>
                                <select value={sandboxMode} onChange={e=>setSandboxMode(e.target.value)} className="w-full mt-1 border border-slate-300 bg-white rounded-lg p-2 text-sm outline-none">
                                    <option value="questions">Questions</option>
                                    <option value="solutions">Solutions / Explanations</option>
                                </select>
                            </div>
                        </div>
                        <button type="submit" disabled={sandboxLoading} className="w-full py-2 bg-slate-800 text-white font-bold text-xs rounded-lg hover:bg-slate-700 transition disabled:opacity-50">
                            {sandboxLoading ? 'Testing API...' : 'Test Selected Model'}
                        </button>
                    </form>
                    
                    {sandboxResult && (
                        <div className="mt-4 bg-slate-900 rounded-lg p-4 text-emerald-400 text-[10px] overflow-auto max-h-64 font-mono shadow-inner border border-slate-700">
                            <div className="text-slate-400 mb-2 border-b border-slate-700 pb-2">
                                Tokens Used: {sandboxResult.tokens.total} (In: {sandboxResult.tokens.input} | Out: {sandboxResult.tokens.output})
                            </div>
                            <pre>{JSON.stringify(sandboxResult.data, null, 2)}</pre>
                        </div>
                    )}
                </div>
                </div>
            )}

            {/* PASSWORD RESET MODAL */}
            {resetPasswordModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-fade-in">
                        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm">
                                    <i className="fa-solid fa-key"></i>
                                </div>
                                <h4 className="text-sm font-bold text-slate-800">
                                    Reset Password for {resetPasswordModal.username}
                                </h4>
                            </div>
                            <button 
                                type="button" 
                                onClick={() => {
                                    setResetPasswordModal(null);
                                    setNewPassword('');
                                }}
                                className="text-slate-400 hover:text-slate-600 text-sm p-1 rounded-lg hover:bg-slate-200/50"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <form onSubmit={handleResetPassword} className="p-5 space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">New Password</label>
                                <input type="password" required placeholder="••••••••" value={newPassword} onChange={e=>setNewPassword(e.target.value)} 
                                    className="w-full mt-1 border border-slate-300 rounded-lg p-2.5 text-sm bg-white" />
                            </div>
                            <div className="pt-2 flex gap-2">
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setResetPasswordModal(null);
                                        setNewPassword('');
                                    }}
                                    className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-bold text-xs rounded-lg hover:bg-slate-50 transition"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="flex-1 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-lg shadow hover:bg-indigo-700 transition"
                                >
                                    Reset Password
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
