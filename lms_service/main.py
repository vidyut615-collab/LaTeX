import asyncio
import os
import re
import fitz
import pandas as pd
from docx import Document
import io
import zipfile
import base64
import json
import shutil
from math_extractor import extract_text_with_math

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Header
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Gemini SDK
from google import genai
from google.genai import types

# Local DB Module
import db

app = FastAPI(title="LMS Bulk Extractor Microservice")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Initialize Database
db.init_db()

# ---------------------------------------------------------
# AUTHENTICATION & DEPENDENCIES
# ---------------------------------------------------------
async def get_current_user(authorization: str = Header(None), x_session_token: str = Header(None)):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
    elif x_session_token:
        token = x_session_token
        
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
        
    user = db.get_user_by_session(token)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired or invalid. Please login again.")
    return user

async def require_super_admin(user: dict = Depends(get_current_user)):
    if user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin privileges required")
    return user

# ---------------------------------------------------------
# FIXED LOGIC SAFETY NET: Python Regex to Enforce \over 
# ---------------------------------------------------------
def enforce_lms_tex(text):
    if not text: return ""
    prev_text = ""
    while r'\frac{' in text and text != prev_text:
        prev_text = text
        text = re.sub(r'\\frac\{([^{}]+)\}\{([^{}]+)\}', r'{\1 \\over \2}', text)
    return text

def sanitize_dict(d):
    if isinstance(d, str):
        return enforce_lms_tex(d)
    elif isinstance(d, dict):
        return {k: sanitize_dict(v) for k, v in d.items()}
    elif isinstance(d, list):
        return [sanitize_dict(v) for v in d]
    return d

# ---------------------------------------------------------
# GEMINI 2.0 FLASH EXTRACTOR (With Token Usage Capture)
# ---------------------------------------------------------

GEMINI_SEMAPHORE = asyncio.Semaphore(3)

async def extract_with_gemini_async(img_bytes: bytes, api_key: str, mode: str, model_name: str):
    client = genai.Client(api_key=api_key)
    
    if mode == "questions":
        schema = types.Schema(
            type=types.Type.ARRAY,
            items=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "num": types.Schema(type=types.Type.STRING),
                    "text": types.Schema(type=types.Type.STRING),
                    "options": types.Schema(
                        type=types.Type.OBJECT,
                        properties={"a": types.Schema(type=types.Type.STRING), "b": types.Schema(type=types.Type.STRING), "c": types.Schema(type=types.Type.STRING), "d": types.Schema(type=types.Type.STRING), "e": types.Schema(type=types.Type.STRING)}
                    )
                },
                required=["num", "text"]
            )
        )
        prompt = """You are a strict data extractor for an LMS. Extract all questions from this page image.
CRITICAL FORMATTING RULE: 
You MUST format all math using plain TeX.
- NEVER use modern \frac{a}{b} for fractions.
- You MUST format fractions using \over like this: {a \over b}
- Example: The quadratic formula must be written as x = {-b \pm \sqrt{b^2-4ac} \over 2a}"""
    else:
        schema = types.Schema(
            type=types.Type.ARRAY,
            items=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "num": types.Schema(type=types.Type.STRING),
                    "correct": types.Schema(type=types.Type.STRING),
                    "explanation": types.Schema(type=types.Type.STRING)
                },
                required=["num", "correct", "explanation"]
            )
        )
        prompt = """You are a strict data extractor for an LMS. Extract all solutions/explanations from this page image.
CRITICAL FORMATTING RULE: 
You MUST format all math using plain TeX.
- NEVER use modern \frac{a}{b} for fractions.
- You MUST format fractions using \over like this: {a \over b}
- Example: The quadratic formula must be written as x = {-b \pm \sqrt{b^2-4ac} \over 2a}"""

    tokens = {"input": 0, "output": 0, "total": 0}
    max_retries = 4
    
    for attempt in range(max_retries):
        try:
            async with GEMINI_SEMAPHORE:
                if attempt > 0:
                    await asyncio.sleep(4)
                    
                response = await client.aio.models.generate_content(
                    model=model_name,
                    contents=[
                        types.Part.from_bytes(data=img_bytes, mime_type='image/png'),
                        prompt
                    ],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=schema,
                        temperature=0.0
                    )
                )
                
            if hasattr(response, 'usage_metadata') and response.usage_metadata:
                tokens["input"] = response.usage_metadata.prompt_token_count or 0
                tokens["output"] = response.usage_metadata.candidates_token_count or 0
                tokens["total"] = response.usage_metadata.total_token_count or 0
                
            import json
            data = json.loads(response.text)
            return data, tokens
            
        except Exception as e:
            err_str = str(e).lower()
            if "429" in err_str or "quota" in err_str or "too many" in err_str:
                if attempt < max_retries - 1:
                    print(f"Rate limit hit (Attempt {attempt+1}). Retrying...")
                    await asyncio.sleep(5 + (attempt * 3))
                    continue
            print(f"Gemini API Error: {e}")
            return [], tokens
            
    return [], tokens

