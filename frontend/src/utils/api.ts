// @ts-nocheck
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const authHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
    return token ? { 'Authorization': 'Bearer ' + token } : {};
};
