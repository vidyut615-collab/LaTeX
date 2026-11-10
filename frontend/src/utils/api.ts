export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const authHeaders = (): Record<string, string> => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('session_token');
        if (token) {
            return { 'Authorization': 'Bearer ' + token };
        }
    }
    return {};
};
