import html
import re
import asyncio
import os
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

def extract_with_gemini(page, api_key: str, mode: str, model_name: str, page_top: float = 0.0, page_bottom: float = 1.0, columns: int = 1):
    from google import genai
    from google.genai import types
    import json
    
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
                        properties={k: types.Schema(type=types.Type.STRING) for k in ["a","b","c","d","e"]},
                    )
                },
                required=["num", "text"]
            )
        )
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

    if mode == "questions":
        prompt = lines_cache.get('gemini_q_prompt', """You are a strict data extractor for an LMS. Extract all questions from this page image.

CRITICAL RULES:
1. CLEAN MATHEMATICAL TYPOGRAPHY (NO LATEX, NO PROGRAMMING CODE):
   - Multiplication: Use the actual multiplication symbol `×` (e.g., `(3/4 × 100)%`). NEVER use `*` or algebra letter `x`.
   - Roots: Use `√` (e.g., `√x`, `√(b² - 4ac)`). NEVER use `sqrt()`.
   - Powers / Exponents: Use unicode superscripts (e.g., `x²`, `y³`).
   - Mixed Fractions: Write mixed fractions with a space (e.g., `93 1/3%` or `93 ⅓%`), not `93(1/3)%`.
   - Fractions: Write clean `(a + b) / c` without excessive nested parentheses.

2. OPTION EXTRACTION: Extract ALL answer options exactly as printed. Do NOT skip any options.
   - Universal Mapping: If the book uses numbers (1,2,3,4), lowercase (a,b,c,d), or roman numerals (i,ii,iii,iv), you MUST map them to standard capital letters: 1st option = "a", 2nd = "b", 3rd = "c", 4th = "d", 5th = "e".
   - If an option is genuinely missing from the page, leave it out. Do NOT fabricate option text.

3. DIRECTIONS vs PUZZLES:
   - Standard directions (e.g. "Mark A if only conclusion I follows") are NOT questions. IGNORE them.
   - Passages, puzzles, or data sets (e.g. seating arrangements, series) MUST be included in the `text` field of EVERY question that depends on them.

Return a JSON array of objects. Each object must have:
- "num": the question number as a string
- "text": the full question text
- "options": an object with keys "a", "b", "c", "d", etc.
""")
    else:
        prompt = lines_cache.get('gemini_s_prompt', """You are a strict data transcriber for an LMS. Extract the solutions/explanations exactly as they appear in this page image without adding conversational filler or rewriting them.

CRITICAL RULES:
1. CLEAN MATHEMATICAL TYPOGRAPHY (NO LATEX, NO PROGRAMMING CODE):
   Write mathematics using standard mathematical symbols, NOT programming code:
   - Multiplication: Use the actual multiplication symbol `×` (e.g., `(3/4 × 100)%`). NEVER use `*` or the letter `x`.
   - Roots: Use `√` (e.g., `√x`, `√(b² - 4ac)`). NEVER use `sqrt()`.
   - Powers / Exponents: Use unicode superscripts where applicable (e.g., `x²`, `(260)²`, `y³`).
   - Deduction Arrow: Use the clean mathematical implication arrow `⇒` (e.g., `10 - x = 4.20 ⇒ x = 5.8`). NEVER use `=>`.
   - Mixed Fractions: Write mixed fractions clearly with a space (e.g., `93 1/3%` or `93 ⅓%`). Do NOT write `93(1/3)%`.
   - Division / Fractions: Write simple fractions as `a / b` or `a/b`. Only use parentheses where mathematically necessary for grouping (e.g., `(100 + 84) / 200 × 100%`). Avoid unnecessary nested parentheses like `(((a / b) * c))`.

2. PURE MATHEMATICAL TRANSCRIPTION (NO TUTORING):
   Do not explain the math in conversational English words (e.g., do NOT write "First, perform the multiplication...", "Next, divide...").
   Output only the plain mathematical steps exactly as printed in the book. Only include English words if they are literally printed on the page. Never correct the book's math; transcribe it exactly.

3. STEP-BY-STEP VERTICAL FLOW (ONE STEP PER LINE):
   Each mathematical deduction or step MUST be placed on its own separate line using double line breaks (\n\n).
   Do NOT chain multiple calculation steps together on a single line with `⇒`.
   Example format:
   Let 36% of 245 - 40% of 210 = 10 - x

   (36/100 × 245) - (40/100 × 210) = 10 - x

   ⇒ 88.20 - 84 = 10 - x

   ⇒ 10 - x = 4.20

   ⇒ x = 5.8

4. TABLES IN SOLUTIONS:
   If a solution contains a table, transcribe it as a clean markdown table using pipes `|`:
   Subjects | Total Marks | Marks Obtained
   Mathematics | 100 | 100
   Science | 100 | 84

5. CAREFUL OPTION EXTRACTION & MAPPING:
   - Universal Mapping: Regardless of how options are labeled in the book (e.g., numbers 1-4, lowercase a-d, roman numerals, or alternate letters), you MUST translate the correct answer to standard capital letters (A, B, C, D, E) based on sequence. The 1st option is A, 2nd is B, 3rd is C, 4th is D, 5th is E.
   - No Hallucination: If the correct option is genuinely NOT printed anywhere in the text, leave the `correct` field blank `""`. DO NOT guess or hallucinate an answer.

6. FINAL ANSWER:
   Always state the final conclusion clearly on the very last line of the explanation (e.g., "Final Answer: Option B").

7. CLEAN EXPLANATIONS:
   Do not include unnecessary headers from the book. If the text explains a diagram or puzzle, capture the logical explanation perfectly in text, but do not invent extra mathematical steps that aren't printed on the page.
""")

    import fitz
    rect = page.rect
    top_pct = max(0.0, min(float(page_top or 0), 100.0))
    bottom_pct = max(0.0, min(float(page_bottom or 0), 100.0))
    y0 = rect.y0 + rect.height * (top_pct / 100.0)
    y1 = rect.y1 - rect.height * (bottom_pct / 100.0)
    
    # Build list of clip rects (1 for single-column, 2 for 2-column)
    if int(columns or 1) == 2:
        mid_x = rect.x0 + rect.width * 0.5
        clip_rects = [
            fitz.Rect(rect.x0, y0, mid_x, y1),      # Left half
            fitz.Rect(mid_x, y0, rect.x1, y1),       # Right half
        ]
    else:
        clip_rects = [fitz.Rect(0, y0, rect.width, y1)]
    
    all_results = []
    total_tokens = {"input": 0, "output": 0, "total": 0}
    
    for clip_rect in clip_rects:
        pix = page.get_pixmap(clip=clip_rect, dpi=150)
        img_bytes = pix.tobytes("png")
        
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
            
            if hasattr(response, 'usage_metadata') and response.usage_metadata:
                total_tokens["input"] += response.usage_metadata.prompt_token_count or 0
                total_tokens["output"] += response.usage_metadata.candidates_token_count or 0
                total_tokens["total"] += response.usage_metadata.total_token_count or 0
                
            data = json.loads(response.text)
            all_results.extend(sanitize_dict(data))
        except Exception as e:
            print(f"Gemini API Error: {e}")
    
    return all_results, total_tokens

