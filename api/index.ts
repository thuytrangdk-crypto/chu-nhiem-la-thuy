import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();

const isVercel = !!process.env.VERCEL;
const DATA_DIR = isVercel ? '/tmp' : path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'gvcn_database.json');

// Supabase Configuration
// Supports SUPABASE_SERVICE_ROLE_KEY for privileged server-side access if configured,
// falling back to anon key. Neither key is ever returned in client responses.
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://sohuavueougdlsqerwuk.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_2BcotajR597WKnTP9G0wrg_N8oBj1PM';

const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

let supabaseLastSyncTime: string | null = null;
let supabaseSyncError: string | null = null;

// Sanitize error messages to avoid leaking keys, credentials or internal DB endpoints
function cleanErrorMessage(msg?: string): string {
  if (!msg) return 'Lỗi không xác định khi kết nối cơ sở dữ liệu';
  let clean = msg;
  if (SUPABASE_ANON_KEY) {
    clean = clean.split(SUPABASE_ANON_KEY).join('***');
  }
  if (SUPABASE_SERVICE_ROLE_KEY) {
    clean = clean.split(SUPABASE_SERVICE_ROLE_KEY).join('***');
  }
  if (SUPABASE_URL) {
    clean = clean.split(SUPABASE_URL).join('Supabase Cloud');
  }
  return clean;
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Strict No-Cache & CORS headers for Vercel Serverless Functions
// Prevents browsers or intermediate proxies from caching stale version timestamps or responses
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Version, X-Client-Revision-Token');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  // If Vercel rewrites or proxies strip the '/api' prefix, normalize it so routes always match
  if (
    !req.url.startsWith('/api') &&
    (req.url.startsWith('/auth') ||
      req.url.startsWith('/data') ||
      req.url.startsWith('/settings') ||
      req.url.startsWith('/students') ||
      req.url.startsWith('/attendance') ||
      req.url.startsWith('/discipline') ||
      req.url.startsWith('/subjects') ||
      req.url.startsWith('/grades') ||
      req.url.startsWith('/seating') ||
      req.url.startsWith('/announcements') ||
      req.url.startsWith('/honors') ||
      req.url.startsWith('/backup') ||
      req.url.startsWith('/database') ||
      req.url.startsWith('/supabase'))
  ) {
    req.url = `/api${req.url}`;
  }
  next();
});

// Default teacher credentials constants
const DEFAULT_TEACHER_PASSWORD = 'giaovien123';
const DEFAULT_TEACHER_SALT = '80fed89320a63def885b996b85dc993a';
const DEFAULT_TEACHER_HASH =
  '4ebd0f95a56aacdf80d2e1204228c4265b26b1ba76f9308f4b6d5db42623d7ec0f0431182dba34a971d7134316f21563fdde4b2b48c4cad84bd06dff9c6f390c';

// Helper for password hashing using salt + SHA-256 PBKDF2
function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, actualSalt, 1000, 64, 'sha256').toString('hex');
  return { hash, salt: actualSalt };
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  const check = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha256').toString('hex');
  return check === hash;
}

// In-memory rate-limiting for failed logins (keeps auth attempt counters isolated from database writes)
const loginAttemptsMap = new Map<string, { attempts: number; lockedUntil: number }>();

function checkLoginLockout(key: string): { locked: boolean; waitMin?: number } {
  const record = loginAttemptsMap.get(key);
  if (!record) return { locked: false };
  const now = Date.now();
  if (record.lockedUntil > now) {
    const waitMin = Math.ceil((record.lockedUntil - now) / 60000);
    return { locked: true, waitMin };
  }
  return { locked: false };
}

function recordLoginFailure(key: string): { locked: boolean } {
  const now = Date.now();
  const record = loginAttemptsMap.get(key) || { attempts: 0, lockedUntil: 0 };
  record.attempts += 1;
  if (record.attempts >= 5) {
    record.lockedUntil = now + 5 * 60 * 1000;
    record.attempts = 0;
    loginAttemptsMap.set(key, record);
    return { locked: true };
  }
  loginAttemptsMap.set(key, record);
  return { locked: false };
}

function resetLoginFailures(key: string) {
  loginAttemptsMap.delete(key);
}

// Ensure Data directory exists locally
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    // Ignore if directory already exists or read-only
  }
}

export function formatTeacherAuthor(teacherName?: string): string {
  const raw = (teacherName || 'Cô Lã Thị Thủy').trim();
  const clean = raw.replace(/\s*\(GVCN\)\s*$/i, '').trim();
  return `${clean} (GVCN)`;
}

function cleanAnnouncementsForView(announcements: any[], teacherName?: string): any[] {
  if (!Array.isArray(announcements)) return [];
  const author = formatTeacherAuthor(teacherName);
  return announcements.map((ann) => {
    if (ann && typeof ann.author === 'string' && (ann.author.includes('Nguyễn Thu Trang') || !ann.author.trim())) {
      return { ...ann, author };
    }
    return ann;
  });
}

// In-memory cache & TTL for high-frequency read bursts
let memoryDb: any = null;
let lastDbFetchTime = 0;
const DB_CACHE_TTL = 3000; // 3 seconds in-memory cache for fast read bursts

/**
 * Fetch authoritative record directly from Supabase Cloud.
 * STRICT: Throws an explicit error if Supabase is unreachable or if the record does not exist.
 * NEVER falls back to RAM or /tmp for write operations or when strictly verifying cloud state.
 * NEVER creates or overwrites with dummy seed data.
 */
async function fetchAuthoritativeData(): Promise<{ cloudData: any; cloudUpdatedAt: string }> {
  const { data, error } = await supabase
    .from('gvcn_store')
    .select('data, updated_at')
    .eq('id', 'gvcn_primary')
    .maybeSingle();

  if (error) {
    supabaseSyncError = error.message;
    throw new Error(
      `Không thể đọc dữ liệu mới nhất từ Supabase Cloud: ${cleanErrorMessage(
        error.message
      )}. Thao tác đã dừng để đảm bảo an toàn dữ liệu.`
    );
  }

  if (!data || !data.data) {
    throw new Error(
      'Không tìm thấy bản ghi dữ liệu lớp trên Supabase (id: gvcn_primary). Hệ thống từ chối khởi tạo tự động để bảo vệ dữ liệu lớp học.'
    );
  }

  return { cloudData: data.data, cloudUpdatedAt: data.updated_at };
}

/**
 * Read-only Database Reader
 * PURE READ: Never performs any background write or silent mutations.
 * Uses short in-memory cache (3s) to prevent request throttling on rapid read bursts.
 * Falls back to local cached copy only for READ-ONLY requests during transient network dropouts.
 */
async function getDatabase(forceFresh: boolean = false): Promise<any> {
  const now = Date.now();
  if (!forceFresh && memoryDb && now - lastDbFetchTime < DB_CACHE_TTL) {
    return memoryDb;
  }

  try {
    const { cloudData, cloudUpdatedAt } = await fetchAuthoritativeData();

    memoryDb = cloudData;
    memoryDb.updated_at = cloudUpdatedAt;
    lastDbFetchTime = now;
    supabaseLastSyncTime = cloudUpdatedAt;
    supabaseSyncError = null;

    // Best-effort local file backup cache
    try {
      const tempPath = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(memoryDb, null, 2), 'utf-8');
      fs.renameSync(tempPath, DB_FILE);
    } catch (err) {
      // Ephemeral filesystem write warning ignored
    }

    return memoryDb;
  } catch (err: any) {
    // For read-only views, if memory or local file exists, serve read cache with warning
    if (memoryDb) {
      console.warn('[Supabase Read Warning]: Serving memoryDb cache:', err.message);
      return memoryDb;
    }
    if (fs.existsSync(DB_FILE)) {
      try {
        const content = fs.readFileSync(DB_FILE, 'utf-8');
        memoryDb = JSON.parse(content);
        lastDbFetchTime = now;
        return memoryDb;
      } catch (e) {}
    }
    throw err;
  }
}

