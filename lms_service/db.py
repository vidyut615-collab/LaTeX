import sqlite3
import os
import hashlib
import secrets
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(DATA_DIR, exist_ok=True)
DB_PATH = os.path.join(DATA_DIR, "lms.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Sessions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    
    # System settings table (for global Gemini API key)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Extraction logs table (token audit logs)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            user_name TEXT NOT NULL,
            pdf_name TEXT NOT NULL,
            engine TEXT NOT NULL,
            model_used TEXT,
            pages_count INTEGER NOT NULL,
            input_tokens INTEGER DEFAULT 0,
            output_tokens INTEGER DEFAULT 0,
            total_tokens INTEGER DEFAULT 0,
            estimated_cost REAL DEFAULT 0.0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()

    # Seed default super admin if none exists
    if not has_super_admin():
        create_user("Super Admin", "admin", "admin123", role="super_admin")

# Password hashing helpers
def hash_password(password: str, salt: str = None) -> tuple[str, str]:
    if not salt:
        salt = secrets.token_hex(16)
    pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000).hex()
    return pwd_hash, salt

def verify_password(password: str, pwd_hash: str, salt: str) -> bool:
    new_hash, _ = hash_password(password, salt)
    return secrets.compare_digest(pwd_hash, new_hash)

# User operations
def has_super_admin() -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'super_admin'")
    count = cursor.fetchone()[0]
    conn.close()
    return count > 0

def create_user(name: str, username: str, password: str, role: str = 'user') -> dict:
    conn = get_connection()
    cursor = conn.cursor()
    pwd_hash, salt = hash_password(password)
    try:
        cursor.execute(
            "INSERT INTO users (name, username, password_hash, salt, role) VALUES (?, ?, ?, ?, ?)",
            (name, username.strip().lower(), pwd_hash, salt, role)
        )
        user_id = cursor.lastrowid
        conn.commit()
        return {"id": user_id, "name": name, "username": username, "role": role}
    finally:
        conn.close()

def authenticate_user(username: str, password: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username.strip().lower(),))
    user = cursor.fetchone()
    conn.close()
    if not user:
        return None
    if verify_password(password, user["password_hash"], user["salt"]):
        return dict(user)
    return None

def create_session(user_id: int) -> str:
    token = secrets.token_hex(32)
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, user_id))
    conn.commit()
    conn.close()
    return token

def get_user_by_session(token: str):
    if not token:
        return None
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT users.id, users.name, users.username, users.role 
        FROM sessions 
        JOIN users ON sessions.user_id = users.id 
        WHERE sessions.token = ?
    ''', (token,))
    user = cursor.fetchone()
    conn.close()
    return dict(user) if user else None

def delete_session(token: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sessions WHERE token = ?", (token,))
    conn.commit()
    conn.close()

def list_all_users():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, username, role, created_at FROM users ORDER BY id ASC")
    users = [dict(u) for u in cursor.fetchall()]
    conn.close()
    return users

def delete_user_by_id(user_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    # Don't delete if it's the last super_admin
    cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    if row and row["role"] == "super_admin":
        cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'super_admin'")
        if cursor.fetchone()[0] <= 1:
            conn.close()
            raise ValueError("Cannot delete the only Super Admin account!")
            
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()

# Settings (Gemini API Key)
def set_setting(key: str, value: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)", (key, value))
    conn.commit()
    conn.close()

def get_setting(key: str) -> str:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key = ?", (key,))
    row = cursor.fetchone()
    conn.close()
    return row["value"] if row else None

# Audit Logs
def add_extraction_log(user_id: int, user_name: str, pdf_name: str, engine: str, model_used: str, pages_count: int, input_tokens: int, output_tokens: int, total_tokens: int, cost: float):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO logs (user_id, user_name, pdf_name, engine, model_used, pages_count, input_tokens, output_tokens, total_tokens, estimated_cost)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (user_id, user_name, pdf_name, engine, model_used, pages_count, input_tokens, output_tokens, total_tokens, cost))
    conn.commit()
    conn.close()

def get_recent_logs(limit: int = 100):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM logs ORDER BY id DESC LIMIT ?", (limit,))
    logs = [dict(l) for l in cursor.fetchall()]
    conn.close()
    return logs

def update_user_password(user_id: int, new_password: str):
    hashed_pw = hashlib.sha256(new_password.encode('utf-8')).hexdigest()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('UPDATE users SET password_hash = ? WHERE id = ?', (hashed_pw, user_id))
        if cursor.rowcount == 0:
            raise ValueError('User not found')
        conn.commit()
