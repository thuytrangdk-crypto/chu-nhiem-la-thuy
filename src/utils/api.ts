const TOKEN_KEY = 'gvcn_auth_token';

// In-memory version tracker only (NEVER cached in localStorage across sessions to prevent stale versions)
interface ClientVersionState {
  version?: number;
  revisionToken?: string;
  updatedAt?: string;
}

let activeVersionState: ClientVersionState | null = null;

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

export function getActiveVersionState(): ClientVersionState | null {
  return activeVersionState;
}

export function setActiveVersionState(state: ClientVersionState | null) {
  activeVersionState = state;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    body?: any;
    token?: string | null;
  } = {}
): Promise<T> {
  const token = options.token !== undefined ? options.token : getStoredToken();
  const method = (options.method || 'GET').toUpperCase();

  // Strict no-cache headers so responses are never served stale by the browser
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Attach atomic concurrency versioning headers for all mutating operations
  const currentVersion = getActiveVersionState();
  if (currentVersion && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    if (currentVersion.version !== undefined) {
      headers['X-Client-Version'] = String(currentVersion.version);
    } else if (currentVersion.updatedAt) {
      headers['X-Client-Version'] = currentVersion.updatedAt;
    }

    if (currentVersion.revisionToken) {
      headers['X-Client-Revision-Token'] = currentVersion.revisionToken;
    }
  }

  // Also include version metadata in body if plain object
  let reqBody = options.body;
  if (
    currentVersion &&
    reqBody &&
    typeof reqBody === 'object' &&
    !Array.isArray(reqBody)
  ) {
    reqBody = {
      ...reqBody,
      clientVersion: reqBody.clientVersion ?? (currentVersion.version ?? currentVersion.updatedAt),
      clientRevisionToken: reqBody.clientRevisionToken ?? currentVersion.revisionToken,
    };
  }

  const backendBase = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${backendBase}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: reqBody ? JSON.stringify(reqBody) : undefined,
    });
  } catch (netErr: any) {
    throw new Error(`Không thể kết nối đến máy chủ: ${netErr.message || 'Lỗi mạng'}`);
  }

  const rawText = await response.text();
  let data: any = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        data.error ||
          'Lỗi 404 (Không tìm thấy API): Vui lòng kiểm tra xem bạn đã đẩy file vercel.json và thư mục api/ lên GitHub để Vercel kích hoạt Serverless Function chưa.'
      );
    }
    if (response.status === 409) {
      const conflictMsg =
        data.error ||
        'DỮ LIỆU ĐÃ THAY ĐỔI: Dữ liệu trên hệ thống đã được cập nhật bởi một phiên làm việc khác (hoặc trên thiết bị khác). Để đảm bảo không ghi đè dữ liệu mới, thao tác này đã tạm dừng. Vui lòng tải lại trang (F5) để lấy dữ liệu mới nhất trước khi thực hiện lại.';

      // Dispatch event for UI components to show a refresh prompt if listening
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('gvcn-concurrency-conflict', {
            detail: { message: conflictMsg },
          })
        );
      }
      throw new Error(conflictMsg);
    }
    throw new Error(data.error || `Lỗi máy chủ (${response.status})`);
  }

  // Update in-memory active version from response (never from stale cache)
  if (data && typeof data === 'object') {
    const newVersion = data.version !== undefined ? Number(data.version) : undefined;
    const newRevisionToken = typeof data.revision_token === 'string' ? data.revision_token : undefined;
    const newUpdatedAt = typeof data.updated_at === 'string' ? data.updated_at : undefined;

    if (newVersion !== undefined || newRevisionToken || newUpdatedAt) {
      setActiveVersionState({
        version: newVersion,
        revisionToken: newRevisionToken,
        updatedAt: newUpdatedAt,
      });
    }
  }

  return data as T;
}