def make_http_request(url: str, method: str = "GET", headers: dict = None, json_data: dict = None, timeout: float = 120.0):
    headers = headers or {}
    try:
        import httpx
        with httpx.Client(timeout=timeout) as client:
            if method.upper() == "POST":
                resp = client.post(url, headers=headers, json=json_data)
            else:
                resp = client.get(url, headers=headers)
        return resp.status_code, resp.json(), resp.text
    except ImportError:
        import urllib.request
        import urllib.error
        data = json.dumps(json_data).encode("utf-8") if json_data is not None else None
        req = urllib.request.Request(url, data=data, headers=headers, method=method.upper())
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                body = r.read().decode("utf-8")
                return r.status, json.loads(body) if body else {}, body
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8")
            try:
                parsed = json.loads(err_body)
            except Exception:
                parsed = {}
            return e.code, parsed, err_body

def extract_with_groq(page, api_key: str, mode: str, model_name: str, page_top: float = 0.0, page_bottom: float = 1.0, columns: int = 1):
    import base64
    import json
    import time
    import fitz
    
    rect = page.rect
    top_pct = max(0.0, min(float(page_top or 0), 100.0))
    bottom_pct = max(0.0, min(float(page_bottom or 0), 100.0))
    y0 = rect.y0 + rect.height * (top_pct / 100.0)
    y1 = rect.y1 - rect.height * (bottom_pct / 100.0)
    
    # Build list of clip rects (1 for single-column, 2 for 2-column)
    if int(columns or 1) == 2:
        mid_x = rect.x0 + rect.width * 0.5
        clip_rects = [
            fitz.Rect(rect.x0, y0, mid_x, y1),
            fitz.Rect(mid_x, y0, rect.x1, y1),
        ]
    else:
        clip_rects = [fitz.Rect(0, y0, rect.width, y1)]
    
    if mode == "questions":
        prompt = """You are a strict data extractor for an LMS. Extract all questions from this page image.

CRITICAL RULES:
1. CLEAN MATHEMATICAL TYPOGRAPHY (NO LATEX, NO PROGRAMMING CODE):
   - Multiplication: Use the actual multiplication symbol `×` (e.g., `(3/4 × 100)%`). NEVER use `*` or algebra letter `x`.
   - Roots: Use `√` (e.g., `√x`, `√(b² - 4ac)`). NEVER use `sqrt()`.
   - Powers / Exponents: Use unicode superscripts (e.g., `x²`, `y³`).
   - Mixed Fractions: Write mixed fractions with a space (e.g., `93 1/3%` or `93 ⅓%`), not `93(1/3)%`.
   - Fractions: Write clean `(a + b) / c` without excessive nested parentheses.

2. SPACING & LAYOUT: If a question contains multiple equations, a list of statements, or multiple conclusions (like in Syllogisms), you MUST place each one on its own separate line. Use double line breaks (\\n\\n) between them so they do not collapse into a single paragraph.

3. DIRECTIONS vs. PUZZLES/PASSAGES: You must distinguish between "Instructional Text" and "Puzzles":
   - INSTRUCTIONS: Do NOT copy general instructional text (e.g., "In the following questions..." or "Mark A if...") into the question `text`.
   - PUZZLES/PASSAGES: If a block of text is a Reading Comprehension passage, a Logic Puzzle, or a Data Set meant for a group of questions, you MUST copy that entire passage/puzzle into the `text` of EVERY SINGLE question it applies to. Separate the puzzle from the specific question using double line breaks (\\n\\n).

4. MASTER OPTIONS: If an "Instructional" block provides master options (e.g., "(A) if only conclusion I follows..."), extract ONLY those option choices and put them into the `options` object for all applicable questions on that page. 

5. MISSING OPTIONS: If a question is a Logical Reasoning, Syllogism, or Statement-Conclusion type and NO options are printed anywhere on the page, you MUST automatically generate the standard options:
   "a": "If only conclusion I follows"
   "b": "If only conclusion II follows"
   "c": "If either conclusion I or II follows"
   "d": "If neither conclusion I nor II follows"
   "e": "If both conclusion I and II follow"

You MUST return a JSON object with a single key "data", which contains an array of objects.
Each object must have:
- "num" (string): The question number.
- "text" (string): The question text (including the puzzle/passage if applicable).
- "options" (object): The answer options, keys must be "a", "b", "c", "d", etc.
"""
    else:
        prompt = """You are a strict data transcriber for an LMS. Extract the solutions/explanations exactly as they appear in this page image without adding conversational filler or rewriting them.

CRITICAL RULES:
1. CLEAN MATHEMATICAL TYPOGRAPHY (NO LATEX, NO PROGRAMMING CODE):
   Write mathematics using standard mathematical symbols, NOT programming code:
   - Multiplication: Use the actual multiplication symbol `×` (e.g., `(3/4 × 100)%`). NEVER use `*` or the letter `x`.
   - Roots: Use `√` (e.g., `√x`, `√(b² - 4ac)`). NEVER use `sqrt()`.
   - Powers / Exponents: Use unicode superscripts where applicable (e.g., `x²`, `(260)²`, `y³`).
   - Deduction Arrow: Use the clean mathematical implication arrow `⇒` (e.g., `10 - x = 4.20 ⇒ x = 5.8`). NEVER use `=>`.
   - Mixed Fractions: Write mixed fractions clearly with a space (e.g., `93 1/3%` or `93 ⅓%`). Do NOT write `93(1/3)%`.
   - Division / Fractions: Write simple fractions as `a / b` or `a/b`. Only use parentheses where mathematically necessary for grouping (e.g., `(100 + 84) / 200 × 100%`). Avoid unnecessary nested parentheses like `(((a / b) * c))`.

2. PURE MATHEMATICAL TRANSCRIPTION (NO TUTORING):
   Do not explain the math in conversational English words (e.g., do NOT write "First, perform the multiplication...", "Next, divide...").
   Output only the plain mathematical steps exactly as printed in the book. Only include English words if they are literally printed on the page. Never correct the book's math; transcribe it exactly.

3. STEP-BY-STEP VERTICAL FLOW (ONE STEP PER LINE):
   Each mathematical deduction or step MUST be placed on its own separate line using double line breaks (\n\n).
   Do NOT chain multiple calculation steps together on a single line with `⇒`.
   Example format:
   Let 36% of 245 - 40% of 210 = 10 - x

   (36/100 × 245) - (40/100 × 210) = 10 - x

   ⇒ 88.20 - 84 = 10 - x

   ⇒ 10 - x = 4.20

   ⇒ x = 5.8

4. TABLES IN SOLUTIONS:
   If a solution contains a table, transcribe it as a clean markdown table using pipes `|`:
   Subjects | Total Marks | Marks Obtained
   Mathematics | 100 | 100
   Science | 100 | 84

5. CAREFUL OPTION EXTRACTION & MAPPING:
   - Universal Mapping: Regardless of how options are labeled in the book (e.g., numbers 1-4, lowercase a-d, roman numerals, or alternate letters), you MUST translate the correct answer to standard capital letters (A, B, C, D, E) based on sequence. The 1st option is A, 2nd is B, 3rd is C, 4th is D, 5th is E.
   - No Hallucination: If the correct option is genuinely NOT printed anywhere in the text, leave the `correct` field blank `""`. DO NOT guess or hallucinate an answer.

6. FINAL ANSWER:
   Always state the final conclusion clearly on the very last line of the explanation (e.g., "Final Answer: Option B").

7. CLEAN EXPLANATIONS:
   Do not include unnecessary headers from the book. If the text explains a diagram or puzzle, capture the logical explanation perfectly in text, but do not invent extra mathematical steps that aren't printed on the page.

You MUST return a JSON object with a single key "data", which contains an array of objects.
Each object must have:
- "num" (string): The solution number.
- "correct" (string): The correct option letter (A, B, C, D, E) or blank "" if genuinely missing.
- "explanation" (string): The explanation text exactly as transcribed.
"""


    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    all_results = []
    total_tokens = {"input": 0, "output": 0, "total": 0}
    
    for clip_rect in clip_rects:
        pix = page.get_pixmap(clip=clip_rect, dpi=150)
        img_bytes = pix.tobytes("png")
        b64_img = base64.b64encode(img_bytes).decode('utf-8')
        
        payload = {
            "model": model_name,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64_img}"}}
                    ]
                }
            ],
            "response_format": {"type": "json_object"}
        }
        
        # muse-spark-open requires default temperature (1.0) and supports reasoning_effort
        if "muse-spark" in model_name.lower():
            payload["reasoning_effort"] = "medium"
        else:
            payload["temperature"] = 0.01
        
        max_retries = 6
        for attempt in range(max_retries):
            try:
                if attempt > 0:
                    backoff_time = 2 ** attempt
                    print(f"Groq API retry {attempt}/{max_retries - 1}. Waiting {backoff_time}s...")
                    time.sleep(backoff_time)
                    
                status_code, data_json, raw_text = make_http_request(
                    "https://api.groq.com/openai/v1/chat/completions",
                    method="POST",
                    headers=headers,
                    json_data=payload,
                    timeout=120.0
                )
                
                if status_code != 200:
                    err_msg = data_json.get("error", {}).get("message") or raw_text or f"HTTP {status_code}"
                    err_str = err_msg.lower()
                    if "429" in err_str or "quota" in err_str or "too many" in err_str:
                        if attempt < max_retries - 1:
                            print(f"Groq Rate limit hit (Attempt {attempt+1}). Retrying...")
                            continue
                    raise RuntimeError(f"Groq API Error: {err_msg}")
                
                usage = data_json.get("usage", {})
                total_tokens["input"] += usage.get("prompt_tokens", 0)
                total_tokens["output"] += usage.get("completion_tokens", 0)
                total_tokens["total"] += usage.get("total_tokens", 0)
                
                content_str = data_json.get("choices", [{}])[0].get("message", {}).get("content") or ""
                
                match = re.search(r'```(?:json)?(.*?)```', content_str, re.DOTALL)
                if match:
                    content_str = match.group(1).strip()
                    
                parsed = json.loads(content_str)
                all_results.extend(sanitize_dict(parsed.get("data", [])))
                break  # Success, move to next clip_rect
                
            except Exception as e:
                err_str = str(e).lower()
                if ("429" in err_str or "quota" in err_str or "too many" in err_str) and attempt < max_retries - 1:
                    continue
                print(f"Groq API Error: {e}")
                raise
            
    return all_results, total_tokens