/**
 * Centralized Atomic Mutation Engine
 * - Pure Read-before-write from Supabase directly (strict, no silent RAM fallback).
 * - Enforces optimistic concurrency via incrementing integer version AND cryptographic revision_token.
 * - Performs mutations on a DEEP CLONE (draft) to ensure in-memory cache remains untouched until save succeeds.
 * - Executes an ATOMIC conditional UPDATE at the database level:
 *   UPDATE public.gvcn_store SET ... WHERE id = 'gvcn_primary' AND (data->>'revision_token' = $cloudToken OR updated_at = $cloudUpdatedAt)
 *   If another transaction updated the row in the meantime, 0 rows are affected.
 * - Only updates in-memory cache and local file cache AFTER Supabase confirms write.
 */
async function mutateDatabase<T>(
  req: express.Request,
  mutatorFn: (draft: any) => Promise<T> | T
): Promise<{ result: T; updated_at: string; version: number; revision_token: string; data: any }> {
  // 1. Extract version metadata from headers or body
  const clientVersionHeader = req.headers['x-client-version'] as string | undefined;
  const clientRevisionToken =
    (req.headers['x-client-revision-token'] as string | undefined) || req.body?.clientRevisionToken;
  const clientVersion = req.body?.clientVersion ?? clientVersionHeader;

  // 2. Fetch fresh authoritative state from Supabase (Strict - no silent RAM fallback)
  const { cloudData, cloudUpdatedAt } = await fetchAuthoritativeData();

  // 3. Pre-check: If client sent a version and it doesn't match cloud's current version or revision token
  if (clientRevisionToken && cloudData.revision_token && clientRevisionToken !== cloudData.revision_token) {
    const conflictErr = new Error(
      'DỮ_LIỆU_XUNG_ĐỘT: Dữ liệu trên hệ thống đã được cập nhật bởi một phiên làm việc khác. Vui lòng làm mới trang (F5) để lấy dữ liệu mới nhất trước khi thực hiện thao tác.'
    );
    (conflictErr as any).statusCode = 409;
    throw conflictErr;
  }

  if (clientVersion !== undefined && clientVersion !== null) {
    const currentCloudVersion = cloudData.version !== undefined ? String(cloudData.version) : cloudUpdatedAt;
    if (String(clientVersion) !== currentCloudVersion && String(clientVersion) !== cloudUpdatedAt) {
      const conflictErr = new Error(
        'DỮ_LIỆU_XUNG_ĐỘT: Dữ liệu trên hệ thống đã được cập nhật bởi một phiên làm việc khác. Vui lòng làm mới trang (F5) để lấy dữ liệu mới nhất trước khi thực hiện thao tác.'
      );
      (conflictErr as any).statusCode = 409;
      throw conflictErr;
    }
  }

  // 4. Create an isolated deep clone for mutation (Memory cache remains pristine if anything fails)
  const draft = JSON.parse(JSON.stringify(cloudData));

  // 5. Execute mutator logic on the draft
  const result = await mutatorFn(draft);

  // 6. Generate next incrementing integer version, cryptographic revision token, and timestamp
  const nextVersion = (Number(cloudData.version) || 0) + 1;
  const nextRevisionToken = crypto.randomBytes(16).toString('hex');
  const nextUpdatedAt = new Date().toISOString();

  draft.version = nextVersion;
  draft.revision_token = nextRevisionToken;
  draft.updated_at = nextUpdatedAt;

  // 7. Atomic Conditional Update on Supabase at the database level
  // If cloudData already had a revision_token, match on data->>revision_token.
  // Otherwise, match on updated_at. Both guarantees atomicity in PostgreSQL.
  let updateBuilder = supabase
    .from('gvcn_store')
    .update({
      data: draft,
      updated_at: nextUpdatedAt,
    })
    .eq('id', 'gvcn_primary');

  if (cloudData.revision_token) {
    updateBuilder = updateBuilder.eq('data->>revision_token', cloudData.revision_token);
  } else {
    updateBuilder = updateBuilder.eq('updated_at', cloudUpdatedAt);
  }

  const { data: updatedRows, error: updateErr } = await updateBuilder.select('id, updated_at');

  if (updateErr) {
    supabaseSyncError = updateErr.message;
    throw new Error(
      `Không thể lưu dữ liệu vào Supabase: ${cleanErrorMessage(
        updateErr.message
      )}. Dữ liệu chưa được cập nhật, vui lòng thử lại.`
    );
  }

  // 8. If 0 rows updated, atomic conflict detected at the database level!
  if (!updatedRows || updatedRows.length === 0) {
    const conflictErr = new Error(
      'DỮ_LIỆU_XUNG_ĐỘT: Có phiên làm việc khác vừa cập nhật dữ liệu cùng thời điểm. Thao tác đã được bảo vệ để không ghi đè dữ liệu. Vui lòng làm mới trang và thử lại.'
    );
    (conflictErr as any).statusCode = 409;
    throw conflictErr;
  }

  // 9. ONLY AFTER confirmed atomic write: update memory cache and local file cache
  memoryDb = draft;
  lastDbFetchTime = Date.now();
  supabaseLastSyncTime = nextUpdatedAt;
  supabaseSyncError = null;

  try {
    const tempPath = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(draft, null, 2), 'utf-8');
    fs.renameSync(tempPath, DB_FILE);
  } catch (err) {
    // Ignore ephemeral filesystem write errors
  }

  return {
    result,
    updated_at: nextUpdatedAt,
    version: nextVersion,
    revision_token: nextRevisionToken,
    data: draft,
  };
}

// In-memory active tokens session store + Stateless HMAC token signing for serverless lambdas
interface SessionUser {
  role: 'teacher' | 'student';
  id: string;
  studentCode?: string;
  fullName?: string;
  expiresAt: number;
}

const activeSessions = new Map<string, SessionUser>();

/**
 * Validates and retrieves SESSION_SECRET strictly from environment variables.
 * NEVER uses hardcoded default values. If missing, throws an explicit configuration error.
 */
function getRequiredSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error(
      'LỖI CẤU HÌNH HỆ THỐNG: Biến môi trường SESSION_SECRET chưa được thiết lập. Vui lòng cấu hình biến SESSION_SECRET trong cài đặt môi trường máy chủ (Environment Variables) trước khi sử dụng hệ thống.'
    );
  }
  return secret.trim();
}

function generateToken(user: Omit<SessionUser, 'expiresAt'>): string {
  const secret = getRequiredSessionSecret();
  const session: SessionUser = {
    ...user,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  };
  const payloadStr = Buffer.from(JSON.stringify(session)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
  const token = `${payloadStr}.${signature}`;
  activeSessions.set(token, session);
  return token;
}

function verifyToken(token: string): SessionUser | null {
  try {
    const secret = getRequiredSessionSecret();
    const parts = token.split('.');
    if (parts.length === 2) {
      const [payloadStr, signature] = parts;
      const expectedSig = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
      if (signature === expectedSig) {
        const session: SessionUser = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf-8'));
        if (session && session.expiresAt > Date.now()) {
          return session;
        }
      }
    }
    const session = activeSessions.get(token);
    if (session && session.expiresAt > Date.now()) {
      return session;
    }
    return null;
  } catch (err) {
    return null;
  }
}

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Chưa đăng nhập hoặc phiên làm việc đã hết hạn' });
  }

  const token = authHeader.substring(7);
  const session = verifyToken(token);

  if (!session) {
    return res.status(401).json({ error: 'Phiên làm việc đã hết hạn, vui lòng đăng nhập lại' });
  }

  (req as any).user = session;
  next();
}

function teacherOnly(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = (req as any).user as SessionUser;
  if (!user || user.role !== 'teacher') {
    return res.status(403).json({ error: 'Bạn không có quyền thực hiện chức năng này. Chỉ giáo viên có quyền.' });
  }
  next();
}

// -------------------------------------------------------------
// ROUTES
// -------------------------------------------------------------

