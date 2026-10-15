const TOKEN_KEY = 'gvcn_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: any;
    token?: string | null;
  } = {}
): Promise<T> {
  const token = options.token !== undefined ? options.token : getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Prepend VITE_BACKEND_URL if set (for separate backend deployment), otherwise relative path
  const backendBase = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${backendBase}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (netErr: any) {
    throw new Error(`Không thể kết nối đến máy chủ: ${netErr.message || 'Lỗi mạng'}`);
  }

  const rawText = await response.text();
  let data: any = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    // If not JSON (e.g. HTML 404 error from Vercel)
    data = {};
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        data.error ||
          'Lỗi 404 (Không tìm thấy API): Vui lòng kiểm tra xem bạn đã đẩy file vercel.json và thư mục api/ lên GitHub để Vercel kích hoạt Serverless Function chưa.'
      );
    }
    throw new Error(data.error || `Lỗi máy chủ (${response.status})`);
  }

  return data as T;
}
