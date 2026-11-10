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
    XCircle, 
    Crop, 
    Settings, 
    Sliders, 
    FileSpreadsheet, 
    FileArchive, 
    Download, 
    Play, 
    RotateCcw, 
    Check, 
    X, 
    ChevronRight, 
    HelpCircle, 
    Columns, 
    Maximize2, 
    Info, 
    ExternalLink, 
    FolderArchive
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
    const [qStartKeyword, setQStartKeyword] = useState('Exercise');
    const [sStartKeyword, setSStartKeyword] = useState('Solutions');
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
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
            
            {/* Top Workspace Header Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm">
                <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                        <Sliders className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-black text-slate-900 tracking-tight">
                                Testpress Extraction Studio
                            </h2>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100/70 text-indigo-800">
                                Powered by Truskill
                            </span>
                        </div>
                        <p className="text-xs text-slate-500">
                            Configure physical boundaries, validate question index ranges, and export Testpress LMS Word/Excel bundles.
                        </p>
                    </div>
                </div>


            </div>

            {/* Main Workbench Grid (Left Configuration 7 cols, Right Diagnostic & Download 5 cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* LEFT CONFIGURATION PANEL (7 Columns) */}
                <div className="lg:col-span-7 space-y-6">
                    
                    {/* CARD 1: DOCUMENT UPLOAD & ENGINE */}
                    <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">1</span>
                                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                                    PDF Document &amp; Extraction Engine
                                </h3>
                            </div>
                            {file && (
                                <button 
                                    onClick={() => fileInputRef.current?.click()} 
                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                                >
                                    <span>Change PDF</span>
                                </button>
                            )}
                        </div>

                        {/* Drag and Drop Upload Zone */}
                        <input 
                            ref={fileInputRef} 
                            type="file" 
                            accept=".pdf" 
                            onChange={e => handleFileChange(e.target.files ? e.target.files[0] : null)} 
                            className="hidden" 
                        />

                        {!file ? (
                            <div 
                                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center gap-3 ${
                                    isDragging 
                                        ? 'border-indigo-600 bg-indigo-50/50 scale-[0.99]' 
                                        : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
                                }`}
                            >
                                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm">
                                    <UploadCloud className="w-7 h-7" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-800">
                                        Drop your PDF book here, or <span className="text-indigo-600 underline">browse</span>
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Supports any EdTech question book, mock test, or solution guide
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="text-sm font-bold text-slate-800 truncate max-w-sm">{file.name}</p>
                                        <p className="text-xs text-slate-500 font-medium">{(file.size / (1024 * 1024)).toFixed(2)} MB &bull; Ready for Extraction</p>
                                    </div>
                                </div>
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 shrink-0">
                                    <Check className="w-3.5 h-3.5" /> Loaded
                                </span>
                            </div>
                        )}

                        {/* Extraction Engine Selector */}
                        <div className="pt-2">
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-2">
                                Extraction Engine Strategy
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setEngine('dynamic')}
                                    className={`p-3 rounded-xl border text-left transition-all ${
                                        engine === 'dynamic' 
                                            ? 'border-indigo-600 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-500' 
                                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                            Dynamic
                                        </span>
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold">Recommended</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-tight">
                                        Fast Python engine + auto AI fallback for tricky questions.
                                    </p>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setEngine('python')}
                                    className={`p-3 rounded-xl border text-left transition-all ${
                                        engine === 'python' 
                                            ? 'border-indigo-600 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-500' 
                                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                            <Cpu className="w-3.5 h-3.5 text-emerald-600" />
                                            Pure Python
                                        </span>
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">Fastest</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-tight">
                                        Offline universal regex parsing. 100% free and instantaneous.
                                    </p>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setEngine('ai')}
                                    className={`p-3 rounded-xl border text-left transition-all ${
                                        engine === 'ai' 
                                            ? 'border-indigo-600 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-500' 
                                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                            <Layers className="w-3.5 h-3.5 text-purple-600" />
                                            Vision AI
                                        </span>
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-bold">Multimodal</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-tight">
                                        Groq / Gemini multimodal vision models on all pages.
                                    </p>
                                </button>
                            </div>
                        </div>

                    </div>

                    {/* CARD 2: PAGE BOUNDARIES & QUESTION RANGES */}
                    <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">2</span>
                                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                                    Page Boundaries &amp; Index Ranges
                                </h3>
                            </div>
                            <span className="text-[11px] font-semibold text-slate-500">
                                Testpress Index Auditor
                            </span>
                        </div>

                        {/* Side by side Questions and Solutions Configuration */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            
                            {/* QUESTIONS BLOCK */}
                            <div className="p-4 rounded-xl border border-indigo-200/80 bg-indigo-50/30 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                                        <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                                            Questions Section
                                        </h4>
                                    </div>
                                    <span className="text-[11px] font-extrabold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-md">
                                        {expectedQCount} Qs Expected
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-600 block mb-1">Start Page</label>
                                        <input 
                                            type="number" 
                                            value={qStart} 
                                            onChange={e => setQStart(Number(e.target.value))} 
                                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm font-semibold text-slate-800 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none" 
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-600 block mb-1">End Page</label>
                                        <input 
                                            type="number" 
                                            value={qEnd} 
                                            onChange={e => setQEnd(Number(e.target.value))} 
                                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm font-semibold text-slate-800 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none" 
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[11px] font-bold text-indigo-800 block mb-1">First Q#</label>
                                        <input 
                                            type="number" 
                                            value={qIndexStart} 
                                            onChange={e => setQIndexStart(Number(e.target.value))} 
                                            className="w-full bg-white border border-indigo-300 rounded-lg p-2 text-sm font-extrabold text-indigo-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none" 
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-bold text-indigo-800 block mb-1">Last Q#</label>
                                        <input 
                                            type="number" 
                                            value={qIndexEnd} 
                                            onChange={e => setQIndexEnd(Number(e.target.value))} 
                                            className="w-full bg-white border border-indigo-300 rounded-lg p-2 text-sm font-extrabold text-indigo-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none" 
                                        />
                                    </div>
                                </div>

                                <button 
                                    type="button"
                                    onClick={() => openMarginModal('q_margins', qStart, qEnd)} 
                                    className="w-full py-2 px-3 rounded-lg text-xs font-bold text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 transition flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                    <Crop className="w-3.5 h-3.5" />
                                    <span>Set Physical Boundaries (Start/End)</span>
                                </button>
                            </div>

                            {/* SOLUTIONS BLOCK */}
                            <div className="p-4 rounded-xl border border-emerald-200/80 bg-emerald-50/30 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                                        <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                                            Solutions Section
                                        </h4>
                                    </div>
                                    <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                                        {expectedSCount} Sols Expected
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-600 block mb-1">Start Page</label>
                                        <input 
                                            type="number" 
                                            value={sStart} 
                                            onChange={e => setSStart(Number(e.target.value))} 
                                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm font-semibold text-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none" 
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-600 block mb-1">End Page</label>
                                        <input 
                                            type="number" 
                                            value={sEnd} 
                                            onChange={e => setSEnd(Number(e.target.value))} 
                                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm font-semibold text-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none" 
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[11px] font-bold text-emerald-800 block mb-1">First S#</label>
                                        <input 
                                            type="number" 
                                            value={sIndexStart} 
                                            onChange={e => setSIndexStart(Number(e.target.value))} 
                                            className="w-full bg-white border border-emerald-300 rounded-lg p-2 text-sm font-extrabold text-emerald-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none" 
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-bold text-emerald-800 block mb-1">Last S#</label>
                                        <input 
                                            type="number" 
                                            value={sIndexEnd} 
                                            onChange={e => setSIndexEnd(Number(e.target.value))} 
                                            className="w-full bg-white border border-emerald-300 rounded-lg p-2 text-sm font-extrabold text-emerald-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none" 
                                        />
                                    </div>
                                </div>

                                <button 
                                    type="button"
                                    onClick={() => openMarginModal('s_margins', sStart, sEnd)} 
                                    className="w-full py-2 px-3 rounded-lg text-xs font-bold text-emerald-700 bg-white border border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 transition flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                    <Crop className="w-3.5 h-3.5" />
                                    <span>Set Physical Boundaries (Start/End)</span>
                                </button>
                            </div>

                        </div>

                        {/* Layout & Margin Bar */}
                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-4">
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Layout Columns</span>
                                    <span className="text-xs font-bold text-slate-800">{columns === 2 ? '2 Columns (50% Split)' : '1 Column (Standard)'}</span>
                                </div>
                                <div className="h-6 w-px bg-slate-200"></div>
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Global Margins</span>
                                    <span className="text-xs font-bold text-slate-800">
                                        {topMargin > 0 || bottomMargin > 0 ? `Header -${topMargin}% | Footer -${bottomMargin}%` : 'Full Page (0% Cut)'}
                                    </span>
                                </div>
                            </div>

                            <button 
                                type="button"
                                onClick={() => openMarginModal('global')} 
                                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center justify-center gap-2"
                            >
                                <Crop className="w-3.5 h-3.5" />
                                <span>Adjust Margins &amp; Columns</span>
                            </button>
                        </div>
                    </div>

                    {/* CARD 3: LMS EXCEL METADATA */}
                    <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">3</span>
                                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                                    Testpress LMS Excel Metadata
                                </h3>
                            </div>
                            <span className="text-[11px] font-semibold text-slate-500">
                                Pre-populates <code className="text-indigo-600">Answers.xlsx</code>
                            </span>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    LMS Subject Hierarchy Path
                                </label>
                                {isSubjectValid ? (
                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                                        <Check className="w-3 h-3" /> Valid Path Format
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                        Invalid Format
                                    </span>
                                )}
                            </div>
                            <input 
                                type="text" 
                                value={subject} 
                                onChange={e => setSubject(e.target.value)} 
                                className={`w-full bg-slate-50 border rounded-xl p-3 text-sm font-semibold outline-none transition ${
                                    isSubjectValid 
                                        ? 'border-slate-300 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 text-slate-900' 
                                        : 'border-rose-400 bg-rose-50/30 text-rose-900 focus:ring-2 focus:ring-rose-100'
                                }`} 
                            />
                            {!isSubjectValid && (
                                <p className="text-rose-600 text-[11px] font-semibold mt-1.5 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 shrink-0" />
                                    <span>Format must be &quot;Category &gt; Subject &gt; Topic&quot; (Single space around each &gt;, no trailing space)</span>
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Question Type</label>
                                <select 
                                    value={qType} 
                                    onChange={e => setQType(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-600"
                                >
                                    <option>Single</option>
                                    <option>Multiple</option>
                                    <option>Short</option>
                                    <option>Numeric</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Difficulty</label>
                                <select 
                                    value={difficulty} 
                                    onChange={e => setDifficulty(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-600"
                                >
                                    <option>Very Easy</option>
                                    <option>Easy</option>
                                    <option>Medium</option>
                                    <option>Hard</option>
                                    <option>Very Hard</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Positive Marks</label>
                                <input 
                                    type="number" 
                                    step="0.1" 
                                    value={marks} 
                                    onChange={e => setMarks(Number(e.target.value))} 
                                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-600" 
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Negative Marks</label>
                                <input 
                                    type="number" 
                                    step="0.1" 
                                    value={negative} 
                                    onChange={e => setNegative(Number(e.target.value))} 
                                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-600" 
                                />
                            </div>
                        </div>

                    </div>

                </div>

                {/* RIGHT DIAGNOSTIC, TRIGGER & DOWNLOADS PANEL (5 Columns) */}
                <div className="lg:col-span-5 space-y-6">
                    
                    {/* CARD 4: PRE-FLIGHT VALIDATION DIAGNOSTIC CENTER */}
                    <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">4</span>
                                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                                    Pre-Flight Quality Audit
                                </h3>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                Zero-Error Gate
                            </span>
                        </div>

                        <p className="text-xs text-slate-500 leading-relaxed">
                            Simulates extraction across your target pages to verify that every question and solution index is detected without omissions before creating documents.
                        </p>

                        <button 
                            type="button"
                            onClick={runPreFlightCheck} 
                            disabled={!file || isValidating} 
                            className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-md transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                        >
                            {isValidating ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    <span>Scanning Pages &amp; Verifying Indices...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4 text-amber-400" />
                                    <span>Run Pre-Flight Validation Audit</span>
                                </>
                            )}
                        </button>

                        {/* Validation Result Box */}
                        {validationResult && (
                            <div className="space-y-3 pt-2">
                                {/* Overall Match Status Banner */}
                                <div className={`p-3.5 rounded-xl border flex items-center gap-3 ${
                                    validationResult.match 
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                                        : 'bg-amber-50 border-amber-200 text-amber-900'
                                }`}>
                                    {validationResult.match ? (
                                        <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0">
                                            <CheckCircle2 className="w-5 h-5" />
                                        </div>
                                    ) : (
                                        <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
                                            <AlertTriangle className="w-5 h-5" />
                                        </div>
                                    )}
                                    <div>
                                        <h4 className="text-xs font-black">
                                            {validationResult.match 
                                                ? `100% Match: Found ${validationResult.q_info.expected} Questions & ${validationResult.s_info.expected} Solutions`
                                                : 'Index Mismatch Detected!'}
                                        </h4>
                                        <p className="text-[11px] opacity-90 mt-0.5">
                                            {validationResult.match 
                                                ? 'Ready for clean bulk upload. No missing indices or broken numbering.' 
                                                : 'Some question or solution numbers were not detected. Review missing indices below.'}
                                        </p>
                                    </div>
                                </div>

                                {/* Questions & Solutions Detail Cards */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold uppercase text-slate-500">Questions Audit</span>
                                            <span className={`text-[11px] font-extrabold ${validationResult.q_info.total === validationResult.q_info.expected ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                {validationResult.q_info.total} / {validationResult.q_info.expected}
                                            </span>
                                        </div>
                                        {validationResult.q_info.total > 0 && (
                                            <p className="text-[11px] text-slate-600 font-medium">
                                                Span: Q.{validationResult.q_info.first} &rarr; Q.{validationResult.q_info.last}
                                            </p>
                                        )}
                                        {validationResult.q_info.missing && validationResult.q_info.missing.length > 0 && (
                                            <p className="text-[11px] text-rose-600 font-bold mt-1">
                                                Missing: Q{validationResult.q_info.missing.slice(0, 5).join(', Q')}{validationResult.q_info.missing.length > 5 ? ` +${validationResult.q_info.missing.length - 5} more` : ''}
                                            </p>
                                        )}
                                    </div>

                                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold uppercase text-slate-500">Solutions Audit</span>
                                            <span className={`text-[11px] font-extrabold ${validationResult.s_info.total === validationResult.s_info.expected ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                {validationResult.s_info.total} / {validationResult.s_info.expected}
                                            </span>
                                        </div>
                                        {validationResult.s_info.total > 0 && (
                                            <p className="text-[11px] text-slate-600 font-medium">
                                                Span: S.{validationResult.s_info.first} &rarr; S.{validationResult.s_info.last}
                                            </p>
                                        )}
                                        {validationResult.s_info.missing && validationResult.s_info.missing.length > 0 && (
                                            <p className="text-[11px] text-rose-600 font-bold mt-1">
                                                Missing: S{validationResult.s_info.missing.slice(0, 5).join(', S')}{validationResult.s_info.missing.length > 5 ? ` +${validationResult.s_info.missing.length - 5} more` : ''}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* CARD 5: EXTRACTION TRIGGER & LIVE PROGRESS */}
                    <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">5</span>
                                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                                    Extraction Execution
                                </h3>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Testpress Ready
                            </span>
                        </div>

                        {/* Extraction Button */}
                        <button 
                            type="button"
                            onClick={startExtraction} 
                            disabled={!file || isExtracting || !isSubjectValid || !validationResult} 
                            className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-sm sm:text-base font-black rounded-xl shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 flex items-center justify-center gap-3 disabled:opacity-40 disabled:pointer-events-none disabled:transform-none"
                        >
                            {isExtracting ? (
                                <>
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    <span>Processing &amp; Packaging Documents...</span>
                                </>
                            ) : (
                                <>
                                    <Play className="w-5 h-5 fill-current" />
                                    <span>Run Full Extraction &amp; Generate Documents</span>
                                </>
                            )}
                        </button>

                        {!validationResult && (
                            <p className="text-[11px] text-slate-400 text-center font-medium">
                                * Run Pre-Flight Validation above before generating final documents.
                            </p>
                        )}

                        {/* Live Job Progress Bar */}
                        {jobProgress && (
                            <div className="p-4 rounded-xl bg-slate-50 border border-indigo-100 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-800">
                                        {jobProgress.phase || "Extracting content..."}
                                    </span>
                                    <span className="text-xs font-extrabold text-indigo-600">
                                        {jobProgress.total > 0 ? Math.round((jobProgress.current / jobProgress.total) * 100) : 100}%
                                    </span>
                                </div>

                                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                                    <div 
                                        className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                                        style={{ width: `${jobProgress.total > 0 ? Math.round((jobProgress.current / jobProgress.total) * 100) : 100}%` }}
                                    ></div>
                                </div>

                                <p className="text-[11px] text-slate-500 font-medium">
                                    Parsed {jobProgress.current} of {jobProgress.total} pages &bull; Assembling Testpress DOCX
                                </p>
                            </div>
                        )}
                    </div>

                    {/* CARD 6: TESTPRESS DOWNLOAD SUITE */}
                    {downloadFiles && (
                        <div className="bg-emerald-50/70 rounded-2xl p-5 border border-emerald-200/90 shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                                        <Check className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-extrabold text-emerald-950 uppercase tracking-wider">
                                            Testpress LMS Download Suite
                                        </h3>
                                        <p className="text-[11px] text-emerald-700">
                                            All documents formatted to official Testpress LMS specifications.
                                        </p>
                                    </div>
                                </div>

                                <button 
                                    onClick={downloadAllFiles}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow transition flex items-center gap-1.5"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Download All (5 Files)</span>
                                </button>
                            </div>

                            {/* Download Cards Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                
                                {/* Questions DOCX */}
                                <div className="bg-white p-3.5 rounded-xl border border-emerald-200/70 shadow-sm space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">Questions</span>
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">.DOCX</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500">Testpress Word format with lowercase options <code className="text-indigo-600 font-bold">a)</code>, <code className="text-indigo-600 font-bold">b)</code>, etc.</p>
                                    <button 
                                        onClick={() => downloadBase64(downloadFiles.questions_docx, 'Questions.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')}
                                        className="w-full py-2 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition flex items-center justify-center gap-1.5"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>Questions.docx</span>
                                    </button>
                                </div>

                                {/* Questions ZIP */}
                                <div className="bg-white p-3.5 rounded-xl border border-emerald-200/70 shadow-sm space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">Question Media</span>
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">.ZIP</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500">Includes embedded question diagrams and equations for LMS bulk upload.</p>
                                    <button 
                                        onClick={() => downloadBase64(downloadFiles.questions_zip, 'Questions.zip', 'application/zip')}
                                        className="w-full py-2 px-3 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition flex items-center justify-center gap-1.5"
                                    >
                                        <FileArchive className="w-3.5 h-3.5" />
                                        <span>Questions.zip</span>
                                    </button>
                                </div>

                                {/* Explanations DOCX */}
                                <div className="bg-white p-3.5 rounded-xl border border-emerald-200/70 shadow-sm space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">Explanations</span>
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">.DOCX</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500">Unbroken contiguous paragraphs &amp; step-by-step mathematical solutions.</p>
                                    <button 
                                        onClick={() => downloadBase64(downloadFiles.explanations_docx, 'Explanations.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')}
                                        className="w-full py-2 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition flex items-center justify-center gap-1.5"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>Explanations.docx</span>
                                    </button>
                                </div>

                                {/* Explanations ZIP */}
                                <div className="bg-white p-3.5 rounded-xl border border-emerald-200/70 shadow-sm space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">Solution Media</span>
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">.ZIP</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500">High-resolution solution diagrams and graphs bundled for Testpress.</p>
                                    <button 
                                        onClick={() => downloadBase64(downloadFiles.explanations_zip, 'Explanations.zip', 'application/zip')}
                                        className="w-full py-2 px-3 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition flex items-center justify-center gap-1.5"
                                    >
                                        <FileArchive className="w-3.5 h-3.5" />
                                        <span>Explanations.zip</span>
                                    </button>
                                </div>

                            </div>

                            {/* Answers Key XLSX */}
                            <div className="bg-white p-4 rounded-xl border border-emerald-300 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                                        <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Official Answers Key Spreadsheet</span>
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">.XLSX</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-0.5">Testpress Excel matrix with lowercase answer keys (<code className="text-emerald-700 font-bold">a</code>, <code className="text-emerald-700 font-bold">b</code>, etc.), marks, and subject path.</p>
                                </div>
                                <button 
                                    onClick={() => downloadBase64(downloadFiles.answers_xlsx, 'Answers_Key.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
                                    className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow transition flex items-center justify-center gap-2 shrink-0"
                                >
                                    <Download className="w-4 h-4" />
                                    <span>Download Answers.xlsx</span>
                                </button>
                            </div>

                        </div>
                    )}

                </div>

            </div>

            {/* VISUAL MARGINS & BOUNDARY STUDIO MODAL */}
            {showMarginModal && (
                <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-700/60 w-full max-w-7xl h-[94vh] flex flex-col overflow-hidden">
                        
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30">
                                    <Crop className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                                            {activeCropMode === 'global' ? 'Visual Margin & Column Studio (All Pages)' :
                                             activeCropMode === 'q_margins' ? 'Physical Question Boundaries (Start & End Pages)' :
                                             'Physical Solution Boundaries (Start & End Pages)'}
                                        </h3>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">
                                            Live Canvas
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        {activeCropMode === 'global' ? 'Drag the red line to trim book headers (top) and page numbers/footers (bottom).' :
                                         'Drag the red line on the start page (top cut) and end page (bottom cut) to isolate target questions.'}
                                    </p>
                                </div>
                            </div>

                            <button 
                                onClick={() => setShowMarginModal(false)} 
                                className="w-9 h-9 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                            
                            {/* Left Control Sidebar */}
                            <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-slate-200 p-5 flex flex-col justify-between bg-white shrink-0 overflow-y-auto space-y-6">
                                <div className="space-y-6">
                                    
                                    {activeCropMode === 'global' ? (
                                        <>
                                            {/* Column Format Selection */}
                                            <div>
                                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                                                    Page Column Layout
                                                </label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setColumns(1)} 
                                                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-2 ${
                                                            columns === 1 
                                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow' 
                                                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                                        }`}
                                                    >
                                                        <span>1 Column</span>
                                                    </button>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setColumns(2)} 
                                                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-2 ${
                                                            columns === 2 
                                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow' 
                                                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                                        }`}
                                                    >
                                                        <span>2 Columns</span>
                                                    </button>
                                                </div>
                                                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                                                    {columns === 2 
                                                        ? 'Splits page vertically at 50%. Reads the entire left column top-to-bottom first, then right column.' 
                                                        : 'Reads entire page in standard full-width layout.'}
                                                </p>
                                            </div>

                                            {/* Top Margin (Header Exclude) */}
                                            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs font-bold text-rose-900 flex items-center gap-1">
                                                        <span>Header Trim (Top)</span>
                                                    </span>
                                                    <div className="flex items-center gap-0.5 bg-white px-2 py-0.5 rounded-md border border-rose-200">
                                                        <input 
                                                            type="number" 
                                                            step="0.1" 
                                                            min="0" 
                                                            max="40" 
                                                            value={topMargin} 
                                                            onChange={e => setTopMargin(parseFloat(e.target.value) || 0)} 
                                                            className="w-12 text-xs font-black text-rose-600 outline-none text-right bg-transparent" 
                                                        />
                                                        <span className="text-xs font-black text-rose-600">%</span>
                                                    </div>
                                                </div>
                                                <p className="text-[10px] text-rose-700 leading-tight">
                                                    Cuts top book title, chapter banners, and running headers.
                                                </p>
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
                                            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs font-bold text-rose-900 flex items-center gap-1">
                                                        <span>Footer Trim (Bottom)</span>
                                                    </span>
                                                    <div className="flex items-center gap-0.5 bg-white px-2 py-0.5 rounded-md border border-rose-200">
                                                        <input 
                                                            type="number" 
                                                            step="0.1" 
                                                            min="0" 
                                                            max="40" 
                                                            value={bottomMargin} 
                                                            onChange={e => setBottomMargin(parseFloat(e.target.value) || 0)} 
                                                            className="w-12 text-xs font-black text-rose-600 outline-none text-right bg-transparent" 
                                                        />
                                                        <span className="text-xs font-black text-rose-600">%</span>
                                                    </div>
                                                </div>
                                                <p className="text-[10px] text-rose-700 leading-tight">
                                                    Cuts page numbers, publisher footers, and website URLs.
                                                </p>
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
                                                className="w-full py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition border border-dashed border-slate-300 flex items-center justify-center gap-1.5"
                                            >
                                                <RotateCcw className="w-3.5 h-3.5" />
                                                <span>Reset Margins to 0%</span>
                                            </button>
                                        </>
                                    ) : (
                                        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-3">
                                            <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs uppercase tracking-wider">
                                                <Crop className="w-4 h-4 text-indigo-600" />
                                                <span>Physical Boundary Offsets</span>
                                            </div>
                                            <p className="text-xs text-indigo-800 leading-relaxed">
                                                Drag the red handle on the <strong>Left Image</strong> to set Start Boundary (Top Cut), and on the <strong>Right Image</strong> to set End Boundary (Bottom Cut).
                                            </p>

                                            <div className="space-y-2 pt-2">
                                                <div className="bg-white p-2.5 rounded-xl border border-indigo-100 flex items-center justify-between">
                                                    <span className="text-xs font-bold text-slate-600">Start Page Top Cut</span>
                                                    <span className="text-xs font-black text-indigo-700">
                                                        {activeCropMode === 'q_margins' ? qStartTop : sStartTop}%
                                                    </span>
                                                </div>
                                                <div className="bg-white p-2.5 rounded-xl border border-indigo-100 flex items-center justify-between">
                                                    <span className="text-xs font-bold text-slate-600">End Page Bottom Cut</span>
                                                    <span className="text-xs font-black text-indigo-700">
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
                                        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2"
                                    >
                                        <Check className="w-4 h-4" />
                                        <span>Save &amp; Apply Boundaries</span>
                                    </button>
                                </div>
                            </div>

                            {/* Right Interactive Canvas / Live Visualizer */}
                            <div className="flex-1 bg-slate-900/95 p-6 flex flex-col items-center justify-center overflow-auto relative">
                                {loadingPreview ? (
                                    <div className="flex flex-col items-center gap-3 text-slate-400">
                                        <div className="w-8 h-8 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                                        <span className="text-xs font-bold text-slate-300">Rendering high-res page preview...</span>
                                    </div>
                                ) : previewData ? (
                                    <div className="flex flex-col md:flex-row gap-8 items-start justify-center w-full max-w-5xl">
                                        
                                        {/* LEFT / START IMAGE */}
                                        <div className="flex flex-col items-center w-full">
                                            <div className="text-xs font-bold text-slate-300 mb-2.5 flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
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
                                                className="relative shadow-2xl border border-slate-700 rounded-xl overflow-hidden select-none bg-white max-h-[68vh]"
                                            >
                                                <img 
                                                    src={previewData.image} 
                                                    alt="Page Preview" 
                                                    className="max-h-[68vh] object-contain pointer-events-none block" 
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
                                                            <div className="w-28 h-3 bg-rose-600 hover:bg-rose-500 rounded-full shadow-lg border-2 border-white flex items-center justify-center transition group-hover:scale-105">
                                                                <div className="w-8 h-0.5 bg-white rounded"></div>
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
                                                            <div className="w-28 h-3 bg-rose-600 hover:bg-rose-500 rounded-full shadow-lg border-2 border-white flex items-center justify-center transition group-hover:scale-105">
                                                                <div className="w-8 h-0.5 bg-white rounded"></div>
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

                                        {/* RIGHT / END IMAGE (When in q_margins or s_margins mode) */}
                                        {['q_margins', 's_margins'].includes(activeCropMode) && previewDataEnd && (
                                            <div className="flex flex-col items-center w-full">
                                                <div className="text-xs font-bold text-slate-300 mb-2.5 flex items-center gap-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
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
                                                    className="relative shadow-2xl border border-slate-700 rounded-xl overflow-hidden select-none bg-white max-h-[68vh]"
                                                >
                                                    <img 
                                                        src={previewDataEnd.image} 
                                                        alt="Page Preview End" 
                                                        className="max-h-[68vh] object-contain pointer-events-none block" 
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
                                                        <div className="w-28 h-3 bg-rose-600 hover:bg-rose-500 rounded-full shadow-lg border-2 border-white flex items-center justify-center transition group-hover:scale-105">
                                                            <div className="w-8 h-0.5 bg-white rounded"></div>
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