def extract_with_gemini(page, api_key: str, mode: str, model_name: str):
    client = genai.Client(api_key=api_key)
    
    if mode == "questions":
        schema = types.Schema(
            type=types.Type.ARRAY,
            items=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "num": types.Schema(type=types.Type.STRING),
                    "text": types.Schema(type=types.Type.STRING),
                    "options": types.Schema(
                        type=types.Type.OBJECT,
                        properties={
                            "a": types.Schema(type=types.Type.STRING),
                            "b": types.Schema(type=types.Type.STRING),
                            "c": types.Schema(type=types.Type.STRING),
                            "d": types.Schema(type=types.Type.STRING),
                            "e": types.Schema(type=types.Type.STRING),
                        }
                    )
                },
                required=["num", "text"]
            )
        )
        prompt = """You are a strict data extractor for an LMS. Extract all questions from this page image.
CRITICAL FORMATTING RULE: 
You MUST format all math using plain TeX.
- NEVER use modern \frac{a}{b} for fractions.
- You MUST format fractions using \over like this: {a \over b}
- Example: The quadratic formula must be written as x = {-b \pm \sqrt{b^2-4ac} \over 2a}
"""
    else:
        schema = types.Schema(
            type=types.Type.ARRAY,
            items=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "num": types.Schema(type=types.Type.STRING),
                    "correct": types.Schema(type=types.Type.STRING),
                    "explanation": types.Schema(type=types.Type.STRING)
                },
                required=["num", "correct", "explanation"]
            )
        )
        prompt = """You are a strict data extractor for an LMS. Extract all solutions/explanations from this page image.
CRITICAL FORMATTING RULE: 
You MUST format all math using plain TeX.
- NEVER use modern \frac{a}{b} for fractions.
- You MUST format fractions using \over like this: {a \over b}
- Example: The quadratic formula must be written as x = {-b \pm \sqrt{b^2-4ac} \over 2a}
"""

    pix = page.get_pixmap()
    img_bytes = pix.tobytes("png")
    
    tokens = {"input": 0, "output": 0, "total": 0}
    try:
        response = client.models.generate_content(
            model=model_name,
            contents=[
                types.Part.from_bytes(data=img_bytes, mime_type='image/png'),
                prompt
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=schema,
                temperature=0.0
            )
        )
        
        # Capture exact token usage from Google's response metadata
        if hasattr(response, 'usage_metadata') and response.usage_metadata:
            tokens["input"] = response.usage_metadata.prompt_token_count or 0
            tokens["output"] = response.usage_metadata.candidates_token_count or 0
            tokens["total"] = response.usage_metadata.total_token_count or 0
            
        data = json.loads(response.text)
        return sanitize_dict(data), tokens
    except Exception as e:
        print(f"Gemini API Error: {e}")
        return [], tokens