def is_complex_content(page):
    if len(page.get_images()) > 0:
        return True
    drawings = page.get_drawings()
    if len(drawings) > 10:
        return True
    text = page.get_text("text")
    math_symbols = ['√', '÷', '∫', '∑', '±', 'θ', 'π', '≤', '≥', '≈', '≠']
    return any(sym in text for sym in math_symbols)

def parse_questions_python(text):
    # Match question headers across diverse book formats:
    # Handles: 'Q1.', 'Q.1', 'Q 1.', 'Q1)', 'Question 1.', 'Que. 1', '1.', '1)', '1:'
    q_header_re = re.compile(
        r'(?:^|\n)\s*(?:(?:Question|Que|Q)\.?\s*(\d+)(?:[\.\):]|\s+)|(\d+)[\.\):]\s*)',
        re.IGNORECASE
    )
    
    matches = list(q_header_re.finditer(text))
    questions = []
    
    if not matches:
        return []
        
    for i in range(len(matches)):
        m = matches[i]
        q_num = m.group(1) or m.group(2)
        start_pos = m.end()
        end_pos = matches[i+1].start() if i + 1 < len(matches) else len(text)
        block = text[start_pos:end_pos].strip()
        if not block:
            continue
            
        opt_patterns = [
            # 1. (A), (B) or (a), (b) or (1), (2)
            r'(?:^|\n|\s{2,})\(([A-Ea-e1-5])\)\s*',
            # 2. [A], [B] or [a], [b]
            r'(?:^|\n|\s{2,})\[([A-Ea-e1-5])\]\s*',
            # 3. A), B) or a), b)
            r'(?:^|\n|\s{2,})([A-Ea-e])\)\s*',
            # 4. A., B. or a., b.
            r'(?:^|\n|\s{2,})([A-Ea-e])\.\s*'
        ]
        
        best_opts = {}
        q_body = block
        
        for pat in opt_patterns:
            opt_matches = list(re.finditer(pat, block))
            if len(opt_matches) >= 2:
                opts = {}
                first_start = opt_matches[0].start()
                for o_idx in range(len(opt_matches)):
                    raw_key = opt_matches[o_idx].group(1).upper()
                    num_map = {'1': 'A', '2': 'B', '3': 'C', '4': 'D', '5': 'E'}
                    opt_key = num_map.get(raw_key, raw_key)
                    
                    o_start = opt_matches[o_idx].end()
                    o_end = opt_matches[o_idx+1].start() if o_idx + 1 < len(opt_matches) else len(block)
                    opts[opt_key] = block[o_start:o_end].strip()
                
                if len(opts) >= 2:
                    best_opts = opts
                    q_body = block[:first_start].strip()
                    break
                    
        questions.append({
            'num': q_num,
            'text': q_body,
            'options': best_opts
        })
        
    return questions

