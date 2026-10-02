// @ts-nocheck
"use client";

import React, { useState } from 'react';
import { API_URL, authHeaders } from '@/utils/api';

export default function ExtractorPage() {
    // Extractor States
    const [file, setFile] = useState(null);
    const [qStart, setQStart] = useState(26);
    const [qEnd, setQEnd] = useState(32);
    const [sStart, setSStart] = useState(32);
    const [sEnd, setSEnd] = useState(40);
    const [qStartKeyword, setQStartKeyword] = useState('Exercise');
    const [sStartKeyword, setSStartKeyword] = useState('Solutions');
    const [qIndexStart, setQIndexStart] = useState(1);
    const [qIndexEnd, setQIndexEnd] = useState(50);
    const [sIndexStart, setSIndexStart] = useState(1);
    const [sIndexEnd, setSIndexEnd] = useState(50);
    const [engine, setEngine] = useState('python');
    const [topMargin, setTopMargin] = useState(0);
    const [bottomMargin, setBottomMargin] = useState(0);
    const [qStartTop, setQStartTop] = useState(0);
    const [qEndBottom, setQEndBottom] = useState(0);
    const [sStartTop, setSStartTop] = useState(0);
    const [sEndBottom, setSEndBottom] = useState(0);
    const [activeCropMode, setActiveCropMode] = useState('global');
    const [columns, setColumns] = useState(1);
    const [showMarginModal, setShowMarginModal] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [previewDataEnd, setPreviewDataEnd] = useState(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [draggingLine, setDraggingLine] = useState(null);
    const [subject, setSubject] = useState('Maths > Quantitative > Average');
    const [marks, setMarks] = useState(2.0);
    const [negative, setNegative] = useState(0.6);
    const [difficulty, setDifficulty] = useState('Medium');
    const [qType, setQType] = useState('Single');
    const isSubjectValid = subject && !subject.startsWith(' ') && !subject.endsWith(' ') && !subject.includes('  >') && !subject.includes('>  ') && (subject.match(/>/g) || []).length === (subject.match(/ > /g) || []).length;

    const [isValidating, setIsValidating] = useState(false);
    const [validationResult, setValidationResult] = useState(null);
    const [filePath, setFilePath] = useState('');
    const [isExtracting, setIsExtracting] = useState(false);
    const [downloadFiles, setDownloadFiles] = useState(null);
    const [jobProgress, setJobProgress] = useState(null);

    // Extractor Logic
    const handleFile = (e) => {
        setFile(e.target.files[0]);
        setValidationResult(null);
        setDownloadFiles(null);
        setJobProgress(null);
    };

    const loadPagePreview = async (pageNum, pageNumEnd = null) => {
        if (!file) return;
        setLoadingPreview(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("page_num", pageNum);
            const p1 = fetch(`${API_URL}/api/extract/preview-page`, {
                method: "POST", headers: authHeaders(), body: formData
            }).then(r => r.json());
            
            let p2 = null;
            if (pageNumEnd) {
                const fd2 = new FormData();
                fd2.append("file", file);
                fd2.append("page_num", pageNumEnd);
                p2 = fetch(`${API_URL}/api/extract/preview-page`, {
                    method: "POST", headers: authHeaders(), body: fd2
                }).then(r => r.json());
            }

            const [data1, data2] = await Promise.all([p1, p2]);
            if (data1.detail) throw new Error(data1.detail);
            setPreviewData(data1);
            if (data2) {
                if (data2.detail) throw new Error(data2.detail);
                setPreviewDataEnd(data2);
            } else {
                setPreviewDataEnd(null);
            }
        } catch (err) {
            alert("Preview Error: " + err.message);
        }
        setLoadingPreview(false);
    };

    const openMarginModal = (mode = 'global', startPage = null, endPage = null) => {
        if (!file) return alert("Please upload a PDF file first.");
        setActiveCropMode(mode);
        setShowMarginModal(true);
        loadPagePreview(startPage || qStart, endPage);
    };

    const runPreFlightCheck = async () => {
        if (!file) return alert("Please upload a PDF first.");
        setIsValidating(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("q_start", qStart);
        formData.append("q_end", qEnd);
        formData.append("s_start", sStart);
        formData.append("s_end", sEnd);
        formData.append("q_start_top", qStartTop);
        formData.append("q_end_bottom", qEndBottom);
        formData.append("s_start_top", sStartTop);
        formData.append("s_end_bottom", sEndBottom);
        formData.append("q_index_start", qIndexStart);
        formData.append("q_index_end", qIndexEnd);
        formData.append("s_index_start", sIndexStart);
        formData.append("s_index_end", sIndexEnd);
        formData.append("top_margin_pct", topMargin);
        formData.append("bottom_margin_pct", bottomMargin);
        formData.append("columns", columns);
        
        try {
            const res = await fetch(`${API_URL}/api/validate`, { method: "POST", headers: authHeaders(), body: formData });
            if (!res.ok) throw new Error("Validation check failed.");
            const data = await res.json();
            setValidationResult(data);
            setFilePath(data.file_path);
        } catch (err) {
            alert("Validation Error: " + err.message);
        }
        setIsValidating(false);
    };

    const startExtraction = async () => {
        setIsExtracting(true);
        setDownloadFiles(null);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("q_start", qStart);
        formData.append("q_end", qEnd);
        formData.append("s_start", sStart);
        formData.append("s_end", sEnd);
        formData.append("q_start_top", qStartTop);
        formData.append("q_end_bottom", qEndBottom);
        formData.append("s_start_top", sStartTop);
        formData.append("s_end_bottom", sEndBottom);
        formData.append("q_index_start", qIndexStart);
        formData.append("q_index_end", qIndexEnd);
        formData.append("s_index_start", sIndexStart);
        formData.append("s_index_end", sIndexEnd);
        formData.append("engine", engine);
        formData.append("subject", subject);
        formData.append("marks", marks);
        formData.append("negative", negative);
        formData.append("difficulty", difficulty);
        formData.append("q_type", qType);
        formData.append("top_margin_pct", topMargin);
        formData.append("bottom_margin_pct", bottomMargin);
        formData.append("columns", columns);

        const jobId = crypto.randomUUID();
        formData.append("job_id", jobId);

        setJobProgress(null);
        let pollInterval = setInterval(async () => {
            try {
                const statusRes = await fetch(`${API_URL}/api/status/${jobId}`);
                if (statusRes.ok) {
                    const statusData = await statusRes.json();
                    if (statusData.status === "processing" || statusData.status === "done") {
                        setJobProgress(statusData);
                    }
                    if (statusData.status === "done") clearInterval(pollInterval);
                }
            } catch(e) {}
        }, 1000);

        try {
            const res = await fetch(`${API_URL}/api/extract`, { method: "POST", headers: authHeaders(), body: formData });
            const data = await res.json();
            clearInterval(pollInterval);
            if (!res.ok) throw new Error(data.detail || "Extraction failed.");
            setDownloadFiles(data.files);
            setJobProgress(prev => {
                const tot = prev?.total || 1;
                return { status: "done", current: tot, total: tot, phase: "Complete!" };
            });
        } catch (err) {
            clearInterval(pollInterval);
            setJobProgress(null);
            alert(err.message);
        }
        setIsExtracting(false);
    };

    const downloadBase64 = (base64Data, fileName, mimeType) => {
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {type: mimeType});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="w-full max-w-[1400px] w-full grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12 items-start">
            {/* Left Panel */}
            <div className="col-span-1 lg:col-span-3 flex flex-col gap-4">
                
                {/* Upload Block */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm shrink-0">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">1. Upload Document</h3>
                    <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 p-2 rounded-lg">
                        <i className="fa-solid fa-file-pdf text-2xl text-indigo-400 pl-2"></i>
                        <input type="file" accept=".pdf" onChange={handleFile} 
                            className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:font-semibold file:bg-white file:text-indigo-600 file:shadow-sm cursor-pointer" />
                    </div>
                </div>

                {/* Engine Block */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm shrink-0">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">2. Extraction Engine</h3>
                    <select value={engine} onChange={e => setEngine(e.target.value)} className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 text-sm outline-none focus:border-indigo-500 transition">
                        <option value="dynamic">🚀 Dynamic (Gemini 2.0 Flash + Pure Python)</option>
                        <option value="python">⚡ Pure Python (Fastest, Plain Text Only)</option>
                    </select>
                </div>

                {/* Metadata Block */}
                <div className={`bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex-1 flex flex-col ${validationResult ? '' : 'opacity-40 pointer-events-none transition-opacity'}`}>
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">4. Excel Metadata</h3>
                    <div className="grid grid-cols-2 gap-3 flex-1">
                        <div className="col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">LMS Subject Path</label>
                            <input type="text" value={subject} onChange={e=>setSubject(e.target.value)} className={`w-full bg-slate-50 border rounded p-1.5 text-sm outline-none ${isSubjectValid ? 'border-slate-200 focus:border-indigo-500' : 'border-red-500 focus:border-red-600 shadow-[0_0_0_2px_rgba(239,68,68,0.2)]'}`} />
                            {!isSubjectValid && <p className="text-red-500 text-[10px] mt-1 font-semibold">Format must be &quot;A &gt; B &gt; C&quot; (exactly 1 space around &gt;, no spaces at end)</p>}
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Type</label>
                            <select value={qType} onChange={e=>setQType(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-sm outline-none focus:border-indigo-500"><option>Single</option><option>Multiple</option><option>Short</option><option>Numeric</option></select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Difficulty</label>
                            <select value={difficulty} onChange={e=>setDifficulty(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-sm outline-none focus:border-indigo-500"><option>Very Easy</option><option>Easy</option><option>Medium</option><option>Hard</option><option>Very Hard</option></select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Marks</label>
                            <input type="number" step="0.1" value={marks} onChange={e=>setMarks(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-sm outline-none focus:border-indigo-500" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Negative</label>
                            <input type="number" step="0.1" value={negative} onChange={e=>setNegative(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-sm outline-none focus:border-indigo-500" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Panel */}
            <div className="col-span-1 lg:col-span-5 flex flex-col gap-4">
                
                {/* Preflight Ranges */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm shrink-0">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">3. Page Ranges & Validation</h3>
                        <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100"><i className="fa-solid fa-shield-halved mr-1"></i>Pre-Flight</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <p className="text-[10px] font-bold text-blue-600 uppercase mb-1.5"><i className="fa-solid fa-file-lines mr-1"></i>Question Pages</p>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="text-[10px] text-slate-500">From Page</label>
                                    <input type="number" value={qStart} onChange={e=>setQStart(Number(e.target.value))} className="w-full border border-slate-200 bg-slate-50 rounded p-1.5 text-sm" />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] text-slate-500">To Page</label>
                                    <input type="number" value={qEnd} onChange={e=>setQEnd(Number(e.target.value))} className="w-full border border-slate-200 bg-slate-50 rounded p-1.5 text-sm" />
                                </div>
                            </div>
                            <button onClick={() => openMarginModal('q_margins', qStart, qEnd)} className="mt-2 w-full text-[10px] py-1.5 border border-blue-200 rounded text-blue-600 hover:bg-blue-50 transition font-medium shadow-sm"><i className="fa-solid fa-crop-simple mr-1"></i> Set Boundaries (Start & End)</button>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-green-600 uppercase mb-1.5"><i className="fa-solid fa-check-circle mr-1"></i>Solution Pages</p>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="text-[10px] text-slate-500">From Page</label>
                                    <input type="number" value={sStart} onChange={e=>setSStart(Number(e.target.value))} className="w-full border border-slate-200 bg-slate-50 rounded p-1.5 text-sm" />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] text-slate-500">To Page</label>
                                    <input type="number" value={sEnd} onChange={e=>setSEnd(Number(e.target.value))} className="w-full border border-slate-200 bg-slate-50 rounded p-1.5 text-sm" />
                                </div>
                            </div>
                            <button onClick={() => openMarginModal('s_margins', sStart, sEnd)} className="mt-2 w-full text-[10px] py-1.5 border border-green-200 rounded text-green-600 hover:bg-green-50 transition font-medium shadow-sm"><i className="fa-solid fa-crop-simple mr-1"></i> Set Boundaries (Start & End)</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <p className="text-[10px] font-bold text-blue-600 uppercase mb-1.5"><i className="fa-solid fa-hashtag mr-1"></i>Question Index Range</p>
                            <div className="flex gap-2">
                                <div className="flex-1"><label className="text-[10px] text-slate-500">First Q#</label><input type="number" value={qIndexStart} onChange={e=>setQIndexStart(Number(e.target.value))} className="w-full border border-blue-200 bg-blue-50 rounded p-1.5 text-sm font-semibold" /></div>
                                <div className="flex-1"><label className="text-[10px] text-slate-500">Last Q#</label><input type="number" value={qIndexEnd} onChange={e=>setQIndexEnd(Number(e.target.value))} className="w-full border border-blue-200 bg-blue-50 rounded p-1.5 text-sm font-semibold" /></div>
                            </div>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-green-600 uppercase mb-1.5"><i className="fa-solid fa-hashtag mr-1"></i>Solution Index Range</p>
                            <div className="flex gap-2">
                                <div className="flex-1"><label className="text-[10px] text-slate-500">First S#</label><input type="number" value={sIndexStart} onChange={e=>setSIndexStart(Number(e.target.value))} className="w-full border border-green-200 bg-green-50 rounded p-1.5 text-sm font-semibold" /></div>
                                <div className="flex-1"><label className="text-[10px] text-slate-500">Last S#</label><input type="number" value={sIndexEnd} onChange={e=>setSIndexEnd(Number(e.target.value))} className="w-full border border-green-200 bg-green-50 rounded p-1.5 text-sm font-semibold" /></div>
                            </div>
                        </div>
                    </div>

                    <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-4 flex items-start gap-2">
                        <i className="fa-solid fa-triangle-exclamation mt-0.5"></i>
                        <span>Expected: <strong>{qIndexEnd - qIndexStart + 1}</strong> questions (Q{qIndexStart}–Q{qIndexEnd}) and <strong>{sIndexEnd - sIndexStart + 1}</strong> solutions (S{sIndexStart}–S{sIndexEnd}). The system will validate completeness after extraction.</span>
                    </div>
                    
                    <div className="flex items-center justify-between mb-4 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="text-xs">
                                <span className="text-slate-500 font-medium">Layout:</span> <span className="font-bold text-slate-800">{columns === 2 ? '2 Columns' : '1 Column'}</span>
                            </div>
                            <div className="text-xs">
                                <span className="text-slate-500 font-medium">Margins:</span> <span className="font-bold text-slate-800">{topMargin > 0 || bottomMargin > 0 ? `Top -${topMargin}% | Btm -${bottomMargin}%` : 'Full Page'}</span>
                            </div>
                        </div>
                        <button onClick={() => openMarginModal('global')} className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded shadow-sm hover:bg-slate-100 transition">
                            <i className="fa-solid fa-crop-simple mr-1"></i> Set Margins
                        </button>
                    </div>

                    <button onClick={runPreFlightCheck} disabled={isValidating} className="w-full py-2.5 bg-slate-800 text-white font-bold text-sm rounded-lg hover:bg-slate-700 transition disabled:opacity-50">
                        {isValidating ? <span><i className="fa-solid fa-circle-notch fa-spin mr-2"></i>Checking...</span> : <span><i className="fa-solid fa-stethoscope mr-2"></i>Run Validation</span>}
                    </button>

                    {validationResult && (
                        <div className="mt-3 flex flex-col gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center mb-1"><i className={`fa-solid ${validationResult.q_info.total === validationResult.q_info.expected ? 'fa-check-circle text-green-500' : 'fa-triangle-exclamation text-amber-500'} mr-2 text-sm`}></i><span className="font-bold text-slate-700">Questions: {validationResult.q_info.total} / {validationResult.q_info.expected} expected</span></div>
                                    {validationResult.q_info.total > 0 && <div className="ml-5 text-slate-500">Found: Q.{validationResult.q_info.first} → Q.{validationResult.q_info.last}</div>}
                                    {validationResult.q_info.missing && validationResult.q_info.missing.length > 0 && <div className="ml-5 text-red-600 font-semibold mt-1"><i className="fa-solid fa-xmark mr-1"></i>Missing: Q{validationResult.q_info.missing.slice(0,10).join(', Q')}{validationResult.q_info.missing.length > 10 ? ` +${validationResult.q_info.missing.length - 10} more` : ''}</div>}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center mb-1"><i className={`fa-solid ${validationResult.s_info.total === validationResult.s_info.expected ? 'fa-check-circle text-green-500' : 'fa-triangle-exclamation text-amber-500'} mr-2 text-sm`}></i><span className="font-bold text-slate-700">Solutions: {validationResult.s_info.total} / {validationResult.s_info.expected} expected</span></div>
                                    {validationResult.s_info.total > 0 && <div className="ml-5 text-slate-500">Found: Sol.{validationResult.s_info.first} → Sol.{validationResult.s_info.last}</div>}
                                    {validationResult.s_info.missing && validationResult.s_info.missing.length > 0 && <div className="ml-5 text-red-600 font-semibold mt-1"><i className="fa-solid fa-xmark mr-1"></i>Missing: S{validationResult.s_info.missing.slice(0,10).join(', S')}{validationResult.s_info.missing.length > 10 ? ` +${validationResult.s_info.missing.length - 10} more` : ''}</div>}
                                </div>
                            </div>
                            
                            <div className={`mt-2 p-2 rounded flex items-center justify-center font-bold ${validationResult.match ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}`}>
                                {validationResult.match ? (
                                    <span><i className="fa-solid fa-thumbs-up mr-2"></i> Perfect Match! All {validationResult.q_info.expected} questions and {validationResult.s_info.expected} solutions found.</span>
                                ) : (
                                    <span><i className="fa-solid fa-triangle-exclamation mr-2"></i> Mismatch! Check index ranges or page ranges.</span>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Action Button */}
                <div className={`shrink-0 transition-opacity ${validationResult ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    <button onClick={startExtraction} disabled={isExtracting || !isSubjectValid} className="w-full py-3.5 bg-indigo-600 text-white font-bold text-base rounded-xl shadow hover:bg-indigo-700 hover:-translate-y-0.5 transform transition disabled:transform-none disabled:opacity-50">
                        {isExtracting ? <span><i className="fa-solid fa-circle-notch fa-spin mr-2"></i> Processing &amp; Parsing...</span> : <span><i className="fa-solid fa-wand-magic-sparkles mr-2"></i> Process Document</span>}
                    </button>
                </div>
            </div>

            {/* Right Panel (Progress & Downloads) */}
            <div className="col-span-1 lg:col-span-4 flex flex-col gap-4">
                {/* Progress Bar */}
                {jobProgress && jobProgress.total > 0 && (
                    <div className="bg-white border border-indigo-100 rounded-xl p-4 shadow-sm mt-4 animate-fade-in">
                        <div className="flex justify-between items-end mb-2">
                            <div>
                                <h3 className="text-sm font-bold text-slate-800">{jobProgress.phase || "Processing"}</h3>
                                <p className="text-xs text-slate-500 font-medium">Parsed {jobProgress.current} of {jobProgress.total} pages</p>
                            </div>
                            <span className="text-sm font-black text-indigo-600">{Math.round((jobProgress.current / jobProgress.total) * 100)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                            <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-out" style={{ width: `${Math.round((jobProgress.current / jobProgress.total) * 100)}%` }}></div>
                        </div>
                    </div>
                )}
                {/* Downloads Area */}
                {downloadFiles && (
                    <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 shadow-sm flex-1 flex flex-col animate-fade-in overflow-y-auto">
                        <h3 className="text-sm font-bold text-emerald-800 mb-3"><i className="fa-solid fa-check-circle mr-2"></i>Extraction Complete</h3>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="bg-white p-3 border border-emerald-100 rounded-lg shadow-sm">
                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Questions</h4>
                                <div className="flex flex-col gap-2">
                                    <button onClick={() => downloadBase64(downloadFiles.questions_docx, 'Questions.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')} className="w-full py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded hover:bg-blue-100"><i className="fa-solid fa-file-word mr-1"></i> .DOCX</button>
                                    <button onClick={() => downloadBase64(downloadFiles.questions_zip, 'Questions.zip', 'application/zip')} className="w-full py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded hover:bg-indigo-100"><i className="fa-solid fa-file-zipper mr-1"></i> LMS .ZIP</button>
                                </div>
                            </div>
                            <div className="bg-white p-3 border border-emerald-100 rounded-lg shadow-sm">
                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Explanations</h4>
                                <div className="flex flex-col gap-2">
                                    <button onClick={() => downloadBase64(downloadFiles.explanations_docx, 'Explanations.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')} className="w-full py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded hover:bg-blue-100"><i className="fa-solid fa-file-word mr-1"></i> .DOCX</button>
                                    <button onClick={() => downloadBase64(downloadFiles.explanations_zip, 'Explanations.zip', 'application/zip')} className="w-full py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded hover:bg-indigo-100"><i className="fa-solid fa-file-zipper mr-1"></i> LMS .ZIP</button>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => downloadBase64(downloadFiles.answers_xlsx, 'Answers_Key.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')} className="w-full py-2.5 bg-emerald-500 text-white text-sm font-bold rounded-lg hover:bg-emerald-600 shadow-sm mt-auto"><i className="fa-solid fa-file-excel mr-2"></i> Download Answers (.xlsx)</button>
                    </div>
                )}

            </div>

            {/* VISUAL MARGINS & LAYOUT MODAL */}
            {showMarginModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-7xl h-[95vh] flex flex-col overflow-hidden animate-fade-in">
                        
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-base">
                                    <i className="fa-solid fa-crop-simple"></i>
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-800">
                                        {activeCropMode === 'global' ? 'Set Global Margins & Layout' :
                                         activeCropMode === 'q_margins' ? 'Set Questions Boundaries (Start & End)' :
                                         
                                         activeCropMode === 's_margins' ? 'Set Solutions Boundaries (Start & End)' :
                                         'Unknown'}
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        {activeCropMode === 'global' ? 'Drag the red lines to exclude headers & footers on all pages.' :
                                         'Drag the red line to visually crop the page content. Text beyond the line will be ignored.'}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowMarginModal(false)} className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition">
                                <i className="fa-solid fa-xmark text-lg"></i>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 flex overflow-hidden">
                            
                            {/* Left Controls Panel */}
                            <div className="w-80 border-r border-slate-200 p-5 flex flex-col justify-between bg-white shrink-0 overflow-y-auto">
                                <div className="space-y-6">
                                    
                                    {activeCropMode === 'global' ? (
                                        <>
                                            {/* Column Layout */}
                                            <div>
                                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Column Format</label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setColumns(1)} 
                                                        className={`py-2 px-3 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-2 ${columns === 1 ? 'bg-indigo-600 text-white border-indigo-600 shadow' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'}`}>
                                                        <i className="fa-solid fa-bars"></i> 1 Column
                                                    </button>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setColumns(2)} 
                                                        className={`py-2 px-3 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-2 ${columns === 2 ? 'bg-indigo-600 text-white border-indigo-600 shadow' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'}`}>
                                                        <i className="fa-solid fa-table-columns"></i> 2 Columns
                                                    </button>
                                                </div>
                                                <p className="text-[11px] text-slate-400 mt-2">
                                                    {columns === 2 ? 'Splits each page vertically at 50%. Reads the entire Left column top-to-bottom first, then the Right column.' : 'Reads the entire page width in standard single-column format.'}
                                                </p>
                                            </div>

                                            {/* Top Margin (Header) */}
                                            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-xs font-bold text-rose-800"><i className="fa-solid fa-arrow-down mr-1"></i> Header Cut</span>
                                                    <div className="flex items-center gap-0.5 bg-white px-1.5 py-0.5 rounded border border-rose-200">
                                                        <input type="number" step="0.1" min="0" max="40" value={topMargin} onChange={e => setTopMargin(parseFloat(e.target.value) || 0)} className="w-12 text-xs font-black text-rose-600 outline-none text-right bg-transparent" />
                                                        <span className="text-xs font-black text-rose-600">%</span>
                                                    </div>
                                                </div>
                                                <p className="text-[10px] text-rose-600 mb-2">Excludes page headers, book titles, and top chapter labels.</p>
                                                <input 
                                                    type="range" min="0" max="40" step="0.1"
                                                    value={topMargin} onChange={e => setTopMargin(parseFloat(e.target.value))} 
                                                    className="w-full accent-rose-600 cursor-pointer" />
                                            </div>

                                            {/* Bottom Margin (Footer) */}
                                            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-xs font-bold text-rose-800"><i className="fa-solid fa-arrow-up mr-1"></i> Footer Cut</span>
                                                    <div className="flex items-center gap-0.5 bg-white px-1.5 py-0.5 rounded border border-rose-200">
                                                        <input type="number" step="0.1" min="0" max="40" value={bottomMargin} onChange={e => setBottomMargin(parseFloat(e.target.value) || 0)} className="w-12 text-xs font-black text-rose-600 outline-none text-right bg-transparent" />
                                                        <span className="text-xs font-black text-rose-600">%</span>
                                                    </div>
                                                </div>
                                                <p className="text-[10px] text-rose-600 mb-2">Excludes page numbers, author footers, and website URLs.</p>
                                                <input 
                                                    type="range" min="0" max="40" step="0.1"
                                                    value={bottomMargin} onChange={e => setBottomMargin(parseFloat(e.target.value))} 
                                                    className="w-full accent-rose-600 cursor-pointer" />
                                            </div>

                                            {/* Reset Button */}
                                            <button 
                                                type="button" 
                                                onClick={() => { setTopMargin(0); setBottomMargin(0); }} 
                                                className="w-full py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition border border-dashed border-slate-300">
                                                <i className="fa-solid fa-rotate-left mr-1.5"></i> Reset Margins to 0%
                                            </button>
                                        </>
                                    ) : (
                                                                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                                            <i className="fa-solid fa-crop-simple text-3xl text-blue-400 mb-3 block"></i>
                                            <h4 className="text-sm font-bold text-blue-800 mb-2">Physical Markers</h4>
                                            <p className="text-xs text-blue-600 leading-relaxed mb-4">
                                                Drag the red handle on the left image to set the Start Boundary (Top), and on the right image to set the End Boundary (Bottom).
                                            </p>
                                            <div className="flex flex-col gap-2">
                                                <div className="bg-white p-2 rounded shadow-sm border border-blue-100 flex items-center justify-between">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Top Boundary</span>
                                                    <span className="text-xs font-black text-blue-700">
                                                        {activeCropMode === 'q_margins' ? qStartTop : sStartTop}%
                                                    </span>
                                                </div>
                                                <div className="bg-white p-2 rounded shadow-sm border border-blue-100 flex items-center justify-between">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Bottom Boundary</span>
                                                    <span className="text-xs font-black text-blue-700">
                                                        {activeCropMode === 'q_margins' ? qEndBottom : sEndBottom}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        
                                    )}

                                </div>

                                <div className="pt-4 border-t border-slate-200">
                                    <button 
                                        type="button" 
                                        onClick={() => setShowMarginModal(false)} 
                                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-200 transition">
                                        <i className="fa-solid fa-check mr-2"></i> Save &amp; Apply to All Pages
                                    </button>
                                </div>
                            </div>

                            {/* Right Canvas / Preview Panel */}
                            <div className="flex-1 bg-slate-100 p-6 flex flex-col items-center justify-center overflow-auto relative">
                                {loadingPreview ? (
                                    <div className="flex flex-col items-center gap-3 text-slate-500">
                                        <i className="fa-solid fa-circle-notch fa-spin text-3xl text-indigo-500"></i>
                                        <span className="text-xs font-bold">Rendering page preview...</span>
                                    </div>
                                ) : previewData ? (
                                                                        <div className="flex flex-row gap-12 items-start justify-center w-full">
                                        
                                        {/* LEFT / SINGLE IMAGE */}
                                        <div className="flex flex-col items-center">
                                            <div className="text-[11px] font-semibold text-slate-500 mb-2">
                                                Previewing Page {previewData.page_num} of {previewData.total_pages} {['q_margins', 's_margins'].includes(activeCropMode) ? "(Start Boundary - Adjust Top)" : "(Drag the handles on the image or use the sliders)"}
                                            </div>
                                            
                                            <div 
                                                onMouseMove={(e) => {
                                                    if (!draggingLine) return;
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const y = e.clientY - rect.top;
                                                    const pct = parseFloat(((y / rect.height) * 100).toFixed(1));
                                                    
                                                    if (draggingLine === 'top') {
                                                        const val = Math.max(0, Math.min(pct, 100));
                                                        if (activeCropMode === 'q_margins') setQStartTop(val);
                                                        else if (activeCropMode === 's_margins') setSStartTop(val);
                                                        else setTopMargin(Math.max(0, Math.min(val, 40)));
                                                    } else if (draggingLine === 'bottom') {
                                                        const bPct = parseFloat((((rect.height - y) / rect.height) * 100).toFixed(1));
                                                        const val = Math.max(0, Math.min(bPct, 100));
                                                        setBottomMargin(Math.max(0, Math.min(val, 40)));
                                                    }
                                                }}
                                                onMouseUp={() => setDraggingLine(null)}
                                                onMouseLeave={() => setDraggingLine(null)}
                                                className="relative shadow-2xl border border-slate-300 rounded overflow-hidden select-none bg-white max-h-[70vh]">
                                                
                                                <img 
                                                    src={previewData.image} 
                                                    alt="Page Preview Start" 
                                                    className="max-h-[70vh] object-contain pointer-events-none block" />

                                                {/* Dynamic Top Margin */}
                                                {['global', 'q_margins', 's_margins'].includes(activeCropMode) && (
                                                    <>
                                                        <div 
                                                            style={{ top: 0, height: `${activeCropMode === 'q_margins' ? qStartTop : activeCropMode === 's_margins' ? sStartTop : topMargin}%`, left: 0, right: 0 }}
                                                            className="absolute bg-rose-500/25 border-b-2 border-rose-500 pointer-events-none flex items-end justify-center pb-1 transition-[height] duration-75">
                                                        </div>
                                                        <div 
                                                            onMouseDown={(e) => { e.preventDefault(); setDraggingLine('top'); }}
                                                            style={{ top: `${activeCropMode === 'q_margins' ? qStartTop : activeCropMode === 's_margins' ? sStartTop : topMargin}%`, transform: 'translateY(-50%)' }}
                                                            className="absolute left-0 right-0 h-6 cursor-ns-resize flex items-center justify-center z-20 group">
                                                            <div className="w-24 h-2.5 bg-rose-600 hover:bg-rose-700 rounded-full shadow-md border-2 border-white flex items-center justify-center transition">
                                                                <div className="w-6 h-0.5 bg-white rounded"></div>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}

                                                {/* Dynamic Bottom Margin (Global Only on this side) */}
                                                {['global'].includes(activeCropMode) && (
                                                    <>
                                                        <div 
                                                            style={{ bottom: 0, height: `${bottomMargin}%`, left: 0, right: 0 }}
                                                            className="absolute bg-rose-500/25 border-t-2 border-rose-500 pointer-events-none flex items-start justify-center pt-1 transition-[height] duration-75">
                                                        </div>
                                                        <div 
                                                            onMouseDown={(e) => { e.preventDefault(); setDraggingLine('bottom'); }}
                                                            style={{ bottom: `${bottomMargin}%`, transform: 'translateY(50%)' }}
                                                            className="absolute left-0 right-0 h-6 cursor-ns-resize flex items-center justify-center z-20 group">
                                                        <div className="w-24 h-2.5 bg-rose-600 hover:bg-rose-700 rounded-full shadow-md border-2 border-white flex items-center justify-center transition">
                                                            <div className="w-6 h-0.5 bg-white rounded"></div>
                                                        </div>
                                                    </div>
                                                    </>
                                                )}
                                                
                                                {/* 2-Column Vertical Dotted Guide Line */}
                                                {columns === 2 && (
                                                    <div className="absolute top-0 bottom-0 left-1/2 w-0 border-l-2 border-dashed border-indigo-500 pointer-events-none z-10 flex flex-col justify-between py-6">
                                                        <span className="bg-indigo-600 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow -translate-x-1/2 self-center">
                                                            Col 1 (Left) | Col 2 (Right)
                                                        </span>
                                                        <span className="bg-indigo-600 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow -translate-x-1/2 self-center">
                                                            50% Center Split
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* RIGHT IMAGE (Only if q_margins or s_margins AND previewDataEnd exists) */}
                                        {['q_margins', 's_margins'].includes(activeCropMode) && previewDataEnd && (
                                            <div className="flex flex-col items-center">
                                                <div className="text-[11px] font-semibold text-slate-500 mb-2">
                                                    Previewing Page {previewDataEnd.page_num} of {previewDataEnd.total_pages} (End Boundary - Adjust Bottom)
                                                </div>
                                                
                                                <div 
                                                    onMouseMove={(e) => {
                                                        if (!draggingLine) return;
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        const y = e.clientY - rect.top;
                                                        
                                                        if (draggingLine === 'bottom') {
                                                            const bPct = parseFloat((((rect.height - y) / rect.height) * 100).toFixed(1));
                                                            const val = Math.max(0, Math.min(bPct, 100));
                                                            if (activeCropMode === 'q_margins') setQEndBottom(val);
                                                            else if (activeCropMode === 's_margins') setSEndBottom(val);
                                                        }
                                                    }}
                                                    onMouseUp={() => setDraggingLine(null)}
                                                    onMouseLeave={() => setDraggingLine(null)}
                                                    className="relative shadow-2xl border border-slate-300 rounded overflow-hidden select-none bg-white max-h-[70vh]">
                                                    
                                                    <img 
                                                        src={previewDataEnd.image} 
                                                        alt="Page Preview End" 
                                                        className="max-h-[70vh] object-contain pointer-events-none block" />

                                                    {/* Dynamic Bottom Margin */}
                                                    <>
                                                        <div 
                                                            style={{ bottom: 0, height: `${activeCropMode === 'q_margins' ? qEndBottom : sEndBottom}%`, left: 0, right: 0 }}
                                                            className="absolute bg-rose-500/25 border-t-2 border-rose-500 pointer-events-none flex items-start justify-center pt-1 transition-[height] duration-75">
                                                        </div>
                                                        <div 
                                                            onMouseDown={(e) => { e.preventDefault(); setDraggingLine('bottom'); }}
                                                            style={{ bottom: `${activeCropMode === 'q_margins' ? qEndBottom : sEndBottom}%`, transform: 'translateY(50%)' }}
                                                            className="absolute left-0 right-0 h-6 cursor-ns-resize flex items-center justify-center z-20 group">
                                                        <div className="w-24 h-2.5 bg-rose-600 hover:bg-rose-700 rounded-full shadow-md border-2 border-white flex items-center justify-center transition">
                                                            <div className="w-6 h-0.5 bg-white rounded"></div>
                                                        </div>
                                                    </div>
                                                    </>

                                                    {/* 2-Column Vertical Dotted Guide Line */}
                                                    {columns === 2 && (
                                                        <div className="absolute top-0 bottom-0 left-1/2 w-0 border-l-2 border-dashed border-indigo-500 pointer-events-none z-10 flex flex-col justify-between py-6">
                                                            <span className="bg-indigo-600 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow -translate-x-1/2 self-center">
                                                                Col 1 (Left) | Col 2 (Right)
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-xs text-slate-400">Click Set Margins to load preview.</div>
                                )}
                            </div>

                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