# ---------------------------------------------------------
# GROQ VISION EXTRACTOR
# ---------------------------------------------------------
def extract_with_groq(page, api_key: str, mode: str, model_name: str):
    import base64
    import json
    import httpx
    import time
    import re
    
    pix = page.get_pixmap()
    img_bytes = pix.tobytes("png")
    b64_img = base64.b64encode(img_bytes).decode('utf-8')
    
    if mode == "questions":
        prompt = """You are a strict data extractor for an LMS. Extract all questions from this page image.
CRITICAL FORMATTING RULE: 
You MUST format all math using plain TeX. NEVER use modern \\frac{a}{b} for fractions. You MUST format fractions using \\over like this: {a \\over b}.

You MUST return a JSON object with a single key "data", which contains an array of objects.
Each object must have:
- "num" (string): The question number.
- "text" (string): The question text.
- "options" (object): The answer options, keys must be "a", "b", "c", "d", etc.
"""
    else:
        prompt = """You are a strict data extractor for an LMS. Extract all solutions/explanations from this page image.
CRITICAL FORMATTING RULE: 
You MUST format all math using plain TeX. NEVER use modern \\frac{a}{b} for fractions. You MUST format fractions using \\over like this: {a \\over b}.

You MUST return a JSON object with a single key "data", which contains an array of objects.
Each object must have:
- "num" (string): The solution number.
- "correct" (string): The correct option letter.
- "explanation" (string): The explanation text.
"""

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": model_name,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": prompt
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{b64_img}"
                        }
                    }
                ]
            }
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.01
    }
    
    tokens = {"input": 0, "output": 0, "total": 0}
    max_retries = 3
    
    for attempt in range(max_retries):
        try:
            if attempt > 0:
                time.sleep(4)
                
            with httpx.Client(timeout=120.0) as client:
                resp = client.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
                
            resp.raise_for_status()
            data_json = resp.json()
            
            usage = data_json.get("usage", {})
            tokens["input"] = usage.get("prompt_tokens", 0)
            tokens["output"] = usage.get("completion_tokens", 0)
            tokens["total"] = usage.get("total_tokens", 0)
            
            content_str = data_json["choices"][0]["message"]["content"]
            
            match = re.search(r'```(?:json)?(.*?)```', content_str, re.DOTALL)
            if match:
                content_str = match.group(1).strip()
                
            parsed = json.loads(content_str)
            return sanitize_dict(parsed.get("data", [])), tokens
            
        except Exception as e:
            err_str = str(e).lower()
            if "429" in err_str or "quota" in err_str or "too many" in err_str:
                if attempt < max_retries - 1:
                    print(f"Groq Rate limit hit (Attempt {attempt+1}). Retrying...")
                    continue
            print(f"Groq API Error: {e}")
            if hasattr(e, 'response'):
                print("Response:", e.response.text)
            
    return [], tokens

# ---------------------------------------------------------
# PURE PYTHON HELPERS
# ---------------------------------------------------------
def is_complex_content(page):
    if len(page.get_images()) > 0 or len(page.get_drawings()) > 0:
        return True
    text = page.get_text("text")
    math_symbols = ['√', '÷', '∫', '∑', '±', 'θ', 'π', '^', '≤', '≥']
    return any(sym in text for sym in math_symbols)

def parse_questions_python(text):
    blocks = re.split(r'\n(?=\d+\))', text)
    questions = []
    for block in blocks:
        block = block.strip()
        if not block: continue
        match = re.match(r'^(\d+)\)\s+([\s\S]+)', block)
        if match:
            q_num, content = match.group(1), match.group(2)
            opt_matches = list(re.finditer(r'([a-e])\)\s+([\s\S]*?)(?=(?:[a-e]\))|\Z)', content))
            options = {}
            q_text = content
            if opt_matches:
                q_text = content[:opt_matches[0].start()]
                for m in opt_matches:
                    options[m.group(1)] = m.group(2).strip()
            questions.append({'num': q_num, 'text': q_text.strip(), 'options': options})
    return questions

def parse_solutions_python(text):
    blocks = re.split(r'\n(?=\d+\.\s+Option\s+[A-E])', text, flags=re.IGNORECASE)
    solutions = []
    for block in blocks:
        block = block.strip()
        if not block: continue
        match = re.match(r'^(\d+)\.\s+Option\s+([A-E])([\s\S]*)', block, re.IGNORECASE)
        if match:
            solutions.append({
                'num': match.group(1), 
                'correct': match.group(2).upper(), 
                'explanation': match.group(3).strip()
            })
    return solutions

# ---------------------------------------------------------
# AUTH ENDPOINTS
# ---------------------------------------------------------
class UpdatePasswordRequest(BaseModel):
    new_password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class CreateUserRequest(BaseModel):
    name: str
    username: str
    password: str

class SettingRequest(BaseModel):
    gemini_api_key: str = ""
    groq_api_key: str = ""
    gemini_model: str = ""
    groq_model: str = ""
    active_ai_provider: str = "gemini"