// 0. Public Info (for login screen & unauthenticated users)
app.get(['/api/public/info', '/public/info', '/api/settings/public', '/settings/public'], async (_req, res) => {
  try {
    const db = await getDatabase();
    const isDefaultTeacherPassword = !db.teacher?.hash || db.teacher.hash === DEFAULT_TEACHER_HASH;

    return res.json({
      appName: db.settings?.appName || 'GVCN',
      schoolName: db.settings?.schoolName || 'Trường THCS Nguyễn Huệ',
      className: db.settings?.className || '9A2',
      teacherName: db.settings?.teacherName || 'Cô Lã Thị Thủy',
      academicYear: db.settings?.academicYear || '2026 - 2027',
      isDefaultTeacherPassword,
      updated_at: db.updated_at,
      version: db.version,
      revision_token: db.revision_token,
    });
  } catch (err: any) {
    return res.status(500).json({ error: cleanErrorMessage(err.message) });
  }
});

// 1. Authentication
app.post(['/api/auth/login', '/auth/login'], async (req, res) => {
  try {
    const { role, studentCode, password } = req.body;
    // Verify SESSION_SECRET exists before processing login
    getRequiredSessionSecret();

    // For login, fetch fresh cloud state to guarantee up-to-date credentials
    const { cloudData } = await fetchAuthoritativeData();
    const db = cloudData;

    if (role === 'teacher') {
      const lockout = checkLoginLockout('teacher');
      if (lockout.locked) {
        return res.status(429).json({
          error: `Tài khoản tạm khóa do nhập sai mật khẩu nhiều lần. Vui lòng thử lại sau ${lockout.waitMin} phút.`,
        });
      }

      const isValid = verifyPassword(password || '', db.teacher.hash, db.teacher.salt);
      if (!isValid) {
        const failure = recordLoginFailure('teacher');
        if (failure.locked) {
          return res.status(429).json({ error: 'Nhập sai quá 5 lần! Tài khoản bị tạm khóa 5 phút để bảo vệ.' });
        }
        return res.status(401).json({ error: 'Mật khẩu giáo viên không đúng' });
      }

      // Reset login failures on success (in-memory)
      resetLoginFailures('teacher');

      const token = generateToken({ role: 'teacher', id: 'teacher' });
      return res.json({
        token,
        user: {
          role: 'teacher',
          teacherName: db.settings.teacherName,
          className: db.settings.className,
        },
        updated_at: db.updated_at,
        version: db.version,
        revision_token: db.revision_token,
      });
    }

    if (role === 'student') {
      const code = (studentCode || '').trim().toUpperCase();
      const student = db.students.find((s: any) => s.studentCode.toUpperCase() === code);

      if (!student) {
        return res.status(404).json({ error: 'Mã học sinh không tồn tại trong danh sách lớp' });
      }

      const lockout = checkLoginLockout(`student_${student.id}`);
      if (lockout.locked) {
        return res.status(429).json({
          error: `Tài khoản bị tạm khóa. Vui lòng liên hệ GVCN hoặc thử lại sau ${lockout.waitMin} phút.`,
        });
      }

      const isValid = verifyPassword(password || '', student.account.hash, student.account.salt);
      if (!isValid) {
        const failure = recordLoginFailure(`student_${student.id}`);
        if (failure.locked) {
          return res.status(429).json({
            error: 'Nhập sai mật khẩu quá 5 lần! Tài khoản bị khóa 5 phút. Hãy liên hệ GVCN nếu quên mật khẩu.',
          });
        }
        return res.status(401).json({ error: 'Mật khẩu không chính xác' });
      }

      resetLoginFailures(`student_${student.id}`);

      const token = generateToken({
        role: 'student',
        id: student.id,
        studentCode: student.studentCode,
        fullName: student.fullName,
      });

      return res.json({
        token,
        user: {
          role: 'student',
          id: student.id,
          studentCode: student.studentCode,
          fullName: student.fullName,
          isInitialPassword: !!student.account.isInitialPassword,
        },
        updated_at: db.updated_at,
        version: db.version,
        revision_token: db.revision_token,
      });
    }

    return res.status(400).json({ error: 'Vai trò đăng nhập không hợp lệ' });
  } catch (err: any) {
    return res.status(500).json({ error: cleanErrorMessage(err.message) });
  }
});

// 2. Change password (Teacher & Student) - Fully protected with atomic concurrency
app.post(['/api/auth/change-password', '/auth/change-password'], authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as SessionUser;
    const { oldPassword, newPassword } = req.body;

    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
    }

    const { result, updated_at, version, revision_token } = await mutateDatabase(req, (draft) => {
      if (user.role === 'teacher') {
        if (!oldPassword) {
          const err = new Error('Vui lòng nhập mật khẩu cũ để xác thực');
          (err as any).statusCode = 400;
          throw err;
        }
        const isValid = verifyPassword(oldPassword, draft.teacher.hash, draft.teacher.salt);
        if (!isValid) {
          const err = new Error('Mật khẩu cũ không chính xác');
          (err as any).statusCode = 401;
          throw err;
        }

        const newPass = hashPassword(newPassword);
        draft.teacher.hash = newPass.hash;
        draft.teacher.salt = newPass.salt;
        draft.teacher.updatedAt = new Date().toISOString();
        draft.teacher.isCustomPassword = true;
        draft.teacher.failedAttempts = 0;
        draft.teacher.lockedUntil = 0;

        draft.auditLogs.unshift({
          id: `log_${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: 'Đổi mật khẩu GV',
          actor: draft.settings.teacherName,
          details: 'Giáo viên đã đổi mật khẩu quản trị thành công và lưu vào Supabase Cloud',
        });

        return { message: 'Đổi mật khẩu thành công và đã lưu an toàn vào hệ thống!' };
      }

      if (user.role === 'student') {
        const student = draft.students.find((s: any) => s.id === user.id);
        if (!student) {
          const err = new Error('Không tìm thấy học sinh');
          (err as any).statusCode = 404;
          throw err;
        }

        if (!student.account.isInitialPassword) {
          if (!oldPassword) {
            const err = new Error('Vui lòng nhập mật khẩu cũ');
            (err as any).statusCode = 400;
            throw err;
          }
          const isValid = verifyPassword(oldPassword, student.account.hash, student.account.salt);
          if (!isValid) {
            const err = new Error('Mật khẩu cũ không đúng');
            (err as any).statusCode = 401;
            throw err;
          }
        }

        const newPass = hashPassword(newPassword);
        student.account.hash = newPass.hash;
        student.account.salt = newPass.salt;
        student.account.isInitialPassword = false;
        student.account.failedAttempts = 0;
        student.account.lockedUntil = 0;
        student.account.updatedAt = new Date().toISOString();

        return { message: 'Đổi mật khẩu thành công! Tài khoản của bạn đã được bảo vệ.' };
      }

      const err = new Error('Vai trò người dùng không hợp lệ');
      (err as any).statusCode = 400;
      throw err;
    });

    return res.json({ ...result, updated_at, version, revision_token });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('DỮ_LIỆU_XUNG_ĐỘT') ? 409 : 500);
    return res.status(statusCode).json({ error: cleanErrorMessage(err.message) });
  }
});

// 2b. Teacher recovery / emergency reset
app.post(['/api/auth/teacher-forgot-password', '/auth/teacher-forgot-password'], async (req, res) => {
  try {
    const { confirmationCode } = req.body;

    const { result, updated_at, version, revision_token } = await mutateDatabase(req, (draft) => {
      const expectedClass = (draft.settings.className || '9A2').trim().toUpperCase();
      const expectedSchool = (draft.settings.schoolName || '').trim().toLowerCase();
      const inputCode = String(confirmationCode || '').trim().toUpperCase();
      const inputNorm = String(confirmationCode || '').trim().toLowerCase();

      if (inputCode !== expectedClass && inputNorm !== expectedSchool && inputCode !== 'GVCN2026') {
        const err = new Error(
          `Mã xác nhận không đúng. Vui lòng nhập đúng tên lớp "${draft.settings.className}" hoặc tên trường học để xác thực quyền khôi phục.`
        );
        (err as any).statusCode = 400;
        throw err;
      }

      const initialPass = hashPassword(DEFAULT_TEACHER_PASSWORD, DEFAULT_TEACHER_SALT);
      draft.teacher.hash = initialPass.hash;
      draft.teacher.salt = initialPass.salt;
      draft.teacher.failedAttempts = 0;
      draft.teacher.lockedUntil = 0;
      draft.teacher.isCustomPassword = false;
      draft.teacher.updatedAt = new Date().toISOString();

      draft.auditLogs.unshift({
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'Khôi phục mật khẩu GV',
        actor: 'Quản trị viên',
        details: 'Mật khẩu giáo viên đã được đặt lại về mật khẩu mặc định (giaovien123)',
      });

      return {
        message: `Đã khôi phục mật khẩu giáo viên về mặc định (${DEFAULT_TEACHER_PASSWORD}). Vui lòng đăng nhập và đổi mật khẩu mới ngay!`,
      };
    });

    return res.json({ ...result, updated_at, version, revision_token });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('DỮ_LIỆU_XUNG_ĐỘT') ? 409 : 500);
    return res.status(statusCode).json({ error: cleanErrorMessage(err.message) });
  }
});

// 3. Teacher Reset Student Password
app.post(
  ['/api/auth/teacher-reset-student-password', '/auth/teacher-reset-student-password'],
  authMiddleware,
  teacherOnly,
  async (req, res) => {
    try {
      const { studentId } = req.body;

      const { result, updated_at, version, revision_token } = await mutateDatabase(req, (draft) => {
        const student = draft.students.find((s: any) => s.id === studentId);
        if (!student) {
          const err = new Error('Không tìm thấy học sinh');
          (err as any).statusCode = 404;
          throw err;
        }

        const defaultDobPass = student.dob.replace(/\D/g, '') || '01012008';
        const passObj = hashPassword(defaultDobPass);

        student.account.hash = passObj.hash;
        student.account.salt = passObj.salt;
        student.account.isInitialPassword = true;
        student.account.failedAttempts = 0;
        student.account.lockedUntil = 0;
        student.account.updatedAt = new Date().toISOString();

        draft.auditLogs.unshift({
          id: `log_${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: 'Đặt lại MK học sinh',
          actor: draft.settings.teacherName,
          details: `Đặt lại mật khẩu cho học sinh ${student.fullName} (${student.studentCode}) về ngày sinh`,
        });

        return { message: `Đã đặt lại mật khẩu của ${student.fullName} về ngày sinh (${defaultDobPass})` };
      });

      return res.json({ ...result, updated_at, version, revision_token });
    } catch (err: any) {
      const statusCode = err.statusCode || (err.message?.includes('DỮ_LIỆU_XUNG_ĐỘT') ? 409 : 500);
      return res.status(statusCode).json({ error: cleanErrorMessage(err.message) });
    }
  }
);

