import streamlit as st
import fitz  # PyMuPDF
import re
import pandas as pd
from docx import Document
import io
import json
from PIL import Image
import zipfile
# Set page config
st.set_page_config(page_title="LMS Bulk Upload Extractor", layout="wide")

# ---- PURE PYTHON FUNCTIONS (PLAIN TEXT) ----
def extract_text_from_pages(doc, start_page, end_page):
    text = ""
    for i in range(start_page - 1, end_page):
        if i < len(doc):
            text += doc[i].get_text("text") + "\n"
    return text

def parse_questions_python(text):
    blocks = re.split(r'\n(?=\d+\))', text)
    questions = []
    for block in blocks:
        block = block.strip()
        if not block: continue
        match = re.match(r'^(\d+)\)\s+([\s\S]+)', block)
        if match:
            q_num = match.group(1)
            content = match.group(2)
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
            q_num = match.group(1)
            correct_opt = match.group(2).upper()
            explanation = match.group(3).strip()
            solutions.append({'num': q_num, 'correct': correct_opt, 'explanation': explanation})
    return solutions


# ---- GEMINI AI FUNCTIONS (TEX FORMATTING) ----
def extract_with_gemini(doc, start_page, end_page, api_key, extraction_type):
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=api_key)
    
    extracted_data = []
    
    # JSON Schemas to force strict extraction
    schema_questions = {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "num": {"type": "string"},
                "text": {"type": "string"},
                "options": {
                    "type": "object",
                    "properties": {
                        "a": {"type": "string"}, "b": {"type": "string"},
                        "c": {"type": "string"}, "d": {"type": "string"}, "e": {"type": "string"}
                    }
                }
            },
            "required": ["num", "text", "options"]
        }
    }
    
    schema_solutions = {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "num": {"type": "string"},
                "correct": {"type": "string"},
                "explanation": {"type": "string"}
            },
            "required": ["num", "correct", "explanation"]
        }
    }

    progress_text = st.empty()
    progress_bar = st.progress(0)
    total_pages = end_page - start_page + 1
    
    for idx, page_num in enumerate(range(start_page - 1, end_page)):
        if page_num >= len(doc): break
        progress_text.text(f"AI is visually analyzing Page {page_num + 1} for {extraction_type} (Converting Math to TeX)...")
        
        page = doc[page_num]
        pix = page.get_pixmap(dpi=200)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        
        prompt = f"Extract all {extraction_type} from this page exactly as they appear. CRITICAL: Format ALL math, numbers, fractions, and equations in standard TeX/LaTeX notation (e.g., \sqrt{{x}}, \pm, \frac{{a}}{{b}}, x^2)."
        schema = schema_questions if extraction_type == "questions" else schema_solutions
        
        try:
            response = client.models.generate_content(
                model='gemini-2.0-flash',
                contents=[img, prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=schema,
                    temperature=0.0
                )
            )
            page_data = json.loads(response.text)
            extracted_data.extend(page_data)
        except Exception as e:
            st.error(f"Error on page {page_num + 1}: {e}")
            
        progress_bar.progress((idx + 1) / total_pages)
        
    progress_text.text(f"{extraction_type.capitalize()} Extraction complete!")
    return extracted_data


# --- UI Setup ---
st.title("📚 LMS Bulk Upload Extractor")
st.markdown("Extract Questions and Solutions from PDFs into LMS-ready Word and Excel files.")

with st.sidebar:
    st.header("⚙️ Extraction Engine")
    engine = st.radio("Select Method", ["Pure Python (Fast, Plain Text)", "Gemini AI (Accurate, Outputs TeX)"])
    api_key = ""
    if engine == "Gemini AI (Accurate, Outputs TeX)":
        st.info("AI Mode visually reads pages and natively writes TeX code like `\sqrt{x}` for your LMS.")
        api_key = st.text_input("Gemini API Key", type="password")

uploaded_file = st.file_uploader("Upload PDF File", type=['pdf'])

st.markdown("---")
col1, col2 = st.columns(2)
with col1:
    st.subheader("Questions Range")
    q_start = st.number_input("Start Page (Questions)", min_value=1, value=26)
    q_end = st.number_input("End Page (Questions)", min_value=1, value=32)

with col2:
    st.subheader("Solutions Range")
    s_start = st.number_input("Start Page (Solutions)", min_value=1, value=32)
    s_end = st.number_input("End Page (Solutions)", min_value=1, value=40)

st.markdown("---")
st.subheader("Excel Answer Key Metadata")
col3, col4, col5 = st.columns(3)
with col3:
    subject = st.text_input("Subject", "Quantitative")
    marks = st.number_input("Marks", value=2.0)
with col4:
    negative_marks = st.number_input("Negative Marks", value=0.6)
    difficulty = st.selectbox("Difficulty Level", ["Easy", "Very Easy", "Medium", "Hard", "Very Hard"])
with col5:
    q_type = st.selectbox("Question Type", ["Single", "Multiple", "Short", "Numeric"])

if 'processed_data' not in st.session_state:
    st.session_state.processed_data = None