@app.get("/api/auth/status")
async def auth_status(authorization: str = Header(None), x_session_token: str = Header(None)):
    has_admin = db.has_super_admin()
    token = authorization.split(" ")[1] if authorization and authorization.startswith("Bearer ") else x_session_token
    user = db.get_user_by_session(token) if token else None
    return {
        "has_super_admin": has_admin,
        "authenticated": user is not None,
        "user": user
    }

@app.post("/api/auth/login")
async def login(req: LoginRequest):
    user = db.authenticate_user(req.username, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username/ID or password")
    token = db.create_session(user["id"])
    return {
        "token": token, 
        "user": {"id": user["id"], "name": user["name"], "username": user["username"], "role": user["role"]}
    }

@app.post("/api/auth/logout")
async def logout(user: dict = Depends(get_current_user), authorization: str = Header(None), x_session_token: str = Header(None)):
    token = authorization.split(" ")[1] if authorization and authorization.startswith("Bearer ") else x_session_token
    if token:
        db.delete_session(token)
    return {"message": "Logged out successfully"}

# ---------------------------------------------------------
# SUPER ADMIN ENDPOINTS
# ---------------------------------------------------------
@app.get("/api/admin/users")
async def get_users(admin: dict = Depends(require_super_admin)):
    return db.list_all_users()

@app.post("/api/admin/users")
async def add_user(req: CreateUserRequest, admin: dict = Depends(require_super_admin)):
    try:
        user = db.create_user(req.name, req.username, req.password, role="user")
        return user
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not create user: {e}")

@app.delete("/api/admin/users/{user_id}")
async def delete_user(user_id: int, admin: dict = Depends(require_super_admin)):
    try:
        db.delete_user_by_id(user_id)
        return {"message": "User deleted successfully"}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

@app.put("/api/admin/users/{user_id}/password")
async def update_user_password(user_id: int, req: UpdatePasswordRequest, admin: dict = Depends(require_super_admin)):
    try:
        db.update_user_password(user_id, req.new_password)
        return {"message": "Password updated successfully"}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

@app.get("/api/admin/settings")
async def get_settings(admin: dict = Depends(require_super_admin)):
    g_key = db.get_setting("gemini_api_key") or ""
    groq_key = db.get_setting("groq_api_key") or ""
    provider = db.get_setting("active_ai_provider") or "gemini"
    g_model = db.get_setting("gemini_model") or "gemini-2.5-flash-lite"
    groq_model = "qwen/qwen3.8-27b"
    
    g_masked = f"{g_key[:6]}...{g_key[-4:]}" if len(g_key) > 10 else ("Configured" if g_key else "")
    groq_masked = f"{groq_key[:6]}...{groq_key[-4:]}" if len(groq_key) > 10 else ("Configured" if groq_key else "")
    
    return {
        "gemini_configured": bool(g_key),
        "gemini_preview": g_masked,
        "gemini_full_key": g_key,
        "groq_configured": bool(groq_key),
        "groq_preview": groq_masked,
        "groq_full_key": groq_key,
        "gemini_model": g_model,
        "groq_model": groq_model,
        "active_ai_provider": provider
    }

@app.post("/api/admin/settings")
async def save_settings(req: SettingRequest, admin: dict = Depends(require_super_admin)):
    if req.gemini_api_key.strip():
        db.set_setting("gemini_api_key", req.gemini_api_key.strip())
    if req.groq_api_key.strip():
        db.set_setting("groq_api_key", req.groq_api_key.strip())
        
    db.set_setting("active_ai_provider", req.active_ai_provider)
    if req.gemini_model:
        db.set_setting("gemini_model", req.gemini_model)
    db.set_setting("groq_model", "qwen/qwen3.8-27b")
        
    return {"message": "Settings saved successfully."}


@app.post("/api/admin/test-model")
async def test_model(
    file: UploadFile = File(...),
    mode: str = Form(...),
    admin: dict = Depends(require_super_admin)
):
    provider = db.get_setting("active_ai_provider") or "gemini"
    if provider == "groq":
        model_name = "qwen/qwen3.8-27b"
    else:
        model_name = db.get_setting("gemini_model") or "gemini-2.5-flash-lite"
    img_bytes = await file.read()
    
    # We need a dummy fitz Document/Page object wrapper since our extract functions expect a `page` with `get_pixmap()`
    # Let's write a quick mock class for the image bytes, or since we are testing, we can just use fitz to open the image.
    try:
        doc = fitz.open(stream=img_bytes, filetype=file.filename.split('.')[-1] if '.' in file.filename else 'png')
        page = doc[0]
        
        if provider == "groq":
            api_key = db.get_setting("groq_api_key")
            if not api_key:
                raise HTTPException(status_code=400, detail="Groq API Key not configured")
            data, tokens = extract_with_groq(page, api_key, mode, model_name)
        else:
            api_key = db.get_setting("gemini_api_key")
            if not api_key:
                raise HTTPException(status_code=400, detail="Gemini API Key not configured")
            data, tokens = extract_with_gemini(page, api_key, mode, model_name)
            
        return {"data": data, "tokens": tokens}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/admin/models")
async def list_available_models(admin: dict = Depends(require_super_admin)):
    api_key = db.get_setting("gemini_api_key")
    if not api_key:
        raise HTTPException(status_code=400, detail="API Key not configured yet")
    try:
        client = genai.Client(api_key=api_key)
        models = []
        for m in client.models.list():
            actions = getattr(m, 'supported_actions', [])
            if actions and 'generateContent' in actions and m.name.startswith('models/gemini'):
                models.append({
                    "name": m.name.replace('models/', ''),
                    "display_name": getattr(m, 'display_name', m.name),
                    "description": getattr(m, 'description', '')
                })
        return models
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/admin/logs")
async def get_logs(admin: dict = Depends(require_super_admin)):
    return db.get_recent_logs(limit=100)

def get_page_text_with_layout(page, top_margin_pct: float, bottom_margin_pct: float, columns: int, engine: str = 'python'):
    rect = page.rect
    h = rect.height
    w = rect.width
    top_pct = max(0.0, min(float(top_margin_pct or 0), 100.0))
    bottom_pct = max(0.0, min(float(bottom_margin_pct or 0), 100.0))
    
    y0 = rect.y0 + h * (top_pct / 100.0)
    y1 = rect.y1 - h * (bottom_pct / 100.0)
    
    if int(columns or 1) == 2:
        left_crop = fitz.Rect(rect.x0, y0, rect.x0 + w * 0.5, y1)
        right_crop = fitz.Rect(rect.x0 + w * 0.5, y0, rect.x1, y1)
        if engine == 'python':
            return page.get_text("text", clip=left_crop) + "\n" + page.get_text("text", clip=right_crop)
        else:
            return extract_text_with_math(page, clip=left_crop) + "\n" + extract_text_with_math(page, clip=right_crop)
    else:
        crop = fitz.Rect(rect.x0, y0, rect.x1, y1)
        if engine == 'python':
            return page.get_text("text", clip=crop)
        else:
            return extract_text_with_math(page, clip=crop)

# ---------------------------------------------------------
# EXTRACTION & PRE-FLIGHT
# ---------------------------------------------------------
@app.post("/api/extract/preview-page")
async def preview_page(
    file: UploadFile = File(...),
    page_num: int = Form(...),
    current_user: dict = Depends(get_current_user)
):
    pdf_bytes = await file.read()
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    if page_num < 1 or page_num > len(doc):
        raise HTTPException(status_code=400, detail="Page number out of range.")
    
    page = doc[page_num - 1]
    pix = page.get_pixmap(dpi=120)
    img_bytes = pix.tobytes("png")
    img_b64 = base64.b64encode(img_bytes).decode('utf-8')
    
    return {
        "image": f"data:image/png;base64,{img_b64}",
        "width": pix.width,
        "height": pix.height,
        "page_num": page_num,
        "total_pages": len(doc)
    }

@app.post("/api/validate")
async def validate_pdf(
    file: UploadFile = File(...), 
    q_start: int = Form(...), 
    q_end: int = Form(...),
    s_start: int = Form(...),
    s_end: int = Form(...),
    q_index_start: int = Form(1),
    q_index_end: int = Form(50),
    s_index_start: int = Form(1),
    s_index_end: int = Form(50),
    top_margin_pct: float = Form(0.0),
    bottom_margin_pct: float = Form(0.0),
    columns: int = Form(1),
    current_user: dict = Depends(get_current_user)
):
    pdf_bytes = await file.read()
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    
    q_text = ""
    for i in range(q_start - 1, min(q_end, len(doc))):
        q_text += get_page_text_with_layout(doc[i], top_margin_pct, bottom_margin_pct, columns) + "\n"
        
    s_text = ""
    for i in range(s_start - 1, min(s_end, len(doc))):
        s_text += get_page_text_with_layout(doc[i], top_margin_pct, bottom_margin_pct, columns) + "\n"
        
    questions = parse_questions_python(q_text)
    solutions = parse_solutions_python(s_text)
    
    # Normalize question numbers (strip non-digits)
    def normalize_num(n):
        return re.sub(r'[^0-9]', '', str(n))
    
    q_indexes = sorted(set(int(normalize_num(q['num'])) for q in questions if normalize_num(q['num'])))
    s_indexes = sorted(set(int(normalize_num(s['num'])) for s in solutions if normalize_num(s['num'])))
    
    # Build expected ranges from user input
    expected_q = set(range(q_index_start, q_index_end + 1))
    expected_s = set(range(s_index_start, s_index_end + 1))
    
    q_found = set(q_indexes)
    s_found = set(s_indexes)
    
    q_missing = sorted(expected_q - q_found)
    s_missing = sorted(expected_s - s_found)
    q_extra = sorted(q_found - expected_q)
    s_extra = sorted(s_found - expected_s)
    
    q_info = {
        "first": q_indexes[0] if q_indexes else None,
        "last": q_indexes[-1] if q_indexes else None,
        "total": len(q_indexes),
        "expected": q_index_end - q_index_start + 1,
        "missing": q_missing,
        "extra": q_extra
    }
    
    s_info = {
        "first": s_indexes[0] if s_indexes else None,
        "last": s_indexes[-1] if s_indexes else None,
        "total": len(s_indexes),
        "expected": s_index_end - s_index_start + 1,
        "missing": s_missing,
        "extra": s_extra
    }
    
    match = (len(q_missing) == 0) and \
            (len(s_missing) == 0) and \
            (q_info["total"] == q_info["expected"]) and \
            (s_info["total"] == s_info["expected"])
            
    return JSONResponse({
        "q_valid": q_info["total"] > 0, 
        "s_valid": s_info["total"] > 0, 
        "q_info": q_info,
        "s_info": s_info,
        "match": match
    })



@app.post("/api/extract")
async def extract_pdf(
    file: UploadFile = File(...),
    q_start: int = Form(...), q_end: int = Form(...),
    s_start: int = Form(...), s_end: int = Form(...),
    q_index_start: int = Form(1), q_index_end: int = Form(50),
    s_index_start: int = Form(1), s_index_end: int = Form(50),
    engine: str = Form(...),
    subject: str = Form(...), marks: float = Form(...),
    negative: float = Form(...), difficulty: str = Form(...), q_type: str = Form(...),
    top_margin_pct: float = Form(0.0),
    bottom_margin_pct: float = Form(0.0),
    columns: int = Form(1),
    q_start_top: float = Form(0.0),
    q_end_bottom: float = Form(0.0),
    s_start_top: float = Form(0.0),
    s_end_bottom: float = Form(0.0),
    current_user: dict = Depends(get_current_user)
):
    pdf_bytes = await file.read()
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    questions = []
    solutions = []
    
    # Normalize the Subject formatting to "A > B > C" without trailing spaces
    if ">" in subject:
        subject = " > ".join([part.strip() for part in subject.split(">")])
    else:
        subject = subject.strip()
    
    # Check AI Provider Settings from secure system settings
    api_key = None
    model_name = "gemini-2.5-flash-lite"
    provider = "gemini"
    
    if engine == 'dynamic':
        provider = db.get_setting("active_ai_provider") or "gemini"
        
        if provider == "groq":
            model_name = "qwen/qwen3.8-27b"
            api_key = db.get_setting("groq_api_key")
            if not api_key:
                raise HTTPException(
                    status_code=400, 
                    detail="Groq API Key is not configured yet. Please ask the Super Admin to add the key in Settings."
                )
        else:
            model_name = db.get_setting("gemini_model") or "gemini-2.5-flash-lite"
            api_key = db.get_setting("gemini_api_key")
            if not api_key:
                raise HTTPException(
                    status_code=400, 
                    detail="Gemini API Key is not configured yet. Please ask the Super Admin to add the key in Settings."
                )
    
    # Token Tracking Accumulators
    total_input_tokens = 0
    total_output_tokens = 0
    pages_processed_ai = 0
    
    # 1. EXTRACT QUESTIONS
    q_text_buffer = ""
    for i in range(q_start - 1, q_end):
        if i >= len(doc): break
        page = doc[i]
        
        # Physical Boundary Cropping
        page_top = top_margin_pct
        page_bottom = bottom_margin_pct
        
        if i == q_start - 1 and q_start_top > 0:
            page_top = max(page_top, q_start_top)
            
        if i == q_end - 1 and q_end_bottom > 0:
            page_bottom = max(page_bottom, q_end_bottom)
                
        if engine == 'dynamic' and is_complex_content(page):
            if q_text_buffer.strip():
                questions.extend(parse_questions_python(q_text_buffer))
                q_text_buffer = ""
            
            if provider == "groq":
                ai_qs, tokens = extract_with_groq(page, api_key, "questions", model_name)
            else:
                ai_qs, tokens = extract_with_gemini(page, api_key, "questions", model_name)
                
            questions.extend(ai_qs)
            total_input_tokens += tokens["input"]
            total_output_tokens += tokens["output"]
            pages_processed_ai += 1
        else:
            q_text_buffer += get_page_text_with_layout(page, page_top, page_bottom, columns, engine) + "\n"
    if q_text_buffer.strip():
        questions.extend(parse_questions_python(q_text_buffer))

    # 2. EXTRACT SOLUTIONS
    s_text_buffer = ""
    for i in range(s_start - 1, s_end):
        if i >= len(doc): break
        page = doc[i]
        
        # Physical Boundary Cropping
        page_top = top_margin_pct
        page_bottom = bottom_margin_pct
        
        if i == s_start - 1 and s_start_top > 0:
            page_top = max(page_top, s_start_top)
            
        if i == s_end - 1 and s_end_bottom > 0:
            page_bottom = max(page_bottom, s_end_bottom)
                
        if engine == 'dynamic' and is_complex_content(page):
            if s_text_buffer.strip():
                solutions.extend(parse_solutions_python(s_text_buffer))
                s_text_buffer = ""
                
            if provider == "groq":
                ai_sols, tokens = extract_with_groq(page, api_key, "solutions", model_name)
            else:
                ai_sols, tokens = extract_with_gemini(page, api_key, "solutions", model_name)
                
            solutions.extend(ai_sols)
            total_input_tokens += tokens["input"]
            total_output_tokens += tokens["output"]
            pages_processed_ai += 1
        else:
            s_text_buffer += get_page_text_with_layout(page, page_top, page_bottom, columns, engine) + "\n"
    if s_text_buffer.strip():
        solutions.extend(parse_solutions_python(s_text_buffer))
    
    # =====================================================
    # POST-EXTRACTION: Normalize, Merge, Deduplicate
    # =====================================================
    def normalize_num(n):
        return re.sub(r'[^0-9]', '', str(n))
    
    # 1. Normalize all question/solution numbers
    for q in questions:
        q['num'] = normalize_num(q['num']) or q['num']
    for s in solutions:
        s['num'] = normalize_num(s['num']) or s['num']
    
    # 2. Deduplicate: If the same question number appears twice 
    #    (cross-page split), merge the second into the first
    seen_q = {}
    merged_questions = []
    for q in questions:
        if q['num'] in seen_q:
            # Merge: append text, merge options
            existing = seen_q[q['num']]
            if q.get('text') and not existing.get('options'):
                existing['text'] += ' ' + q['text']
            if q.get('options'):
                existing.setdefault('options', {}).update(q['options'])
        else:
            seen_q[q['num']] = q
            merged_questions.append(q)
    questions = merged_questions
    
    seen_s = {}
    merged_solutions = []
    for s in solutions:
        if s['num'] in seen_s:
            existing = seen_s[s['num']]
            if s.get('explanation'):
                existing['explanation'] = (existing.get('explanation', '') + ' ' + s['explanation']).strip()
        else:
            seen_s[s['num']] = s
            merged_solutions.append(s)
    solutions = merged_solutions
    
    # 3. Filter to only the expected index range
    expected_q_nums = set(str(i) for i in range(q_index_start, q_index_end + 1))
    expected_s_nums = set(str(i) for i in range(s_index_start, s_index_end + 1))
    questions = [q for q in questions if q['num'] in expected_q_nums]
    solutions = [s for s in solutions if s['num'] in expected_s_nums]
    
    # 4. Build the mapping
    sol_map = {str(s['num']): s for s in solutions}
    
    # Save Audit Log if Dynamic Engine was used
    if engine == 'dynamic':
        total_tokens = total_input_tokens + total_output_tokens
        # Gemini 2.0 Flash pricing: $0.10 / 1M input, $0.40 / 1M output
        cost = (total_input_tokens * 0.10 / 1_000_000) + (total_output_tokens * 0.40 / 1_000_000)
        db.add_extraction_log(
            user_id=current_user["id"],
            user_name=current_user["name"],
            pdf_name=file.filename or "uploaded.pdf",
            engine="dynamic",
            model_used=model_name,
            pages_count=pages_processed_ai,
            input_tokens=total_input_tokens,
            output_tokens=total_output_tokens,
            total_tokens=total_tokens,
            cost=round(cost, 6)
        )
    
    # 1. Generate DOCX
    doc_q = Document()
    for q in questions:
        doc_q.add_paragraph(f"Q.{q['num']}) {q['text']}")
        for opt_letter, opt_text in q.get('options', {}).items():
            doc_q.add_paragraph(f"{opt_letter}) {opt_text}")
        doc_q.add_paragraph("")
    q_io = io.BytesIO()
    doc_q.save(q_io)
    q_io.seek(0)
    
    doc_e = Document()
    for s in solutions:
        doc_e.add_paragraph(f"Q.{s['num']}) {s['explanation']}")
        doc_e.add_paragraph("")
    e_io = io.BytesIO()
    doc_e.save(e_io)
    e_io.seek(0)
    
    # 2. Generate HTML + ZIP
    word_html_template = """<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta http-equiv=Content-Type content="text/html; charset=utf-8"><meta name=ProgId content=Word.Document></head><body lang=EN-US><div class=WordSection1>\n{content}\n</div></body></html>"""

    q_content = ""
    for q in questions:
        q_content += f"<p><b>Q.{q['num']})</b> {q['text']}</p>\n"
        for opt_letter, opt_text in q.get('options', {}).items():
            q_content += f"<p>{opt_letter}) {opt_text}</p>\n"
        q_content += "<br/>\n"
    q_html = word_html_template.format(content=q_content)
    
    e_content = ""
    for s in solutions:
        e_content += f"<p><b>Q.{s['num']})</b> {s['explanation']}</p>\n<br/>\n"
    e_html = word_html_template.format(content=e_content)
    
    q_zip_io = io.BytesIO()
    with zipfile.ZipFile(q_zip_io, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("Questions.htm", q_html.encode('utf-8'))
    q_zip_io.seek(0)

    e_zip_io = io.BytesIO()
    with zipfile.ZipFile(e_zip_io, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("Explanations.htm", e_html.encode('utf-8'))
    e_zip_io.seek(0)
    
    # 3. Generate Excel
    data = []
    for q in questions:
        correct_ans = sol_map.get(str(q['num']), {}).get('correct', '')
        data.append({
            'Question Number': q['num'],
            'Correct Answer(s)': correct_ans,
            'Subject': subject,
            'Marks': marks,
            'Negative Marks': negative,
            'Type': q_type,
            'Difficulty Level': difficulty,
            'Percentage Correct': '', 'Case Sensitive': 'No', 'Partial Marks': '',
            'Accepted Error': '', 'Bonus Question': 'No', 'Tags': '', 'Adaptive Difficulty Level': ''
        })
    df = pd.DataFrame(data)
    x_io = io.BytesIO()
    df.to_excel(x_io, index=False)
    x_io.seek(0)
    
    return JSONResponse({
        "files": {
            "questions_docx": base64.b64encode(q_io.read()).decode('utf-8'),
            "questions_zip": base64.b64encode(q_zip_io.read()).decode('utf-8'),
            "explanations_docx": base64.b64encode(e_io.read()).decode('utf-8'),
            "explanations_zip": base64.b64encode(e_zip_io.read()).decode('utf-8'),
            "answers_xlsx": base64.b64encode(x_io.read()).decode('utf-8')
        },
        "preview": data
    })

app.mount("/", StaticFiles(directory="static", html=True), name="static")