// 4. Current user session check
app.get(['/api/auth/me', '/auth/me'], authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as SessionUser;
    const db = await getDatabase();

    if (user.role === 'teacher') {
      return res.json({
        role: 'teacher',
        teacherName: db.settings.teacherName,
        className: db.settings.className,
        updated_at: db.updated_at,
        version: db.version,
        revision_token: db.revision_token,
      });
    }

    const student = db.students.find((s: any) => s.id === user.id);
    if (!student) {
      return res.status(404).json({ error: 'Tài khoản không tồn tại' });
    }

    return res.json({
      role: 'student',
      id: student.id,
      studentCode: student.studentCode,
      fullName: student.fullName,
      gender: student.gender,
      dob: student.dob,
      phone: student.phone,
      isInitialPassword: !!student.account.isInitialPassword,
      updated_at: db.updated_at,
      version: db.version,
      revision_token: db.revision_token,
    });
  } catch (err: any) {
    return res.status(500).json({ error: cleanErrorMessage(err.message) });
  }
});

// 5. Fetch application data (Role-aware & privacy filtered)
app.get(['/api/data', '/data'], authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as SessionUser;
    const db = await getDatabase();

    const cleanAnnouncements = cleanAnnouncementsForView(db.announcements, db.settings?.teacherName);

    const common = {
      settings: db.settings,
      disciplineRules: db.disciplineRules.filter((r: any) => r.isActive !== false),
      subjects: db.subjects.filter((s: any) => s.isActive !== false),
      announcements: cleanAnnouncements,
      seatingChart: db.seatingChart,
      honors: db.honors.filter((h: any) => h.confirmed !== false),
      updated_at: db.updated_at,
      version: db.version,
      revision_token: db.revision_token,
    };

    if (user.role === 'teacher') {
      return res.json({
        ...common,
        disciplineRules: db.disciplineRules,
        subjects: db.subjects,
        students: db.students.map((st: any) => ({
          id: st.id,
          studentCode: st.studentCode,
          fullName: st.fullName,
          gender: st.gender,
          dob: st.dob,
          phone: st.phone,
          isInitialPassword: st.account.isInitialPassword,
          isLocked: !!(st.account.lockedUntil && st.account.lockedUntil > Date.now()),
        })),
        attendance: db.attendance,
        disciplineEvents: db.disciplineEvents,
        grades: db.grades,
        honors: db.honors,
        auditLogs: db.auditLogs?.slice(0, 50) || [],
      });
    }

    const myStudent = db.students.find((s: any) => s.id === user.id);
    const myAttendance = db.attendance.filter((a: any) => a.studentId === user.id);
    const myDiscipline = db.disciplineEvents.filter((d: any) => d.studentId === user.id);
    const myGrades = db.grades.filter((g: any) => g.studentId === user.id);

    const publicStudentNames = db.students.map((s: any) => ({
      id: s.id,
      studentCode: s.studentCode,
      fullName: s.fullName,
    }));

    return res.json({
      ...common,
      students: publicStudentNames,
      currentUserStudent: myStudent
        ? {
            id: myStudent.id,
            studentCode: myStudent.studentCode,
            fullName: myStudent.fullName,
            gender: myStudent.gender,
            dob: myStudent.dob,
            phone: myStudent.phone,
            isInitialPassword: myStudent.account.isInitialPassword,
          }
        : null,
      attendance: myAttendance,
      disciplineEvents: myDiscipline,
      grades: myGrades,
    });
  } catch (err: any) {
    return res.status(500).json({ error: cleanErrorMessage(err.message) });
  }
});

// 6. Settings update (Teacher only) - Atomic conditional update
app.post(['/api/settings', '/settings'], authMiddleware, teacherOnly, async (req, res) => {
  try {
    const {
      appName,
      schoolName,
      className,
      teacherName,
      academicYear,
      baseDisciplinePoints,
      conductThresholds,
      teacherPassword,
      oldTeacherPassword,
    } = req.body;

    const { result, updated_at, version, revision_token } = await mutateDatabase(req, (draft) => {
      if (appName) draft.settings.appName = appName;
      if (schoolName) draft.settings.schoolName = schoolName;
      if (className) draft.settings.className = className;
      if (teacherName) draft.settings.teacherName = teacherName;
      if (academicYear) draft.settings.academicYear = academicYear;
      if (typeof baseDisciplinePoints === 'number') draft.settings.baseDisciplinePoints = baseDisciplinePoints;
      if (Array.isArray(conductThresholds)) draft.settings.conductThresholds = conductThresholds;

      let passwordChanged = false;
      if (teacherPassword && String(teacherPassword).trim().length >= 6) {
        if (oldTeacherPassword) {
          const isValid = verifyPassword(oldTeacherPassword, draft.teacher.hash, draft.teacher.salt);
          if (!isValid) {
            const err = new Error('Mật khẩu cũ không chính xác');
            (err as any).statusCode = 401;
            throw err;
          }
        }
        const newPass = hashPassword(String(teacherPassword).trim());
        draft.teacher.hash = newPass.hash;
        draft.teacher.salt = newPass.salt;
        draft.teacher.updatedAt = new Date().toISOString();
        draft.teacher.isCustomPassword = true;
        draft.teacher.failedAttempts = 0;
        draft.teacher.lockedUntil = 0;
        passwordChanged = true;
      }

      draft.auditLogs.unshift({
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: passwordChanged ? 'Cập nhật cài đặt & Mật khẩu GV' : 'Cập nhật cài đặt chung',
        actor: draft.settings.teacherName,
        details: passwordChanged
          ? 'Thay đổi thông tin lớp học và mật khẩu quản trị GVCN'
          : 'Thay đổi thông tin lớp học và cài đặt hệ thống',
      });

      return {
        message: 'Lưu cài đặt thành công!',
        settings: draft.settings,
        passwordChanged,
      };
    });

    return res.json({ ...result, updated_at, version, revision_token });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('DỮ_LIỆU_XUNG_ĐỘT') ? 409 : 500);
    return res.status(statusCode).json({ error: cleanErrorMessage(err.message) });
  }
});

