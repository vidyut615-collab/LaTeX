// @ts-nocheck
"use client";

import React, { useState, useRef } from 'react';
import { API_URL, authHeaders } from '@/utils/api';
import { 
    UploadCloud, 
    FileText, 
    Sparkles, 
    Cpu, 
    Layers, 
    CheckCircle2, 
    AlertTriangle, 
    Crop, 
    Sliders, 
    FileSpreadsheet, 
    FileArchive, 
    Download, 
    Play, 
    RotateCcw, 
    Check, 
    X, 
    Columns, 
    FileCheck,
    CheckCircle
} from 'lucide-react';

export default function ExtractorPage() {
    // Extractor States
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [qStart, setQStart] = useState(26);
    const [qEnd, setQEnd] = useState(32);
    const [sStart, setSStart] = useState(32);
    const [sEnd, setSEnd] = useState(40);
    const [qIndexStart, setQIndexStart] = useState(1);
    const [qIndexEnd, setQIndexEnd] = useState(50);
    const [sIndexStart, setSIndexStart] = useState(1);
    const [sIndexEnd, setSIndexEnd] = useState(50);
    const [engine, setEngine] = useState('dynamic');
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
    const [draggingLine, setDraggingLine] = useState<string | null>(null);
    const [subject, setSubject] = useState('Maths > Quantitative > Average');
    const [marks, setMarks] = useState(2.0);
    const [negative, setNegative] = useState(0.6);
    const [difficulty, setDifficulty] = useState('Medium');
    const [qType, setQType] = useState('Single');

    const isSubjectValid = subject && !subject.startsWith(' ') && !subject.endsWith(' ') && !subject.includes('  >') && !subject.includes('>  ') && (subject.match(/>/g) || []).length === (subject.match(/ > /g) || []).length;

    const [isValidating, setIsValidating] = useState(false);
    const [validationResult, setValidationResult] = useState<any>(null);
    const [filePath, setFilePath] = useState('');
    const [isExtracting, setIsExtracting] = useState(false);
    const [downloadFiles, setDownloadFiles] = useState<any>(null);
    const [jobProgress, setJobProgress] = useState<any>(null);

    // File handlers
    const handleFileChange = (newFile: File | null) => {
        if (!newFile) return;
        setFile(newFile);
        setValidationResult(null);
        setDownloadFiles(null);
        setJobProgress(null);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const dropped = e.dataTransfer.files[0];
            if (dropped.name.endsWith('.pdf')) {
                handleFileChange(dropped);
            } else {
                alert("Please drop a valid .pdf file");
            }
        }
    };

    const loadPagePreview = async (pageNum: number, pageNumEnd: number | null = null) => {
        if (!file) return;
        setLoadingPreview(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("page_num", String(pageNum));
            const p1 = fetch(`${API_URL}/api/extract/preview-page`, {
                method: "POST", headers: authHeaders(), body: formData
            }).then(r => r.json());
            
            let p2 = null;
            if (pageNumEnd) {
                const fd2 = new FormData();
                fd2.append("file", file);
                fd2.append("page_num", String(pageNumEnd));
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
        } catch (err: any) {
            alert("Preview Error: " + err.message);
        }
        setLoadingPreview(false);
    };

    const openMarginModal = (mode = 'global', startPage: number | null = null, endPage: number | null = null) => {
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
        formData.append("q_start", String(qStart));
        formData.append("q_end", String(qEnd));
        formData.append("s_start", String(sStart));
        formData.append("s_end", String(sEnd));
        formData.append("q_start_top", String(qStartTop));
        formData.append("q_end_bottom", String(qEndBottom));
        formData.append("s_start_top", String(sStartTop));
        formData.append("s_end_bottom", String(sEndBottom));
        formData.append("q_index_start", String(qIndexStart));
        formData.append("q_index_end", String(qIndexEnd));
        formData.append("s_index_start", String(sIndexStart));
        formData.append("s_index_end", String(sIndexEnd));
        formData.append("top_margin_pct", String(topMargin));
        formData.append("bottom_margin_pct", String(bottomMargin));
        formData.append("columns", String(columns));
        
        try {
            const res = await fetch(`${API_URL}/api/validate`, { method: "POST", headers: authHeaders(), body: formData });
            if (!res.ok) throw new Error("Validation check failed.");
            const data = await res.json();
            setValidationResult(data);
            setFilePath(data.file_path);
        } catch (err: any) {
            alert("Validation Error: " + err.message);
        }
        setIsValidating(false);
    };

    const startExtraction = async () => {
        if (!file) return;
        setIsExtracting(true);
        setDownloadFiles(null);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("q_start", String(qStart));
        formData.append("q_end", String(qEnd));
        formData.append("s_start", String(sStart));
        formData.append("s_end", String(sEnd));
        formData.append("q_start_top", String(qStartTop));
        formData.append("q_end_bottom", String(qEndBottom));
        formData.append("s_start_top", String(sStartTop));
        formData.append("s_end_bottom", String(sEndBottom));
        formData.append("q_index_start", String(qIndexStart));
        formData.append("q_index_end", String(qIndexEnd));
        formData.append("s_index_start", String(sIndexStart));
        formData.append("s_index_end", String(sIndexEnd));
        formData.append("engine", engine);
        formData.append("subject", subject);
        formData.append("marks", String(marks));
        formData.append("negative", String(negative));
        formData.append("difficulty", difficulty);
        formData.append("q_type", qType);
        formData.append("top_margin_pct", String(topMargin));
        formData.append("bottom_margin_pct", String(bottomMargin));
        formData.append("columns", String(columns));

        const jobId = crypto.randomUUID();
        formData.append("job_id", jobId);

        setJobProgress(null);
        const pollInterval = setInterval(async () => {
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
            setJobProgress((prev: any) => {
                const tot = prev?.total || 1;
                return { status: "done", current: tot, total: tot, phase: "All Testpress Assets Generated!" };
            });
        } catch (err: any) {
            clearInterval(pollInterval);
            setJobProgress(null);
            alert(err.message);
        }
        setIsExtracting(false);
    };

    const downloadBase64 = (base64Data: string, fileName: string, mimeType: string) => {
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

    const downloadAllFiles = () => {
        if (!downloadFiles) return;
        downloadBase64(downloadFiles.questions_docx, 'Questions.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        downloadBase64(downloadFiles.questions_zip, 'Questions.zip', 'application/zip');
        downloadBase64(downloadFiles.explanations_docx, 'Explanations.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        downloadBase64(downloadFiles.explanations_zip, 'Explanations.zip', 'application/zip');
        downloadBase64(downloadFiles.answers_xlsx, 'Answers_Key.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    };

    const expectedQCount = qIndexEnd >= qIndexStart ? qIndexEnd - qIndexStart + 1 : 0;
    const expectedSCount = sIndexEnd >= sIndexStart ? sIndexEnd - sIndexStart + 1 : 0;

    return (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden gap-2.5">
            
            <input 
                ref={fileInputRef} 
                type="file" 
                accept=".pdf" 
                onChange={e => handleFileChange(e.target.files ? e.target.files[0] : null)} 
                className="hidden" 
            />

            {/* TOP COMPACT STUDIO RIBBON */}
            <div className="bg-white rounded-xl px-4 py-2 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3 shrink-0">
                
                {/* Brand / Title & Powered by Truskill */}
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
                        <Sliders className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-sm font-black text-slate-900 tracking-tight">
                            Extraction Studio
                        </h2>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                            Powered by Truskill
                        </span>
                    </div>
                </div>

                {/* Center File Upload Status Chip */}
                <div className="flex items-center gap-2">
                    {!file ? (
                        <button 
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            className={`px-3 py-1.5 rounded-lg border border-dashed text-xs font-bold transition flex items-center gap-2 ${
                                isDragging 
                                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                                    : 'border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700'
                            }`}
                        >
                            <UploadCloud className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Select or Drop PDF Book</span>
                        </button>
                    ) : (
                        <div className="flex items-center gap-2 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                            <FileText className="w-3.5 h-3.5 text-rose-600" />
                            <span className="text-xs font-bold text-slate-800 truncate max-w-[200px]" title={file.name}>
                                {file.name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-semibold">
                                ({(file.size / (1024 * 1024)).toFixed(1)} MB)
                            </span>
                            <button 
                                onClick={() => fileInputRef.current?.click()} 
                                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 ml-1 hover:underline"
                            >
                                Change
                            </button>
                        </div>
                    )}
                </div>

                {/* Right Engine Segmented Selector & Margins Button */}
                <div className="flex items-center gap-2">
                    
                    {/* Strategy Pills */}
                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                        <button
                            type="button"
                            onClick={() => setEngine('dynamic')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 ${
                                engine === 'dynamic' ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-200' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Sparkles className="w-3 h-3 text-indigo-600" />
                            <span>Dynamic</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setEngine('python')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 ${
                                engine === 'python' ? 'bg-white text-emerald-700 shadow-xs ring-1 ring-slate-200' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Cpu className="w-3 h-3 text-emerald-600" />
                            <span>Python</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setEngine('ai')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 ${
                                engine === 'ai' ? 'bg-white text-purple-700 shadow-xs ring-1 ring-slate-200' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Layers className="w-3 h-3 text-purple-600" />
                            <span>Vision AI</span>
                        </button>
                    </div>

                    {/* Margins Quick Launcher */}
                    <button 
                        type="button"
                        onClick={() => openMarginModal('global')} 
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold rounded-lg shadow-xs transition flex items-center gap-1.5"
                    >
                        <Crop className="w-3 h-3" />
                        <span>Margins &amp; Columns</span>
                    </button>
                </div>

            </div>

            {/* MAIN COCKPIT: TWO-COLUMN ZERO-SCROLL WORKBENCH */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 overflow-hidden">
                
                {/* LEFT WORKBENCH (7 Columns) */}
                <div className="lg:col-span-7 flex flex-col gap-2.5 h-full overflow-hidden justify-between">
                    
                    {/* SECTION 1: SIDE-BY-SIDE QUESTION & SOLUTION RANGES */}
                    <div className="grid grid-cols-2 gap-2.5">
                        
                        {/* Questions Range Card */}
                        <div className="p-3 rounded-xl border border-indigo-200/90 bg-white shadow-xs space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                                    <h4 className="text-xs font-extrabold text-indigo-950 uppercase tracking-wider">
                                        Questions
                                    </h4>
                                </div>
                                <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                    {expectedQCount} Qs Expected
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Start Page</label>
                                    <input 
                                        type="number" 
                                        value={qStart} 
                                        onChange={e => setQStart(Number(e.target.value))} 
                                        className="w-full bg-slate-50 border border-slate-300 rounded-md p-1.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-600 focus:bg-white" 
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">End Page</label>
                                    <input 
                                        type="number" 
                                        value={qEnd} 
                                        onChange={e => setQEnd(Number(e.target.value))} 
                                        className="w-full bg-slate-50 border border-slate-300 rounded-md p-1.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-600 focus:bg-white" 
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] font-bold text-indigo-800 uppercase block mb-0.5">First Q#</label>
                                    <input 
                                        type="number" 
                                        value={qIndexStart} 
                                        onChange={e => setQIndexStart(Number(e.target.value))} 
                                        className="w-full bg-indigo-50/50 border border-indigo-200 rounded-md p-1.5 text-xs font-black text-indigo-900 outline-none focus:border-indigo-600 focus:bg-white" 
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-indigo-800 uppercase block mb-0.5">Last Q#</label>
                                    <input 
                                        type="number" 
                                        value={qIndexEnd} 
                                        onChange={e => setQIndexEnd(Number(e.target.value))} 
                                        className="w-full bg-indigo-50/50 border border-indigo-200 rounded-md p-1.5 text-xs font-black text-indigo-900 outline-none focus:border-indigo-600 focus:bg-white" 
                                    />
                                </div>
                            </div>

                            <button 
                                type="button"
                                onClick={() => openMarginModal('q_margins', qStart, qEnd)} 
                                className="w-full py-1.5 px-2 rounded-md text-[11px] font-bold text-indigo-700 bg-indigo-50/60 hover:bg-indigo-100/70 border border-indigo-200 transition flex items-center justify-center gap-1"
                            >
                                <Crop className="w-3 h-3" />
                                <span>Question Boundaries (Start/End)</span>
                            </button>
                        </div>

                        {/* Solutions Range Card */}
                        <div className="p-3 rounded-xl border border-emerald-200/90 bg-white shadow-xs space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                                    <h4 className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider">
                                        Solutions
                                    </h4>
                                </div>
                                <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                    {expectedSCount} Sols Expected
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Start Page</label>
                                    <input 
                                        type="number" 
                                        value={sStart} 
                                        onChange={e => setSStart(Number(e.target.value))} 
                                        className="w-full bg-slate-50 border border-slate-300 rounded-md p-1.5 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600 focus:bg-white" 
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">End Page</label>
                                    <input 
                                        type="number" 
                                        value={sEnd} 
                                        onChange={e => setSEnd(Number(e.target.value))} 
                                        className="w-full bg-slate-50 border border-slate-300 rounded-md p-1.5 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600 focus:bg-white" 
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] font-bold text-emerald-800 uppercase block mb-0.5">First S#</label>
                                    <input 
                                        type="number" 
                                        value={sIndexStart} 
                                        onChange={e => setSIndexStart(Number(e.target.value))} 
                                        className="w-full bg-emerald-50/50 border border-emerald-200 rounded-md p-1.5 text-xs font-black text-emerald-900 outline-none focus:border-emerald-600 focus:bg-white" 
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-emerald-800 uppercase block mb-0.5">Last S#</label>
                                    <input 
                                        type="number" 
                                        value={sIndexEnd} 
                                        onChange={e => setSIndexEnd(Number(e.target.value))} 
                                        className="w-full bg-emerald-50/50 border border-emerald-200 rounded-md p-1.5 text-xs font-black text-emerald-900 outline-none focus:border-emerald-600 focus:bg-white" 
                                    />
                                </div>
                            </div>

                            <button 
                                type="button"
                                onClick={() => openMarginModal('s_margins', sStart, sEnd)} 
                                className="w-full py-1.5 px-2 rounded-md text-[11px] font-bold text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100/70 border border-emerald-200 transition flex items-center justify-center gap-1"
                            >
                                <Crop className="w-3 h-3" />
                                <span>Solution Boundaries (Start/End)</span>
                            </button>
                        </div>

                    </div>

                    {/* SECTION 2: TESTPRESS LMS METADATA & LAYOUT */}
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2.5">
                        
                        {/* Subject Hierarchy */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">
                                    LMS Subject Hierarchy Path
                                </label>
                                {isSubjectValid ? (
                                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 flex items-center gap-1">
                                        <Check className="w-2.5 h-2.5" /> Valid Format
                                    </span>
                                ) : (
                                    <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                        Needs &quot;A &gt; B &gt; C&quot;
                                    </span>
                                )}
                            </div>
                            <input 
                                type="text" 
                                value={subject} 
                                onChange={e => setSubject(e.target.value)} 
                                placeholder="e.g. Maths > Quantitative > Average"
                                className={`w-full bg-slate-50 border rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none transition ${
                                    isSubjectValid 
                                        ? 'border-slate-300 focus:bg-white focus:border-indigo-600 text-slate-800' 
                                        : 'border-rose-400 bg-rose-50/30 text-rose-900'
                                }`} 
                            />
                        </div>

                        {/* Four Meta Fields */}
                        <div className="grid grid-cols-4 gap-2">
                            <div>
                                <label className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">Type</label>
                                <select 
                                    value={qType} 
                                    onChange={e => setQType(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-1.5 text-[11px] font-bold text-slate-800 outline-none focus:border-indigo-600"
                                >
                                    <option>Single</option>
                                    <option>Multiple</option>
                                    <option>Short</option>
                                    <option>Numeric</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">Difficulty</label>
                                <select 
                                    value={difficulty} 
                                    onChange={e => setDifficulty(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-1.5 text-[11px] font-bold text-slate-800 outline-none focus:border-indigo-600"
                                >
                                    <option>Very Easy</option>
                                    <option>Easy</option>
                                    <option>Medium</option>
                                    <option>Hard</option>
                                    <option>Very Hard</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">+ Marks</label>
                                <input 
                                    type="number" 
                                    step="0.1" 
                                    value={marks} 
                                    onChange={e => setMarks(Number(e.target.value))} 
                                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-1.5 text-[11px] font-bold text-slate-800 outline-none focus:border-indigo-600" 
                                />
                            </div>

                            <div>
                                <label className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">- Marks</label>
                                <input 
                                    type="number" 
                                    step="0.1" 
                                    value={negative} 
                                    onChange={e => setNegative(Number(e.target.value))} 
                                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-1.5 text-[11px] font-bold text-slate-800 outline-none focus:border-indigo-600" 
                                />
                            </div>
                        </div>

                        {/* Page Layout & Column Summary Bar */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-3">
                                <span className="text-[11px] text-slate-500">
                                    Format: <strong className="text-slate-800">{columns === 2 ? '2 Columns (50% Split)' : '1 Column (Standard)'}</strong>
                                </span>
                                <span className="text-[11px] text-slate-500">
                                    Cut: <strong className="text-slate-800">{topMargin > 0 || bottomMargin > 0 ? `T:${topMargin}% | B:${bottomMargin}%` : 'Full Page'}</strong>
                                </span>
                            </div>

                            <button 
                                type="button"
                                onClick={() => openMarginModal('global')}
                                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                            >
                                <Crop className="w-3 h-3" />
                                <span>Adjust Crop &amp; Columns</span>
                            </button>
                        </div>

                    </div>

                </div>

                {/* RIGHT COMMAND & DOWNLOAD HUB (5 Columns) */}
                <div className="lg:col-span-5 flex flex-col gap-2.5 h-full overflow-hidden justify-between">
                    
                    {/* SECTION 3: PRE-FLIGHT QUALITY AUDIT */}
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                    <FileCheck className="w-3.5 h-3.5" />
                                </span>
                                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                    Pre-Flight Quality Audit
                                </h3>
                            </div>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                Zero-Error Gate
                            </span>
                        </div>

                        <button 
                            type="button"
                            onClick={runPreFlightCheck} 
                            disabled={!file || isValidating} 
                            className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isValidating ? (
                                <>
                                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    <span>Scanning Pages &amp; Verifying Indices...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Run Pre-Flight Completeness Audit</span>
                                </>
                            )}
                        </button>

                        {/* Validation Output */}
                        {validationResult ? (
                            <div className="space-y-1.5 pt-1">
                                <div className={`p-2 rounded-lg border flex items-center gap-2 ${
                                    validationResult.match 
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                                        : 'bg-amber-50 border-amber-200 text-amber-900'
                                }`}>
                                    {validationResult.match ? (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                    ) : (
                                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                    )}
                                    <div className="text-[11px] leading-tight font-extrabold">
                                        {validationResult.match 
                                            ? `100% Match: Found ${validationResult.q_info.expected} Qs & ${validationResult.s_info.expected} Sols`
                                            : 'Index Mismatch Detected! Check numbers below.'}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-[10px]">
                                    <div className="p-1.5 rounded-md bg-slate-50 border border-slate-200">
                                        <div className="font-bold text-slate-600 flex justify-between">
                                            <span>Questions:</span>
                                            <span className={validationResult.q_info.total === validationResult.q_info.expected ? 'text-emerald-700 font-extrabold' : 'text-amber-700 font-extrabold'}>
                                                {validationResult.q_info.total}/{validationResult.q_info.expected}
                                            </span>
                                        </div>
                                        {validationResult.q_info.missing && validationResult.q_info.missing.length > 0 && (
                                            <span className="text-rose-600 font-bold block truncate">
                                                Miss: Q{validationResult.q_info.missing.slice(0, 3).join(', Q')}...
                                            </span>
                                        )}
                                    </div>

                                    <div className="p-1.5 rounded-md bg-slate-50 border border-slate-200">
                                        <div className="font-bold text-slate-600 flex justify-between">
                                            <span>Solutions:</span>
                                            <span className={validationResult.s_info.total === validationResult.s_info.expected ? 'text-emerald-700 font-extrabold' : 'text-amber-700 font-extrabold'}>
                                                {validationResult.s_info.total}/{validationResult.s_info.expected}
                                            </span>
                                        </div>
                                        {validationResult.s_info.missing && validationResult.s_info.missing.length > 0 && (
                                            <span className="text-rose-600 font-bold block truncate">
                                                Miss: S{validationResult.s_info.missing.slice(0, 3).join(', S')}...
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-[10px] text-slate-400 text-center py-0.5">
                                Verifies all question and solution numbers before generating Testpress files.
                            </p>
                        )}
                    </div>

                    {/* SECTION 4: EXTRACTION TRIGGER & LIVE PROGRESS */}
                    <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
                        <button 
                            type="button"
                            onClick={startExtraction} 
                            disabled={!file || isExtracting || !isSubjectValid || !validationResult} 
                            className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs sm:text-sm font-black rounded-lg shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/35 transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
                        >
                            {isExtracting ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    <span>Processing &amp; Packaging...</span>
                                </>
                            ) : (
                                <>
                                    <Play className="w-4 h-4 fill-current" />
                                    <span>Run Full Extraction &amp; Generate Documents</span>
                                </>
                            )}
                        </button>

                        {/* Live Job Progress Bar */}
                        {jobProgress && (
                            <div className="p-2 rounded-lg bg-slate-50 border border-indigo-100 space-y-1">
                                <div className="flex items-center justify-between text-[11px]">
                                    <span className="font-bold text-slate-800">{jobProgress.phase || "Processing..."}</span>
                                    <span className="font-black text-indigo-600">
                                        {jobProgress.total > 0 ? Math.round((jobProgress.current / jobProgress.total) * 100) : 100}%
                                    </span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                    <div 
                                        className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300" 
                                        style={{ width: `${jobProgress.total > 0 ? Math.round((jobProgress.current / jobProgress.total) * 100) : 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* SECTION 5: TESTPRESS DOWNLOAD SUITE */}
                    <div className="p-3.5 rounded-xl border border-emerald-200/90 bg-emerald-50/50 shadow-xs space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center">
                                    <Check className="w-3 h-3" />
                                </span>
                                <h3 className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                                    Testpress LMS Suite
                                </h3>
                            </div>
                            {downloadFiles && (
                                <button 
                                    onClick={downloadAllFiles}
                                    className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition flex items-center gap-1"
                                >
                                    <Download className="w-3 h-3" />
                                    <span>Download All (5 Files)</span>
                                </button>
                            )}
                        </div>

                        {downloadFiles ? (
                            <div className="space-y-1.5 pt-1">
                                <div className="grid grid-cols-2 gap-1.5">
                                    <button 
                                        onClick={() => downloadBase64(downloadFiles.questions_docx, 'Questions.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')}
                                        className="py-1.5 px-2 bg-white hover:bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-bold rounded-md transition flex items-center justify-center gap-1 shadow-xs"
                                    >
                                        <Download className="w-3 h-3 text-blue-600" />
                                        <span>Questions.docx</span>
                                    </button>

                                    <button 
                                        onClick={() => downloadBase64(downloadFiles.questions_zip, 'Questions.zip', 'application/zip')}
                                        className="py-1.5 px-2 bg-white hover:bg-indigo-50 text-indigo-800 border border-indigo-200 text-[11px] font-bold rounded-md transition flex items-center justify-center gap-1 shadow-xs"
                                    >
                                        <FileArchive className="w-3 h-3 text-indigo-600" />
                                        <span>Questions.zip</span>
                                    </button>

                                    <button 
                                        onClick={() => downloadBase64(downloadFiles.explanations_docx, 'Explanations.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')}
                                        className="py-1.5 px-2 bg-white hover:bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-bold rounded-md transition flex items-center justify-center gap-1 shadow-xs"
                                    >
                                        <Download className="w-3 h-3 text-blue-600" />
                                        <span>Explanations.docx</span>
                                    </button>

                                    <button 
                                        onClick={() => downloadBase64(downloadFiles.explanations_zip, 'Explanations.zip', 'application/zip')}
                                        className="py-1.5 px-2 bg-white hover:bg-indigo-50 text-indigo-800 border border-indigo-200 text-[11px] font-bold rounded-md transition flex items-center justify-center gap-1 shadow-xs"
                                    >
                                        <FileArchive className="w-3 h-3 text-indigo-600" />
                                        <span>Explanations.zip</span>
                                    </button>
                                </div>

                                <button 
                                    onClick={() => downloadBase64(downloadFiles.answers_xlsx, 'Answers_Key.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
                                    className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-md shadow-xs transition flex items-center justify-center gap-1.5"
                                >
                                    <FileSpreadsheet className="w-3.5 h-3.5" />
                                    <span>Download Answers_Key.xlsx</span>
                                </button>
                            </div>
                        ) : (
                            <div className="text-[10px] text-slate-500 py-2 text-center bg-white/70 rounded-md border border-emerald-100">
                                Format: <strong className="text-slate-700">Questions.docx</strong>, <strong className="text-slate-700">Explanations.docx</strong>, media ZIPs, and <strong className="text-slate-700">Answers.xlsx</strong> will be generated here.
                            </div>
                        )}
                    </div>

                </div>

            </div>

            {/* VISUAL MARGINS & BOUNDARY STUDIO MODAL */}
            {showMarginModal && (
                <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-700/60 w-full max-w-7xl h-[94vh] flex flex-col overflow-hidden">
                        
                        {/* Modal Header */}
                        <div className="px-6 py-3.5 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30">
                                    <Crop className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                                            {activeCropMode === 'global' ? 'Visual Margin & Column Studio (All Pages)' :
                                             activeCropMode === 'q_margins' ? 'Physical Question Boundaries (Start & End Pages)' :
                                             'Physical Solution Boundaries (Start & End Pages)'}
                                        </h3>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">
                                            Live Canvas
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500">
                                        {activeCropMode === 'global' ? 'Drag the red line to trim book headers (top) and page numbers/footers (bottom).' :
                                         'Drag the red line on the start page (top cut) and end page (bottom cut) to isolate target questions.'}
                                    </p>
                                </div>
                            </div>

                            <button 
                                onClick={() => setShowMarginModal(false)} 
                                className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                            
                            {/* Left Control Sidebar */}
                            <div className="w-full lg:w-72 border-b lg:border-b-0 lg:border-r border-slate-200 p-4 flex flex-col justify-between bg-white shrink-0 overflow-y-auto space-y-4">
                                <div className="space-y-4">
                                    
                                    {activeCropMode === 'global' ? (
                                        <>
                                            {/* Column Format Selection */}
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                                                    Page Column Layout
                                                </label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setColumns(1)} 
                                                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-1 ${
                                                            columns === 1 
                                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' 
                                                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                                        }`}
                                                    >
                                                        <span>1 Column</span>
                                                    </button>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setColumns(2)} 
                                                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-1 ${
                                                            columns === 2 
                                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' 
                                                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                                        }`}
                                                    >
                                                        <span>2 Columns</span>
                                                    </button>
                                                </div>
                                                <p className="text-[10px] text-slate-400 mt-1.5 leading-tight">
                                                    {columns === 2 
                                                        ? 'Splits page vertically at 50%. Reads the entire left column top-to-bottom first, then right column.' 
                                                        : 'Reads entire page in standard full-width layout.'}
                                                </p>
                                            </div>

                                            {/* Top Margin (Header Exclude) */}
                                            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-1.5">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs font-bold text-rose-900">
                                                        Header Trim (Top)
                                                    </span>
                                                    <div className="flex items-center gap-0.5 bg-white px-1.5 py-0.5 rounded border border-rose-200">
                                                        <input 
                                                            type="number" 
                                                            step="0.1" 
                                                            min="0" 
                                                            max="40" 
                                                            value={topMargin} 
                                                            onChange={e => setTopMargin(parseFloat(e.target.value) || 0)} 
                                                            className="w-10 text-xs font-black text-rose-600 outline-none text-right bg-transparent" 
                                                        />
                                                        <span className="text-xs font-black text-rose-600">%</span>
                                                    </div>
                                                </div>
                                                <input 
                                                    type="range" 
                                                    min="0" 
                                                    max="40" 
                                                    step="0.1"
                                                    value={topMargin} 
                                                    onChange={e => setTopMargin(parseFloat(e.target.value) || 0)} 
                                                    className="w-full accent-rose-600 cursor-pointer" 
                                                />
                                            </div>

                                            {/* Bottom Margin (Footer Exclude) */}
                                            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-1.5">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs font-bold text-rose-900">
                                                        Footer Trim (Bottom)
                                                    </span>
                                                    <div className="flex items-center gap-0.5 bg-white px-1.5 py-0.5 rounded border border-rose-200">
                                                        <input 
                                                            type="number" 
                                                            step="0.1" 
                                                            min="0" 
                                                            max="40" 
                                                            value={bottomMargin} 
                                                            onChange={e => setBottomMargin(parseFloat(e.target.value) || 0)} 
                                                            className="w-10 text-xs font-black text-rose-600 outline-none text-right bg-transparent" 
                                                        />
                                                        <span className="text-xs font-black text-rose-600">%</span>
                                                    </div>
                                                </div>
                                                <input 
                                                    type="range" 
                                                    min="0" 
                                                    max="40" 
                                                    step="0.1"
                                                    value={bottomMargin} 
                                                    onChange={e => setBottomMargin(parseFloat(e.target.value) || 0)} 
                                                    className="w-full accent-rose-600 cursor-pointer" 
                                                />
                                            </div>

                                            {/* Reset Button */}
                                            <button 
                                                type="button" 
                                                onClick={() => { setTopMargin(0); setBottomMargin(0); }} 
                                                className="w-full py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition border border-dashed border-slate-300 flex items-center justify-center gap-1"
                                            >
                                                <RotateCcw className="w-3 h-3" />
                                                <span>Reset Margins to 0%</span>
                                            </button>
                                        </>
                                    ) : (
                                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 space-y-2">
                                            <div className="flex items-center gap-1.5 text-indigo-900 font-bold text-xs uppercase tracking-wider">
                                                <Crop className="w-3.5 h-3.5 text-indigo-600" />
                                                <span>Physical Boundary Offsets</span>
                                            </div>
                                            <p className="text-[11px] text-indigo-800 leading-relaxed">
                                                Drag red handle on <strong>Left Image</strong> for Top Cut, and on <strong>Right Image</strong> for Bottom Cut.
                                            </p>

                                            <div className="space-y-1.5 pt-1">
                                                <div className="bg-white p-2 rounded-lg border border-indigo-100 flex items-center justify-between text-xs">
                                                    <span className="font-bold text-slate-600">Start Page Top Cut</span>
                                                    <span className="font-black text-indigo-700">
                                                        {activeCropMode === 'q_margins' ? qStartTop : sStartTop}%
                                                    </span>
                                                </div>
                                                <div className="bg-white p-2 rounded-lg border border-indigo-100 flex items-center justify-between text-xs">
                                                    <span className="font-bold text-slate-600">End Page Bottom Cut</span>
                                                    <span className="font-black text-indigo-700">
                                                        {activeCropMode === 'q_margins' ? qEndBottom : sEndBottom}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                </div>

                                <div className="pt-3 border-t border-slate-200">
                                    <button 
                                        type="button" 
                                        onClick={() => setShowMarginModal(false)} 
                                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
                                    >
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Save &amp; Apply Boundaries</span>
                                    </button>
                                </div>
                            </div>

                            {/* Right Interactive Canvas */}
                            <div className="flex-1 bg-slate-900/95 p-4 flex flex-col items-center justify-center overflow-auto relative">
                                {loadingPreview ? (
                                    <div className="flex flex-col items-center gap-2 text-slate-400">
                                        <div className="w-7 h-7 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                                        <span className="text-xs font-bold text-slate-300">Rendering preview...</span>
                                    </div>
                                ) : previewData ? (
                                    <div className="flex flex-col md:flex-row gap-6 items-start justify-center w-full max-w-5xl">
                                        
                                        {/* LEFT / START IMAGE */}
                                        <div className="flex flex-col items-center w-full">
                                            <div className="text-[11px] font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                                                <span>
                                                    Page {previewData.page_num} of {previewData.total_pages}
                                                    {['q_margins', 's_margins'].includes(activeCropMode) ? " (Start Boundary)" : " (Global Preview)"}
                                                </span>
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
                                                className="relative shadow-2xl border border-slate-700 rounded-xl overflow-hidden select-none bg-white max-h-[72vh]"
                                            >
                                                <img 
                                                    src={previewData.image} 
                                                    alt="Page Preview" 
                                                    className="max-h-[72vh] object-contain pointer-events-none block" 
                                                />

                                                {/* Dynamic Top Margin Mask */}
                                                {['global', 'q_margins', 's_margins'].includes(activeCropMode) && (
                                                    <>
                                                        <div 
                                                            style={{ top: 0, height: `${activeCropMode === 'q_margins' ? qStartTop : activeCropMode === 's_margins' ? sStartTop : topMargin}%`, left: 0, right: 0 }}
                                                            className="absolute bg-rose-500/25 border-b-2 border-rose-500 pointer-events-none flex items-end justify-center pb-1 transition-[height] duration-75"
                                                        >
                                                            <span className="text-[9px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded shadow">
                                                                Excluded Top Header
                                                            </span>
                                                        </div>
                                                        <div 
                                                            onMouseDown={(e) => { e.preventDefault(); setDraggingLine('top'); }}
                                                            style={{ top: `${activeCropMode === 'q_margins' ? qStartTop : activeCropMode === 's_margins' ? sStartTop : topMargin}%`, transform: 'translateY(-50%)' }}
                                                            className="absolute left-0 right-0 h-8 cursor-ns-resize flex items-center justify-center z-20 group"
                                                        >
                                                            <div className="w-24 h-2.5 bg-rose-600 hover:bg-rose-500 rounded-full shadow-lg border-2 border-white flex items-center justify-center transition group-hover:scale-105">
                                                                <div className="w-6 h-0.5 bg-white rounded"></div>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}

                                                {/* Dynamic Bottom Margin Mask (Global Mode) */}
                                                {['global'].includes(activeCropMode) && (
                                                    <>
                                                        <div 
                                                            style={{ bottom: 0, height: `${bottomMargin}%`, left: 0, right: 0 }}
                                                            className="absolute bg-rose-500/25 border-t-2 border-rose-500 pointer-events-none flex items-start justify-center pt-1 transition-[height] duration-75"
                                                        >
                                                            <span className="text-[9px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded shadow">
                                                                Excluded Bottom Footer
                                                            </span>
                                                        </div>
                                                        <div 
                                                            onMouseDown={(e) => { e.preventDefault(); setDraggingLine('bottom'); }}
                                                            style={{ bottom: `${bottomMargin}%`, transform: 'translateY(50%)' }}
                                                            className="absolute left-0 right-0 h-8 cursor-ns-resize flex items-center justify-center z-20 group"
                                                        >
                                                            <div className="w-24 h-2.5 bg-rose-600 hover:bg-rose-500 rounded-full shadow-lg border-2 border-white flex items-center justify-center transition group-hover:scale-105">
                                                                <div className="w-6 h-0.5 bg-white rounded"></div>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                                
                                                {/* 2-Column Vertical Guide */}
                                                {columns === 2 && (
                                                    <div className="absolute top-0 bottom-0 left-1/2 w-0 border-l-2 border-dashed border-indigo-500 pointer-events-none z-10 flex flex-col justify-between py-6">
                                                        <span className="bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded shadow -translate-x-1/2 self-center">
                                                            Col 1 (Left) | Col 2 (Right)
                                                        </span>
                                                        <span className="bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded shadow -translate-x-1/2 self-center">
                                                            50% Vertical Split
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* RIGHT / END IMAGE */}
                                        {['q_margins', 's_margins'].includes(activeCropMode) && previewDataEnd && (
                                            <div className="flex flex-col items-center w-full">
                                                <div className="text-[11px] font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                                    <span>
                                                        Page {previewDataEnd.page_num} of {previewDataEnd.total_pages} (End Boundary - Bottom Cut)
                                                    </span>
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
                                                    className="relative shadow-2xl border border-slate-700 rounded-xl overflow-hidden select-none bg-white max-h-[72vh]"
                                                >
                                                    <img 
                                                        src={previewDataEnd.image} 
                                                        alt="Page Preview End" 
                                                        className="max-h-[72vh] object-contain pointer-events-none block" 
                                                    />

                                                    {/* Dynamic Bottom Cut */}
                                                    <div 
                                                        style={{ bottom: 0, height: `${activeCropMode === 'q_margins' ? qEndBottom : sEndBottom}%`, left: 0, right: 0 }}
                                                        className="absolute bg-rose-500/25 border-t-2 border-rose-500 pointer-events-none flex items-start justify-center pt-1 transition-[height] duration-75"
                                                    >
                                                        <span className="text-[9px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded shadow">
                                                            End Boundary (Excluded)
                                                        </span>
                                                    </div>
                                                    <div 
                                                        onMouseDown={(e) => { e.preventDefault(); setDraggingLine('bottom'); }}
                                                        style={{ bottom: `${activeCropMode === 'q_margins' ? qEndBottom : sEndBottom}%`, transform: 'translateY(50%)' }}
                                                        className="absolute left-0 right-0 h-8 cursor-ns-resize flex items-center justify-center z-20 group"
                                                    >
                                                        <div className="w-24 h-2.5 bg-rose-600 hover:bg-rose-500 rounded-full shadow-lg border-2 border-white flex items-center justify-center transition group-hover:scale-105">
                                                            <div className="w-6 h-0.5 bg-white rounded"></div>
                                                        </div>
                                                    </div>

                                                    {/* 2-Column Vertical Guide */}
                                                    {columns === 2 && (
                                                        <div className="absolute top-0 bottom-0 left-1/2 w-0 border-l-2 border-dashed border-indigo-500 pointer-events-none z-10 flex flex-col justify-between py-6">
                                                            <span className="bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded shadow -translate-x-1/2 self-center">
                                                                Col 1 (Left) | Col 2 (Right)
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                    </div>
                                ) : (
                                    <div className="text-xs text-slate-400">Click &quot;Adjust Margins&quot; to load visual preview.</div>
                                )}
                            </div>

                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
