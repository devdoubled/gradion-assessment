import { jwtDecode } from 'jwt-decode';

interface JwtPayload {
  sub: string;
  email: string;
  role: 'user' | 'admin';
  exp: number;
}

const TOKEN_KEY = 'accessToken';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getRole(): 'user' | 'admin' | null {
  const token = getToken();
  if (!token) return null;
  try {
    return jwtDecode<JwtPayload>(token).role;
  } catch {
    return null;
  }
}

export function getUserEmail(): string | null {
  const token = getToken();
  if (!token) return null;
  try {
    return jwtDecode<JwtPayload>(token).email;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;
  try {
    const decoded = jwtDecode<JwtPayload>(token);
    return decoded.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}