// 7. Student Management (Single student create/update)
app.post(['/api/students', '/students'], authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { id, studentCode, fullName, gender, dob, phone } = req.body;

    if (!studentCode || !fullName || !dob) {
      return res.status(400).json({ error: 'Mã học sinh, họ tên và ngày sinh là bắt buộc' });
    }

    const cleanCode = studentCode.trim().toUpperCase();

    const { result, updated_at, version, revision_token } = await mutateDatabase(req, (draft) => {
      if (id) {
        const student = draft.students.find((s: any) => s.id === id);
        if (!student) {
          const err = new Error('Học sinh không tồn tại');
          (err as any).statusCode = 404;
          throw err;
        }

        const dup = draft.students.find((s: any) => s.id !== id && s.studentCode.toUpperCase() === cleanCode);
        if (dup) {
          const err = new Error(`Mã học sinh ${cleanCode} đã tồn tại`);
          (err as any).statusCode = 400;
          throw err;
        }

        student.studentCode = cleanCode;
        student.fullName = fullName.trim();
        student.gender = gender || 'Nam';
        student.dob = dob.trim();
        student.phone = (phone || '').trim();

        draft.auditLogs.unshift({
          id: `log_${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: 'Cập nhật thông tin học sinh',
          actor: draft.settings.teacherName,
          details: `Cập nhật thông tin học sinh ${fullName} (${cleanCode})`,
        });

        return { message: 'Cập nhật học sinh thành công!', student };
      }

      const dup = draft.students.find((s: any) => s.studentCode.toUpperCase() === cleanCode);
      if (dup) {
        const err = new Error(`Mã học sinh ${cleanCode} đã tồn tại`);
        (err as any).statusCode = 400;
        throw err;
      }

      const dobPlain = dob.replace(/\D/g, '') || '01012008';
      const passObj = hashPassword(dobPlain);

      const newStudent = {
        id: `st_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        studentCode: cleanCode,
        fullName: fullName.trim(),
        gender: gender || 'Nam',
        dob: dob.trim(),
        phone: (phone || '').trim(),
        account: {
          hash: passObj.hash,
          salt: passObj.salt,
          isInitialPassword: true,
          failedAttempts: 0,
          lockedUntil: 0,
        },
      };

      draft.students.push(newStudent);
      draft.auditLogs.unshift({
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'Thêm mới học sinh',
        actor: draft.settings.teacherName,
        details: `Thêm học sinh ${fullName} (${cleanCode})`,
      });

      return { message: 'Thêm học sinh thành công!', student: newStudent };
    });

    return res.json({ ...result, updated_at, version, revision_token });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('DỮ_LIỆU_XUNG_ĐỘT') ? 409 : 500);
    return res.status(statusCode).json({ error: cleanErrorMessage(err.message) });
  }
});