def parse_solutions_python(text):
    # Support multiple formats across books:
    # 1) Q1.\nCorrect Option: A\nExplanation: ...
    # 2) 1. Option A ... / 1. Option (A) ...
    # 3) 1. (A) ... / 1. A) ... / 1. A. ...
    # 4) Q1: A ... / 1: A ... / Q1 - A ...
    # 5) Ans: A / Answer: A
    sol_pat = re.compile(
        r'(?:^|\n)\s*(?:(?:Question|Que|Q)\.?\s*(\d+)[\.\):]?|(\d+)[\.\):]?)\s*(?:\n|\s+)(?:(?:Correct\s+)?(?:Option|Ans(?:wer)?)\s*[:\-\.]?\s*|\(\s*|\[\s*)?([A-Ea-e])[\.\):\]]?(?:\s*(?:Explanation|Sol(?:ution)?)\s*[:\-\.]?)?\s*',
        re.IGNORECASE
    )
    
    matches = list(sol_pat.finditer(text))
    solutions = []
    
    if not matches:
        blocks = re.split(r'\n(?=\d+\.\s+Option\s+[A-E])', text, flags=re.IGNORECASE)
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

    for i in range(len(matches)):
        m = matches[i]
        q_num = m.group(1) or m.group(2)
        correct = m.group(3).upper()
        start_pos = m.end()
        end_pos = matches[i+1].start() if i + 1 < len(matches) else len(text)
        explanation = text[start_pos:end_pos].strip()
        explanation = re.sub(r'^(?:Explanation|Sol(?:ution)?)\s*[:\-\.]\s*', '', explanation, flags=re.IGNORECASE).strip()
        solutions.append({
            'num': q_num,
            'correct': correct,
            'explanation': explanation
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

# Global dictionary to track long-running jobs (like PDF parsing)
PROGRESS_TRACKER = {}

@app.get("/api/status/{job_id}")
async def get_status(job_id: str):
    return PROGRESS_TRACKER.get(job_id, {"status": "unknown"})

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

@app.post("/api/auth/setup-admin")
async def setup_admin(req: CreateUserRequest):
    if db.has_super_admin():
        raise HTTPException(status_code=400, detail="Super Admin already exists")
    user = db.create_user(req.name, req.username, req.password, role="super_admin")
    token = db.create_session(user["id"])
    return {
        "token": token,
        "user": {"id": user["id"], "name": user["name"], "username": user["username"], "role": user["role"]}
    }

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
    groq_model = db.get_setting("groq_model") or "meta-models/muse-spark-open"
    
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
    if req.groq_model:
        db.set_setting("groq_model", req.groq_model)
        
    return {"message": "Settings saved successfully."}


@app.post("/api/admin/test-model")
async def test_model(
    file: UploadFile = File(...),
    mode: str = Form(...),
    admin: dict = Depends(require_super_admin)
):
    provider = db.get_setting("active_ai_provider") or "gemini"
    if provider == "groq":
        model_name = db.get_setting("groq_model") or "meta-models/muse-spark-open"
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
async def list_available_models(provider: str = "gemini", admin: dict = Depends(require_super_admin)):
    if provider == "groq":
        api_key = db.get_setting("groq_api_key")
        if not api_key:
            raise HTTPException(status_code=400, detail="Groq API Key not configured yet")
        try:
            status_code, data, raw_text = make_http_request(
                "https://api.groq.com/openai/v1/models",
                method="GET",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=30.0
            )
            if status_code != 200:
                err_msg = data.get("error", {}).get("message") or raw_text or f"HTTP {status_code}"
                raise RuntimeError(err_msg)
            models = []
            for m in data.get("data", []):
                m_id = m.get("id", "")
                models.append({
                    "name": m_id,
                    "display_name": m_id,
                    "description": f"Owner: {m.get('owned_by', 'groq')}"
                })
            return models
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to fetch Groq models: {str(e)}")
    else:
        api_key = db.get_setting("gemini_api_key")
        if not api_key:
            raise HTTPException(status_code=400, detail="Gemini API Key not configured yet")
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
    job_id: str = Form(""),
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
    
    if engine in ('dynamic', 'ai'):
        provider = db.get_setting("active_ai_provider") or "gemini"
        
        if provider == "groq":
            model_name = db.get_setting("groq_model") or "meta-models/muse-spark-open"
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
    
    ai_extract_fn = extract_with_groq if provider == "groq" else extract_with_gemini
    sol_header_re = re.compile(r'(?:ANSWERS?\s*(?:&|AND)?\s*EXPLANATIONS?|HINTS?\s*(?:&|AND)?\s*SOLUTIONS?|ANSWER\s*KEY)\b', re.IGNORECASE)
    
    # Token Tracking Accumulators
    total_input_tokens = 0
    total_output_tokens = 0
    pages_processed_ai = 0
    
    # Job Tracking
    total_pages = (q_end - q_start + 1) + (s_end - s_start + 1)
    current_page = 0
    if job_id:
        PROGRESS_TRACKER[job_id] = {"status": "processing", "current": 0, "total": total_pages, "phase": "Initializing"}
    
    # 1. EXTRACT QUESTIONS
    q_text_buffer = ""
    q_pages_buffered = []

    def flush_q_buffer():
        nonlocal q_text_buffer, q_pages_buffered, total_input_tokens, total_output_tokens, pages_processed_ai
        if not q_text_buffer.strip():
            q_pages_buffered = []
            return
        parsed_qs = parse_questions_python(q_text_buffer)
        if parsed_qs:
            questions.extend(parsed_qs)
        elif engine == 'dynamic' and q_pages_buffered and api_key:
            # Dynamic Fallback: Python extracted 0 questions. Automatically run AI on these pages so extraction never fails.
            print(f"Dynamic fallback: Python returned 0 questions for {len(q_pages_buffered)} pages. Running AI fallback...")
            for p_idx, p_obj, p_top, p_bot in q_pages_buffered:
                try:
                    ai_qs, tokens = ai_extract_fn(p_obj, api_key, "questions", model_name, p_top, p_bot, columns=int(columns or 1))
                    questions.extend(ai_qs)
                    total_input_tokens += tokens["input"]
                    total_output_tokens += tokens["output"]
                    pages_processed_ai += 1
                except Exception as e:
                    print(f"AI fallback failed on page {p_idx+1}: {e}")
        q_text_buffer = ""
        q_pages_buffered = []

    for i in range(q_start - 1, q_end):
        if i >= len(doc): break
        
        current_page += 1
        if job_id:
            PROGRESS_TRACKER[job_id].update({"current": current_page, "phase": f"Extracting Questions (Page {i+1})"})
            
        page = doc[i]
        
        # Physical Boundary Cropping
        page_top = top_margin_pct
        page_bottom = bottom_margin_pct
        
        if i == q_start - 1 and q_start_top > 0:
            page_top = max(page_top, q_start_top)
            
        if i == q_end - 1 and q_end_bottom > 0:
            page_bottom = max(page_bottom, q_end_bottom)
                
        is_ai_page = (engine == 'ai') or (engine == 'dynamic' and is_complex_content(page))
        if is_ai_page:
            flush_q_buffer()
            try:
                ai_qs, tokens = ai_extract_fn(page, api_key, "questions", model_name, page_top, page_bottom, columns=int(columns or 1))
            except Exception as e:
                if job_id:
                    PROGRESS_TRACKER[job_id] = {"status": "error", "error": str(e)}
                raise HTTPException(status_code=400, detail=str(e))
            questions.extend(ai_qs)
            total_input_tokens += tokens["input"]
            total_output_tokens += tokens["output"]
            pages_processed_ai += 1
        else:
            raw_page_text = get_page_text_with_layout(page, page_top, page_bottom, columns, engine)
            # If transition boundary page between questions and solutions, drop text after solution header
            if i == q_end - 1 and q_end >= s_start and sol_header_re.search(raw_page_text):
                raw_page_text = sol_header_re.split(raw_page_text)[0]
            q_text_buffer += raw_page_text + "\n"
            q_pages_buffered.append((i, page, page_top, page_bottom))
            
    flush_q_buffer()

    # 2. EXTRACT SOLUTIONS
    s_text_buffer = ""
    s_pages_buffered = []

    def flush_s_buffer():
        nonlocal s_text_buffer, s_pages_buffered, total_input_tokens, total_output_tokens, pages_processed_ai
        if not s_text_buffer.strip():
            s_pages_buffered = []
            return
        parsed_sols = parse_solutions_python(s_text_buffer)
        if parsed_sols:
            solutions.extend(parsed_sols)
        elif engine == 'dynamic' and s_pages_buffered and api_key:
            # Dynamic Fallback: Python extracted 0 solutions. Automatically run AI on these pages so extraction never fails.
            print(f"Dynamic fallback: Python returned 0 solutions for {len(s_pages_buffered)} pages. Running AI fallback...")
            for p_idx, p_obj, p_top, p_bot in s_pages_buffered:
                try:
                    ai_sols, tokens = ai_extract_fn(p_obj, api_key, "solutions", model_name, p_top, p_bot, columns=int(columns or 1))
                    solutions.extend(ai_sols)
                    total_input_tokens += tokens["input"]
                    total_output_tokens += tokens["output"]
                    pages_processed_ai += 1
                except Exception as e:
                    print(f"AI fallback failed on page {p_idx+1}: {e}")
        s_text_buffer = ""
        s_pages_buffered = []

    for i in range(s_start - 1, s_end):
        if i >= len(doc): break
        
        current_page += 1
        if job_id:
            PROGRESS_TRACKER[job_id].update({"current": current_page, "phase": f"Extracting Solutions (Page {i+1})"})
            
        page = doc[i]
        
        # Physical Boundary Cropping
        page_top = top_margin_pct
        page_bottom = bottom_margin_pct
        
        if i == s_start - 1 and s_start_top > 0:
            page_top = max(page_top, s_start_top)
            
        if i == s_end - 1 and s_end_bottom > 0:
            page_bottom = max(page_bottom, s_end_bottom)
                
        is_ai_page = (engine == 'ai') or (engine == 'dynamic' and is_complex_content(page))
        if is_ai_page:
            flush_s_buffer()
            try:
                ai_sols, tokens = ai_extract_fn(page, api_key, "solutions", model_name, page_top, page_bottom, columns=int(columns or 1))
            except Exception as e:
                if job_id:
                    PROGRESS_TRACKER[job_id] = {"status": "error", "error": str(e)}
                raise HTTPException(status_code=400, detail=str(e))
            solutions.extend(ai_sols)
            total_input_tokens += tokens["input"]
            total_output_tokens += tokens["output"]
            pages_processed_ai += 1
        else:
            raw_page_text = get_page_text_with_layout(page, page_top, page_bottom, columns, engine)
            # If transition boundary page between questions and solutions, drop text before solution header
            if i == s_start - 1 and s_start <= q_end and sol_header_re.search(raw_page_text):
                raw_page_text = sol_header_re.split(raw_page_text, 1)[-1]
            s_text_buffer += raw_page_text + "\n"
            s_pages_buffered.append((i, page, page_top, page_bottom))
            
    flush_s_buffer()

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
    
    # 3. Filter and Sort numerically
    expected_q_nums = set(str(i) for i in range(q_index_start, q_index_end + 1))
    expected_s_nums = set(str(i) for i in range(s_index_start, s_index_end + 1))
    
    questions = [q for q in questions if q['num'] in expected_q_nums]
    solutions = [s for s in solutions if s['num'] in expected_s_nums]
    
    def safe_int(val):
        try:
            return int(val)
        except ValueError:
            return 999999

    questions.sort(key=lambda q: safe_int(q['num']))
    solutions.sort(key=lambda s: safe_int(s['num']))

    
    # 4. Build the mapping
    def normalize_num(n):
        return re.sub(r'[^0-9]', '', str(n))
        
    sol_map = {normalize_num(s.get('num', '')): s for s in solutions}
    
    # Save Audit Log if Dynamic Engine was used
    if engine in ('dynamic', 'ai') and pages_processed_ai > 0:
        total_tokens = total_input_tokens + total_output_tokens
        # Gemini 2.0 Flash pricing: $0.10 / 1M input, $0.40 / 1M output
        cost = (total_input_tokens * 0.10 / 1_000_000) + (total_output_tokens * 0.40 / 1_000_000)
        db.add_extraction_log(
            user_id=current_user["id"],
            user_name=current_user["name"],
            pdf_name=file.filename or "uploaded.pdf",
            engine=engine,
            model_used=model_name,
            pages_count=pages_processed_ai,
            input_tokens=total_input_tokens,
            output_tokens=total_output_tokens,
            total_tokens=total_tokens,
            cost=round(cost, 6)
        )
    
    # Helper functions for table detection and formatting (Testpress Word/HTML standard)
    def is_separator_row(line: str) -> bool:
        s = line.strip()
        cleaned = s.replace('|', '').replace('-', '').replace(':', '').replace(' ', '')
        return len(cleaned) == 0 and '-' in s

    def is_table_row(line: str) -> bool:
        s = line.strip()
        if is_separator_row(s):
            return True
        if '|' in s:
            parts = [c.strip() for c in s.split('|') if c.strip()]
            return len(parts) >= 2
        return False

    def parse_blocks(text: str):
        lines = text.replace('\r\n', '\n').split('\n')
        raw_blocks = []
        curr_type = None
        curr_lines = []
        
        for line in lines:
            stripped = line.strip()
            if not stripped:
                if curr_lines:
                    raw_blocks.append((curr_type, curr_lines))
                    curr_lines = []
                    curr_type = None
                continue
                
            line_is_tbl = is_table_row(stripped)
            if line_is_tbl:
                if curr_type != 'table':
                    if curr_lines:
                        raw_blocks.append((curr_type, curr_lines))
                        curr_lines = []
                    curr_type = 'table'
                curr_lines.append(stripped)
            else:
                if curr_type == 'table':
                    raw_blocks.append((curr_type, curr_lines))
                    curr_lines = []
                    curr_type = 'text'
                elif curr_type is None:
                    curr_type = 'text'
                curr_lines.append(stripped)
                
        if curr_lines:
            raw_blocks.append((curr_type, curr_lines))
            
        final_blocks = []
        for b_type, b_lines in raw_blocks:
            if b_type == 'table':
                non_sep = [l for l in b_lines if not is_separator_row(l)]
                if len(non_sep) >= 2:
                    final_blocks.append(('table', non_sep))
                else:
                    final_blocks.append(('text', b_lines))
            else:
                final_blocks.append(('text', b_lines))
                
        return final_blocks

    def format_html_content(raw_text: str, q_num: str = None) -> str:
        # Normalize code symbols to mathematical symbols
        raw_text = raw_text.replace("=>", "⇒").replace("->", "→")
        raw_text = re.sub(r'sqrt\((.*?)\)', r'√(\1)', raw_text)
        blocks = parse_blocks(raw_text)
        html_out = ""
        is_first_line = True
        prefix = f"<b>Q.{q_num})</b> " if q_num is not None else ""
        
        for b_type, b_lines in blocks:
            if b_type == 'table':
                cleaned_rows = []
                for r in b_lines:
                    cells = [c.strip() for c in r.split('|')]
                    if r.strip().startswith('|') and cells and cells[0] == '':
                        cells = cells[1:]
                    if r.strip().endswith('|') and cells and cells[-1] == '':
                        cells = cells[:-1]
                    cleaned_rows.append(cells)
                    
                if cleaned_rows:
                    html_out += '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; margin: 10px 0; width: 100%; border: 1px solid #777;">\n'
                    html_out += '  <thead>\n    <tr style="background-color: #f2f2f2; font-weight: bold;">\n'
                    for c in cleaned_rows[0]:
                        html_out += f'      <th style="border: 1px solid #777; padding: 6px 10px; text-align: center;">{html.escape(c)}</th>\n'
                    html_out += '    </tr>\n  </thead>\n'
                    
                    if len(cleaned_rows) > 1:
                        html_out += '  <tbody>\n'
                        for row in cleaned_rows[1:]:
                            html_out += '    <tr>\n'
                            for c in row:
                                html_out += f'      <td style="border: 1px solid #777; padding: 6px 10px; text-align: center;">{html.escape(c)}</td>\n'
                            html_out += '    </tr>\n'
                        html_out += '  </tbody>\n'
                    html_out += '</table>\n'
            else:
                for line in b_lines:
                    if is_first_line and prefix:
                        html_out += f"<p>{prefix}{html.escape(line)}</p>\n"
                        is_first_line = False
                    else:
                        html_out += f"<p>{html.escape(line)}</p>\n"
                        
        if is_first_line and prefix:
            html_out = f"<p>{prefix}</p>\n" + html_out
            
        return html_out

    def add_content_to_docx(doc, raw_text: str, q_num: str = None):
        # Normalize code symbols to mathematical symbols
        raw_text = raw_text.replace("=>", "⇒").replace("->", "→")
        raw_text = re.sub(r'sqrt\((.*?)\)', r'√(\1)', raw_text)
        blocks = parse_blocks(raw_text)
        is_first_line = True
        prefix = f"Q.{q_num}) " if q_num is not None else ""
        
        for b_type, b_lines in blocks:
            if b_type == 'table':
                cleaned_rows = []
                for r in b_lines:
                    cells = [c.strip() for c in r.split('|')]
                    if r.strip().startswith('|') and cells and cells[0] == '':
                        cells = cells[1:]
                    if r.strip().endswith('|') and cells and cells[-1] == '':
                        cells = cells[:-1]
                    cleaned_rows.append(cells)
                    
                if cleaned_rows and len(cleaned_rows[0]) > 0:
                    num_rows = len(cleaned_rows)
                    num_cols = max(len(r) for r in cleaned_rows)
                    tbl = doc.add_table(rows=num_rows, cols=num_cols)
                    tbl.style = 'Table Grid'
                    for r_idx, row in enumerate(cleaned_rows):
                        for c_idx, cell_text in enumerate(row):
                            if c_idx < num_cols:
                                tbl.cell(r_idx, c_idx).text = cell_text
                    doc.add_paragraph("")
            else:
                for line in b_lines:
                    if is_first_line and prefix:
                        doc.add_paragraph(f"{prefix}{line}")
                        is_first_line = False
                    else:
                        doc.add_paragraph(line)
                        
        if is_first_line and prefix:
            doc.add_paragraph(prefix)

    # 1. Generate DOCX
    doc_q = Document()
    for q in questions:
        add_content_to_docx(doc_q, q['text'], q_num=q['num'])
        for opt_letter, opt_text in q.get('options', {}).items():
            doc_q.add_paragraph(f"{opt_letter}) {opt_text}")
        doc_q.add_paragraph("")
    q_io = io.BytesIO()
    doc_q.save(q_io)
    q_io.seek(0)
    
    doc_e = Document()
    for s in solutions:
        add_content_to_docx(doc_e, s['explanation'], q_num=s['num'])
        doc_e.add_paragraph("")
    e_io = io.BytesIO()
    doc_e.save(e_io)
    e_io.seek(0)
    
    # 2. Generate HTML + ZIP (Formatted for Testpress Word Bulk Upload)
    word_html_template = """<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta http-equiv=Content-Type content="text/html; charset=utf-8"><meta name=ProgId content=Word.Document></head><body lang=EN-US><div class=WordSection1>\n{content}\n</div></body></html>"""

    q_content = ""
    for q in questions:
        q_content += format_html_content(q['text'], q_num=q['num'])
        for opt_letter, opt_text in q.get('options', {}).items():
            q_content += f"<p>{opt_letter}) {html.escape(opt_text)}</p>\n"
        q_content += "<br/>\n"
    q_html = word_html_template.format(content=q_content)
    
    e_content = ""
    for s in solutions:
        e_content += format_html_content(s['explanation'], q_num=s['num'])
        e_content += "<br/>\n"
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
        q_norm = normalize_num(q.get('num', ''))
        correct_ans = sol_map.get(q_norm, {}).get('correct', '')
        
        # Clean up correct answer string (e.g. "Option B" -> "B")
        if correct_ans:
            match = re.search(r'[A-Ea-e]', correct_ans)
            if match:
                correct_ans = match.group(0).upper()
                
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
    if job_id:
        PROGRESS_TRACKER[job_id] = {"status": "done", "phase": "Complete"}
        
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