if st.button("Process PDF", type="primary") and uploaded_file is not None:
    if engine == "Gemini AI (Accurate, Outputs TeX)" and not api_key:
        st.error("Please enter a Gemini API Key in the sidebar to use the AI TeX Engine.")
        st.stop()
        
    with st.spinner("Extracting and parsing..."):
        # Load PDF
        doc = fitz.open(stream=uploaded_file.read(), filetype="pdf")
        
        if engine == "Pure Python (Fast, Plain Text)":
            q_text = extract_text_from_pages(doc, q_start, q_end)
            s_text = extract_text_from_pages(doc, s_start, s_end)
            questions = parse_questions_python(q_text)
            solutions = parse_solutions_python(s_text)
        else:
            questions = extract_with_gemini(doc, q_start, q_end, api_key, "questions")
            solutions = extract_with_gemini(doc, s_start, s_end, api_key, "solutions")
        
        # Create a mapping dictionary for fast solution lookup
        sol_map = {s['num']: s for s in solutions}
        
        # --- Generate Questions DOCX ---
        doc_q = Document()
        for q in questions:
            # Wrap standard math in $$ if using AI (LMS TeX delimiter convention)
            doc_q.add_paragraph(f"Q.{q['num']}) {q['text']}")
            for opt_letter, opt_text in q.get('options', {}).items():
                doc_q.add_paragraph(f"{opt_letter}) {opt_text}")
            doc_q.add_paragraph("") # Spacing
            
        q_io = io.BytesIO()
        doc_q.save(q_io)
        q_io.seek(0)
        
        # --- Generate Explanations DOCX ---
        doc_e = Document()
        for s in solutions:
            doc_e.add_paragraph(f"Q.{s['num']}) {s['explanation']}")
            doc_e.add_paragraph("") # Spacing
            
        e_io = io.BytesIO()
        doc_e.save(e_io)
        e_io.seek(0)
        
        # --- Generate Excel Answers Key ---
        data = []
        for q in questions:
            correct_ans = sol_map.get(q['num'], {}).get('correct', '')
            data.append({
                'Question Number': q['num'],
                'Correct Answer(s)': correct_ans,
                'Subject': subject,
                'Marks': marks,
                'Negative Marks': negative_marks,
                'Type': q_type,
                'Difficulty Level': difficulty,
                'Percentage Correct': '',
                'Case Sensitive': 'No',
                'Partial Marks': '',
                'Accepted Error': '',
                'Bonus Question': 'No',
                'Tags': '',
                'Adaptive Difficulty Level': ''
            })
            
        df = pd.DataFrame(data)
        excel_io = io.BytesIO()
        df.to_excel(excel_io, index=False)
        excel_io.seek(0)
        
                
        # --- Word-style HTML Template ---
        word_html_template = """<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv=Content-Type content="text/html; charset=utf-8">
<meta name=ProgId content=Word.Document>
</head>
<body lang=EN-US>
<div class=WordSection1>
{content}
</div>
</body>
</html>"""

        # --- Generate Questions HTM ---
        q_content = ""
        for q in questions:
            q_content += f"<p><b>Q.{q['num']})</b> {q['text']}</p>\n"
            for opt_letter, opt_text in q.get('options', {}).items():
                q_content += f"<p>{opt_letter}) {opt_text}</p>\n"
            q_content += "<br/>\n"
        q_html = word_html_template.format(content=q_content)
        
        # --- Generate Explanations HTM ---
        e_content = ""
        for s in solutions:
            e_content += f"<p><b>Q.{s['num']})</b> {s['explanation']}</p>\n<br/>\n"
        e_html = word_html_template.format(content=e_content)

        # Create Questions ZIP
        q_zip_io = io.BytesIO()
        with zipfile.ZipFile(q_zip_io, 'w', zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("Questions.htm", q_html.encode('utf-8'))
        q_zip_io.seek(0)

        # Create Explanations ZIP
        e_zip_io = io.BytesIO()
        with zipfile.ZipFile(e_zip_io, 'w', zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("Explanations.htm", e_html.encode('utf-8'))
        e_zip_io.seek(0)
        
        st.session_state.processed_data = {
            'q_len': len(questions),
            's_len': len(solutions),
            'q_io': q_io,
            'e_io': e_io,
            'excel_io': excel_io,
            'q_zip_io': q_zip_io,
            'e_zip_io': e_zip_io,
            'df': df
        }

if st.session_state.processed_data:
    data = st.session_state.processed_data
    st.success(f"✅ Successfully extracted {data['q_len']} questions and {data['s_len']} solutions!")
    
    # Download Buttons
    st.markdown("### ⬇️ Download Questions")
    col_q1, col_q2 = st.columns(2)
    with col_q1:
        st.download_button("📄 Download Questions (.docx)", data=data['q_io'], file_name="Questions.docx", mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document", use_container_width=True)
    with col_q2:
        st.download_button("📦 Download Questions (.zip)", data=data['q_zip_io'], file_name="Questions.zip", mime="application/zip", use_container_width=True)
        
    st.markdown("### ⬇️ Download Explanations")
    col_e1, col_e2 = st.columns(2)
    with col_e1:
        st.download_button("📄 Download Explanations (.docx)", data=data['e_io'], file_name="Explanations.docx", mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document", use_container_width=True)
    with col_e2:
        st.download_button("📦 Download Explanations (.zip)", data=data['e_zip_io'], file_name="Explanations.zip", mime="application/zip", use_container_width=True)
        
    st.markdown("### ⬇️ Download Answers")
    st.download_button("📊 Download Answers (.xlsx)", data=data['excel_io'], file_name="Answers.xlsx", mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", use_container_width=True)
    
    # Quick Preview
    st.markdown("---")
    st.subheader("Preview of Extracted Data")
    st.dataframe(data['df'])