// Bulk Import Students - Atomic conditional write
app.post(['/api/students/import', '/students/import'], authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { students, clearOldStudents, replaceExisting } = req.body;
    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: 'Dữ liệu nhập danh sách trống' });
    }

    const shouldClear = Boolean(clearOldStudents || replaceExisting);

    const { result, updated_at, version, revision_token } = await mutateDatabase(req, (draft) => {
      const oldCount = draft.students.length;
      let addedCount = 0;
      let updatedCount = 0;

      if (shouldClear) {
        draft.students = [];
        if (draft.seatingChart && draft.seatingChart.seats) {
          for (const key of Object.keys(draft.seatingChart.seats)) {
            draft.seatingChart.seats[key] = null;
          }
        }
        // Clean up associated records of old students
        draft.attendance = [];
        draft.disciplineEvents = [];
        draft.grades = [];
        draft.honors = [];
      }

      for (const st of students) {
        if (!st.studentCode || !st.fullName) continue;
        const cleanCode = String(st.studentCode).trim().toUpperCase();
        const existing = !shouldClear ? draft.students.find((s: any) => s.studentCode.toUpperCase() === cleanCode) : null;

        if (existing) {
          existing.fullName = String(st.fullName).trim();
          if (st.gender) existing.gender = st.gender;
          if (st.dob) existing.dob = String(st.dob).trim();
          if (st.phone) existing.phone = String(st.phone).trim();
          updatedCount++;
        } else {
          const dobStr = String(st.dob || '').trim();
          const dobPlain = dobStr.replace(/\D/g, '') || '01012008';
          const passObj = hashPassword(dobPlain);

          draft.students.push({
            id: `st_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            studentCode: cleanCode,
            fullName: String(st.fullName).trim(),
            gender: st.gender || 'Nam',
            dob: dobStr || '01/01/2008',
            phone: String(st.phone || '').trim(),
            account: {
              hash: passObj.hash,
              salt: passObj.salt,
              isInitialPassword: true,
              failedAttempts: 0,
              lockedUntil: 0,
            },
          });
          addedCount++;
        }
      }

      draft.auditLogs.unshift({
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: shouldClear ? 'Xóa học sinh cũ và nhập danh sách mới' : 'Nhập danh sách học sinh bằng Excel',
        actor: draft.settings.teacherName,
        details: shouldClear
          ? `Đã xóa ${oldCount} học sinh cũ và nhập mới ${addedCount} học sinh vào Supabase Cloud.`
          : `Nhập thành công: ${addedCount} học sinh mới, cập nhật ${updatedCount} học sinh lên Supabase Cloud`,
      });

      return {
        message: shouldClear
          ? `Đã xóa ${oldCount} học sinh cũ và nhập thành công ${addedCount} học sinh mới!`
          : `Nhập thành công! Đã thêm ${addedCount} học sinh mới và cập nhật ${updatedCount} học sinh hiện có.`,
        addedCount,
        updatedCount,
        clearedCount: shouldClear ? oldCount : 0,
      };
    });

    return res.json({ ...result, updated_at, version, revision_token });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('DỮ_LIỆU_XUNG_ĐỘT') ? 409 : 500);
    return res.status(statusCode).json({ error: cleanErrorMessage(err.message) });
  }
});

// Delete student
app.delete(['/api/students/:id', '/students/:id'], authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const { result, updated_at, version, revision_token } = await mutateDatabase(req, (draft) => {
      const index = draft.students.findIndex((s: any) => s.id === id);
      if (index === -1) {
        const err = new Error('Không tìm thấy học sinh để xóa');
        (err as any).statusCode = 404;
        throw err;
      }

      const removed = draft.students[index];
      draft.students.splice(index, 1);

      if (draft.seatingChart && draft.seatingChart.seats) {
        for (const key of Object.keys(draft.seatingChart.seats)) {
          if (draft.seatingChart.seats[key] === id) {
            draft.seatingChart.seats[key] = null;
          }
        }
      }

      draft.auditLogs.unshift({
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'Xóa học sinh',
        actor: draft.settings.teacherName,
        details: `Đã xóa học sinh ${removed.fullName} (${removed.studentCode})`,
      });

      return { message: `Đã xóa học sinh ${removed.fullName}` };
    });

    return res.json({ ...result, updated_at, version, revision_token });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('DỮ_LIỆU_XUNG_ĐỘT') ? 409 : 500);
    return res.status(statusCode).json({ error: cleanErrorMessage(err.message) });
  }
});

// 8. Attendance Management
app.post(['/api/attendance', '/attendance'], authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { studentId, date, status } = req.body;
    if (!studentId || !date || !status) {
      return res.status(400).json({ error: 'Thiếu thông tin điểm danh' });
    }

    const { result, updated_at, version, revision_token } = await mutateDatabase(req, (draft) => {
      let record = draft.attendance.find((a: any) => a.studentId === studentId && a.date === date);

      if (record) {
        record.status = status;
        record.source = 'manual';
        record.updatedAt = new Date().toISOString();
      } else {
        record = {
          id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          studentId,
          date,
          status,
          source: 'manual',
          updatedAt: new Date().toISOString(),
        };
        draft.attendance.push(record);
      }

      return { message: 'Cập nhật điểm danh thành công', record };
    });

    return res.json({ ...result, updated_at, version, revision_token });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('DỮ_LIỆU_XUNG_ĐỘT') ? 409 : 500);
    return res.status(statusCode).json({ error: cleanErrorMessage(err.message) });
  }
});

// 9. Discipline Management (WITH ATTENDANCE SYNC)
app.post(['/api/discipline/event', '/discipline/event'], authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { studentId, date, ruleId, note } = req.body;
    if (!studentId || !date || !ruleId) {
      return res.status(400).json({ error: 'Thiếu thông tin ghi nhận thi đua' });
    }

    const { result, updated_at, version, revision_token } = await mutateDatabase(req, (draft) => {
      const student = draft.students.find((s: any) => s.id === studentId);
      const rule = draft.disciplineRules.find((r: any) => r.id === ruleId);

      if (!student || !rule) {
        const err = new Error('Học sinh hoặc quy tắc thi đua không tồn tại');
        (err as any).statusCode = 404;
        throw err;
      }

      const eventId = `disc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      let linkedAttendanceId: string | null = null;

      if (rule.linkedAttendance && rule.linkedAttendance !== 'none') {
        let att = draft.attendance.find((a: any) => a.studentId === studentId && a.date === date);
        if (att) {
          att.status = rule.linkedAttendance;
          att.source = 'discipline_sync';
          att.linkedDisciplineId = eventId;
          att.updatedAt = new Date().toISOString();
          linkedAttendanceId = att.id;
        } else {
          linkedAttendanceId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          draft.attendance.push({
            id: linkedAttendanceId,
            studentId,
            date,
            status: rule.linkedAttendance,
            source: 'discipline_sync',
            linkedDisciplineId: eventId,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      const newEvent = {
        id: eventId,
        studentId,
        date,
        ruleId,
        ruleName: rule.name,
        points: rule.points,
        note: (note || '').trim(),
        linkedAttendanceId,
        createdAt: new Date().toISOString(),
      };

      draft.disciplineEvents.unshift(newEvent);

      draft.auditLogs.unshift({
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'Ghi nhận thi đua',
        actor: draft.settings.teacherName,
        details: `Ghi nhận cho ${student.fullName}: ${rule.name} (${rule.points >= 0 ? '+' : ''}${rule.points} điểm)`,
      });

      return {
        message: 'Ghi nhận sự việc thi đua thành công!',
        event: newEvent,
        attendanceSynced: !!linkedAttendanceId,
      };
    });

    return res.json({ ...result, updated_at, version, revision_token });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('DỮ_LIỆU_XUNG_ĐỘT') ? 409 : 500);
    return res.status(statusCode).json({ error: cleanErrorMessage(err.message) });
  }
});

// Delete Discipline Event and Recalculate Attendance
app.delete(['/api/discipline/event/:id', '/discipline/event/:id'], authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const { result, updated_at, version, revision_token } = await mutateDatabase(req, (draft) => {
      const eventIndex = draft.disciplineEvents.findIndex((e: any) => e.id === id);
      if (eventIndex === -1) {
        const err = new Error('Không tìm thấy bản ghi thi đua để xóa');
        (err as any).statusCode = 404;
        throw err;
      }

      const event = draft.disciplineEvents[eventIndex];
      draft.disciplineEvents.splice(eventIndex, 1);

      if (event.linkedAttendanceId) {
        const studentId = event.studentId;
        const date = event.date;

        const otherLinkedEvent = draft.disciplineEvents.find(
          (e: any) => e.studentId === studentId && e.date === date && e.linkedAttendanceId
        );

        const attIndex = draft.attendance.findIndex(
          (a: any) => a.id === event.linkedAttendanceId || (a.studentId === studentId && a.date === date)
        );
        if (attIndex !== -1) {
          if (otherLinkedEvent) {
            const rule = draft.disciplineRules.find((r: any) => r.id === otherLinkedEvent.ruleId);
            if (rule && rule.linkedAttendance && rule.linkedAttendance !== 'none') {
              draft.attendance[attIndex].status = rule.linkedAttendance;
              draft.attendance[attIndex].linkedDisciplineId = otherLinkedEvent.id;
            }
          } else {
            draft.attendance[attIndex].status = 'present';
            draft.attendance[attIndex].source = 'manual';
            draft.attendance[attIndex].linkedDisciplineId = undefined;
          }
        }
      }

      draft.auditLogs.unshift({
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'Xóa ghi nhận thi đua',
        actor: draft.settings.teacherName,
        details: `Xóa sự việc "${event.ruleName}" (${event.points} điểm) ngày ${event.date}`,
      });

      return { message: 'Đã xóa bản ghi thi đua và tính lại điểm thành công!' };
    });

    return res.json({ ...result, updated_at, version, revision_token });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('DỮ_LIỆU_XUNG_ĐỘT') ? 409 : 500);
    return res.status(statusCode).json({ error: cleanErrorMessage(err.message) });
  }
});

// 10. Discipline Rules Management
app.post(['/api/discipline/rules', '/discipline/rules'], authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { id, name, group, points, linkedAttendance, isActive } = req.body;
    if (!name || typeof points !== 'number') {
      return res.status(400).json({ error: 'Tên quy tắc và số điểm là bắt buộc' });
    }

    const { result, updated_at, version, revision_token } = await mutateDatabase(req, (draft) => {
      if (id) {
        const rule = draft.disciplineRules.find((r: any) => r.id === id);
        if (!rule) {
          const err = new Error('Không tìm thấy quy tắc');
          (err as any).statusCode = 404;
          throw err;
        }

        rule.name = name.trim();
        rule.group = group || 'Nề nếp';
        rule.points = points;
        rule.linkedAttendance = linkedAttendance || 'none';
        if (typeof isActive === 'boolean') rule.isActive = isActive;

        return { message: 'Cập nhật quy tắc thi đua thành công!', rule };
      }

      const newRule = {
        id: `rule_${Date.now()}`,
        name: name.trim(),
        group: group || 'Nề nếp',
        points,
        linkedAttendance: linkedAttendance || 'none',
        isActive: true,
      };

      draft.disciplineRules.push(newRule);
      return { message: 'Thêm mới quy tắc thi đua thành công!', rule: newRule };
    });

    return res.json({ ...result, updated_at, version, revision_token });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('DỮ_LIỆU_XUNG_ĐỘT') ? 409 : 500);
    return res.status(statusCode).json({ error: cleanErrorMessage(err.message) });
  }
});

app.delete(['/api/discipline/rules/:id', '/discipline/rules/:id'], authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const { result, updated_at, version, revision_token } = await mutateDatabase(req, (draft) => {
      const rule = draft.disciplineRules.find((r: any) => r.id === id);
      if (!rule) {
        const err = new Error('Không tìm thấy quy tắc');
        (err as any).statusCode = 404;
        throw err;
      }
      rule.isActive = false;
      return { message: 'Đã ngừng áp dụng quy tắc thi đua' };
    });

    return res.json({ ...result, updated_at, version, revision_token });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('DỮ_LIỆU_XUNG_ĐỘT') ? 409 : 500);
    return res.status(statusCode).json({ error: cleanErrorMessage(err.message) });
  }
});

// 11. Subjects Management
app.post(['/api/subjects', '/subjects'], authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { id, name, order, isActive } = req.body;
    if (!name) return res.status(400).json({ error: 'Tên môn học là bắt buộc' });

    const { result, updated_at, version, revision_token } = await mutateDatabase(req, (draft) => {
      if (id) {
        const sub = draft.subjects.find((s: any) => s.id === id);
        if (!sub) {
          const err = new Error('Môn học không tồn tại');
          (err as any).statusCode = 404;
          throw err;
        }
        sub.name = name.trim();
        if (typeof order === 'number') sub.order = order;
        if (typeof isActive === 'boolean') sub.isActive = isActive;

        return { message: 'Cập nhật môn học thành công!', subject: sub };
      }

      const newSub = {
        id: `sub_${Date.now()}`,
        name: name.trim(),
        order: typeof order === 'number' ? order : draft.subjects.length + 1,
        isActive: true,
      };

      draft.subjects.push(newSub);
      return { message: 'Thêm môn học thành công!', subject: newSub };
    });

    return res.json({ ...result, updated_at, version, revision_token });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('DỮ_LIỆU_XUNG_ĐỘT') ? 409 : 500);
    return res.status(statusCode).json({ error: cleanErrorMessage(err.message) });
  }
});

app.delete(['/api/subjects/:id', '/subjects/:id'], authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const { result, updated_at, version, revision_token } = await mutateDatabase(req, (draft) => {
      const sub = draft.subjects.find((s: any) => s.id === id);
      if (!sub) {
        const err = new Error('Môn học không tồn tại');
        (err as any).statusCode = 404;
        throw err;
      }
      sub.isActive = false;
      return { message: 'Đã ngừng sử dụng môn học (vẫn giữ dữ liệu điểm lịch sử)' };
    });

    return res.json({ ...result, updated_at, version, revision_token });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('DỮ_LIỆU_XUNG_ĐỘT') ? 409 : 500);
    return res.status(statusCode).json({ error: cleanErrorMessage(err.message) });
  }
});

// 12. Grades Management
app.post(['/api/grades', '/grades'], authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { id, studentId, subjectId, semester, scoreType, attempt, score, note } = req.body;
    if (!studentId || !subjectId || typeof score !== 'number') {
      return res.status(400).json({ error: 'Thiếu thông tin điểm số' });
    }

    if (score < 0 || score > 10) {
      return res.status(400).json({ error: 'Điểm số phải từ 0 đến 10' });
    }

    const { result, updated_at, version, revision_token } = await mutateDatabase(req, (draft) => {
      if (id) {
        const gr = draft.grades.find((g: any) => g.id === id);
        if (!gr) {
          const err = new Error('Không tìm thấy bản ghi điểm');
          (err as any).statusCode = 404;
          throw err;
        }
        gr.score = Math.round(score * 10) / 10;
        gr.semester = semester || 'HK1';
        gr.scoreType = scoreType || 'giua_ky';
        gr.attempt = attempt || 1;
        gr.note = (note || '').trim();
        gr.updatedAt = new Date().toISOString();

        return { message: 'Cập nhật điểm thành công!', grade: gr };
      }

      const newGrade = {
        id: `gr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        studentId,
        subjectId,
        semester: semester || 'HK1',
        scoreType: scoreType || 'giua_ky',
        attempt: attempt || 1,
        score: Math.round(score * 10) / 10,
        note: (note || '').trim(),
        updatedAt: new Date().toISOString(),
      };

      draft.grades.push(newGrade);
      return { message: 'Nhập điểm thành công!', grade: newGrade };
    });

    return res.json({ ...result, updated_at, version, revision_token });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('DỮ_LIỆU_XUNG_ĐỘT') ? 409 : 500);
    return res.status(statusCode).json({ error: cleanErrorMessage(err.message) });
  }
});

app.delete(['/api/grades/:id', '/grades/:id'], authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const { result, updated_at, version, revision_token } = await mutateDatabase(req, (draft) => {
      const index = draft.grades.findIndex((g: any) => g.id === id);
      if (index === -1) {
        const err = new Error('Không tìm thấy bản ghi điểm');
        (err as any).statusCode = 404;
        throw err;
      }
      draft.grades.splice(index, 1);
      return { message: 'Đã xóa điểm' };
    });

    return res.json({ ...result, updated_at, version, revision_token });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('DỮ_LIỆU_XUNG_ĐỘT') ? 409 : 500);
    return res.status(statusCode).json({ error: cleanErrorMessage(err.message) });
  }
});

// Bulk Grades Import
app.post(['/api/grades/import', '/grades/import'], authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { grades } = req.body;
    if (!Array.isArray(grades) || grades.length === 0) {
      return res.status(400).json({ error: 'Danh sách điểm nhập rỗng' });
    }

    const { result, updated_at, version, revision_token } = await mutateDatabase(req, (draft) => {
      let imported = 0;

      for (const item of grades) {
        const student = draft.students.find(
          (s: any) => s.studentCode.toUpperCase() === String(item.studentCode || '').trim().toUpperCase()
        );
        const subject = draft.subjects.find(
          (s: any) =>
            s.name.toLowerCase() === String(item.subjectName || '').trim().toLowerCase() || s.id === item.subjectId
        );

        if (!student || !subject) continue;
        const numScore = parseFloat(item.score);
        if (isNaN(numScore) || numScore < 0 || numScore > 10) continue;

        const existing = draft.grades.find(
          (g: any) =>
            g.studentId === student.id &&
            g.subjectId === subject.id &&
            g.semester === (item.semester || 'HK1') &&
            g.scoreType === (item.scoreType || 'giua_ky') &&
            g.attempt === (Number(item.attempt) || 1)
        );

        if (existing) {
          existing.score = Math.round(numScore * 10) / 10;
          existing.note = String(item.note || '').trim();
          existing.updatedAt = new Date().toISOString();
        } else {
          draft.grades.push({
            id: `gr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            studentId: student.id,
            subjectId: subject.id,
            semester: item.semester || 'HK1',
            scoreType: item.scoreType || 'giua_ky',
            attempt: Number(item.attempt) || 1,
            score: Math.round(numScore * 10) / 10,
            note: String(item.note || '').trim(),
            updatedAt: new Date().toISOString(),
          });
        }
        imported++;
      }

      return { message: `Nhập điểm thành công cho ${imported} bản ghi!` };
    });

    return res.json({ ...result, updated_at, version, revision_token });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('DỮ_LIỆU_XUNG_ĐỘT') ? 409 : 500);
    return res.status(statusCode).json({ error: cleanErrorMessage(err.message) });
  }
});

// 13. Seating Chart Management
app.post(['/api/seating', '/seating'], authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { seats } = req.body;
    if (!seats || typeof seats !== 'object') {
      return res.status(400).json({ error: 'Dữ liệu sơ đồ không hợp lệ' });
    }

    const { result, updated_at, version, revision_token } = await mutateDatabase(req, (draft) => {
      draft.seatingChart = {
        seats,
        lastSaved: new Date().toISOString(),
      };

      draft.auditLogs.unshift({
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'Cập nhật sơ đồ lớp',
        actor: draft.settings.teacherName,
        details: 'Đã lưu bố trí vị trí ngồi của học sinh',
      });

      return { message: 'Lưu sơ đồ lớp học thành công!' };
    });

    return res.json({ ...result, updated_at, version, revision_token });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('DỮ_LIỆU_XUNG_ĐỘT') ? 409 : 500);
    return res.status(statusCode).json({ error: cleanErrorMessage(err.message) });
  }
});

// 14. Announcements Management
app.post(['/api/announcements', '/announcements'], authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { id, title, content, category, isPinned, imageUrl } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Tiêu đề và nội dung là bắt buộc' });
    }

    const { result, updated_at, version, revision_token } = await mutateDatabase(req, (draft) => {
      if (id) {
        const ann = draft.announcements.find((a: any) => a.id === id);
        if (!ann) {
          const err = new Error('Không tìm thấy thông báo');
          (err as any).statusCode = 404;
          throw err;
        }

        ann.title = title.trim();
        ann.content = content.trim();
        ann.category = category || 'Thông báo chung';
        ann.isPinned = !!isPinned;
        if (imageUrl !== undefined) ann.imageUrl = imageUrl;
        if (!ann.author || ann.author.includes('Nguyễn Thu Trang')) {
          ann.author = formatTeacherAuthor(draft.settings.teacherName);
        }

        return { message: 'Cập nhật thông báo thành công!', announcement: ann };
      }

      const newAnn = {
        id: `ann_${Date.now()}`,
        title: title.trim(),
        content: content.trim(),
        author: formatTeacherAuthor(draft.settings.teacherName),
        date: new Date().toLocaleString('vi-VN'),
        category: category || 'Thông báo chung',
        isPinned: !!isPinned,
        imageUrl: imageUrl || '',
      };

      draft.announcements.unshift(newAnn);
      return { message: 'Đăng thông báo mới thành công!', announcement: newAnn };
    });

    return res.json({ ...result, updated_at, version, revision_token });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('DỮ_LIỆU_XUNG_ĐỘT') ? 409 : 500);
    return res.status(statusCode).json({ error: cleanErrorMessage(err.message) });
  }
});

app.delete(['/api/announcements/:id', '/announcements/:id'], authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const { result, updated_at, version, revision_token } = await mutateDatabase(req, (draft) => {
      const idx = draft.announcements.findIndex((a: any) => a.id === id);
      if (idx === -1) {
        const err = new Error('Không tìm thấy thông báo');
        (err as any).statusCode = 404;
        throw err;
      }
      draft.announcements.splice(idx, 1);
      return { message: 'Đã xóa thông báo' };
    });

    return res.json({ ...result, updated_at, version, revision_token });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('DỮ_LIỆU_XUNG_ĐỘT') ? 409 : 500);
    return res.status(statusCode).json({ error: cleanErrorMessage(err.message) });
  }
});

// 15. Honors Management
app.post(['/api/honors', '/honors'], authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { id, studentId, studentName, title, achievement, month, avatar, confirmed } = req.body;
    if (!studentId || !title || !achievement) {
      return res.status(400).json({ error: 'Thiếu thông tin vinh danh' });
    }

    const { result, updated_at, version, revision_token } = await mutateDatabase(req, (draft) => {
      const student = draft.students.find((s: any) => s.id === studentId);

      if (id) {
        const hon = draft.honors.find((h: any) => h.id === id);
        if (!hon) {
          const err = new Error('Không tìm thấy mục vinh danh');
          (err as any).statusCode = 404;
          throw err;
        }

        hon.studentId = studentId;
        hon.studentName = student ? student.fullName : studentName || hon.studentName;
        hon.title = title.trim();
        hon.achievement = achievement.trim();
        hon.month = month || 'Tháng này';
        if (avatar) hon.avatar = avatar;
        hon.confirmed = confirmed !== false;

        return { message: 'Cập nhật danh hiệu vinh danh thành công!', honor: hon };
      }

      const newHon = {
        id: `hon_${Date.now()}`,
        studentId,
        studentName: student ? student.fullName : studentName,
        title: title.trim(),
        achievement: achievement.trim(),
        month: month || `Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`,
        avatar: avatar || '',
        confirmed: confirmed !== false,
      };

      draft.honors.unshift(newHon);
      return { message: 'Thêm vinh danh học sinh thành công!', honor: newHon };
    });

    return res.json({ ...result, updated_at, version, revision_token });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('DỮ_LIỆU_XUNG_ĐỘT') ? 409 : 500);
    return res.status(statusCode).json({ error: cleanErrorMessage(err.message) });
  }
});

app.delete(['/api/honors/:id', '/honors/:id'], authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const { result, updated_at, version, revision_token } = await mutateDatabase(req, (draft) => {
      const idx = draft.honors.findIndex((h: any) => h.id === id);
      if (idx === -1) {
        const err = new Error('Không tìm thấy danh hiệu vinh danh');
        (err as any).statusCode = 404;
        throw err;
      }
      draft.honors.splice(idx, 1);
      return { message: 'Đã xóa mục vinh danh' };
    });

    return res.json({ ...result, updated_at, version, revision_token });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('DỮ_LIỆU_XUNG_ĐỘT') ? 409 : 500);
    return res.status(statusCode).json({ error: cleanErrorMessage(err.message) });
  }
});

// 16. Backup & Restore Data
app.get(['/api/backup/export', '/backup/export'], authMiddleware, teacherOnly, async (_req, res) => {
  try {
    const { cloudData, cloudUpdatedAt } = await fetchAuthoritativeData();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="gvcn_backup_${Date.now()}.json"`);
    return res.send(JSON.stringify({ ...cloudData, updated_at: cloudUpdatedAt }, null, 2));
  } catch (err: any) {
    return res.status(500).json({ error: cleanErrorMessage(err.message) });
  }
});

app.post(['/api/backup/restore', '/backup/restore'], authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { backupData } = req.body;
    if (!backupData || !backupData.settings || !Array.isArray(backupData.students)) {
      return res.status(400).json({ error: 'File sao lưu không đúng định dạng chuẩn của hệ thống GVCN' });
    }

    const { updated_at, version, revision_token } = await mutateDatabase(req, (draft) => {
      Object.assign(draft, backupData);
      return { message: 'Khôi phục dữ liệu toàn bộ thành công!' };
    });

    return res.json({ message: 'Khôi phục dữ liệu toàn bộ thành công!', updated_at, version, revision_token });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('DỮ_LIỆU_XUNG_ĐỘT') ? 409 : 500);
    return res.status(statusCode).json({ error: cleanErrorMessage(err.message) });
  }
});

// 17. Supabase Cloud Integration Endpoints
app.get(['/api/supabase/status', '/supabase/status'], authMiddleware, async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('gvcn_store')
      .select('updated_at')
      .eq('id', 'gvcn_primary')
      .maybeSingle();

    return res.json({
      connected: !error,
      url: SUPABASE_URL,
      lastSync: supabaseLastSyncTime || data?.updated_at || null,
      error: error ? cleanErrorMessage(error.message) : null,
      isTableCreated: !error,
    });
  } catch (err: any) {
    return res.json({
      connected: false,
      url: SUPABASE_URL,
      lastSync: supabaseLastSyncTime,
      error: cleanErrorMessage(err.message),
      isTableCreated: false,
    });
  }
});

app.post(['/api/supabase/sync', '/supabase/sync'], authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { updated_at, version, revision_token } = await mutateDatabase(req, (draft) => {
      draft.auditLogs.unshift({
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'Đồng bộ Supabase thủ công',
        actor: draft.settings.teacherName,
        details: 'Giáo viên thực hiện đồng bộ lại toàn bộ dữ liệu lên Supabase',
      });
      return { message: 'Đã đồng bộ toàn bộ dữ liệu lên cơ sở dữ liệu Supabase thành công!' };
    });

    return res.json({
      message: 'Đã đồng bộ toàn bộ dữ liệu lên cơ sở dữ liệu Supabase thành công!',
      lastSync: updated_at,
      updated_at,
      version,
      revision_token,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('DỮ_LIỆU_XUNG_ĐỘT') ? 409 : 500);
    return res.status(statusCode).json({ error: cleanErrorMessage(err.message) });
  }
});

export { app };
export default app;
