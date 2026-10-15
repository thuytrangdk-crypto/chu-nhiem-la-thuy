import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'gvcn_database.json');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://sohuavueougdlsqerwuk.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_2BcotajR597WKnTP9G0wrg_N8oBj1PM';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let supabaseLastSyncTime: string | null = null;
let supabaseSyncError: string | null = null;

async function syncToSupabase(data: any) {
  try {
    const { error } = await supabase
      .from('gvcn_store')
      .upsert({
        id: 'gvcn_primary',
        data,
        updated_at: new Date().toISOString(),
      });
    if (error) {
      supabaseSyncError = error.message;
      console.warn('[Supabase Sync Notice]:', error.message);
    } else {
      supabaseLastSyncTime = new Date().toISOString();
      supabaseSyncError = null;
    }
  } catch (err: any) {
    supabaseSyncError = err.message || 'Lỗi kết nối Supabase';
  }
}

async function initFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('gvcn_store')
      .select('data, updated_at')
      .eq('id', 'gvcn_primary')
      .maybeSingle();
    if (data && data.data && !error) {
      console.log('[Supabase] Đã đồng bộ dữ liệu mới nhất từ Supabase Cloud:', data.updated_at);
      saveDatabase(data.data);
      supabaseLastSyncTime = data.updated_at;
      supabaseSyncError = null;
    } else if (error) {
      supabaseSyncError = error.message;
      console.log('[Supabase Notice]:', error.message);
    }
  } catch (err: any) {
    supabaseSyncError = err.message;
  }
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Helper for password hashing using salt + SHA-256
function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, actualSalt, 1000, 64, 'sha256').toString('hex');
  return { hash, salt: actualSalt };
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  const check = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha256').toString('hex');
  return check === hash;
}

// Ensure Data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial Database schema seed
function getInitialData() {
  const teacherPass = hashPassword('giaovien123');

  const defaultRules = [
    { id: 'rule_1', name: 'Đi học muộn', group: 'Chuyên cần', points: -2, linkedAttendance: 'late', isActive: true },
    { id: 'rule_2', name: 'Vắng không phép', group: 'Chuyên cần', points: -5, linkedAttendance: 'unexcused_absence', isActive: true },
    { id: 'rule_3', name: 'Vắng có phép', group: 'Chuyên cần', points: 0, linkedAttendance: 'excused_absence', isActive: true },
    { id: 'rule_4', name: 'Không làm bài tập về nhà', group: 'Học tập', points: -3, linkedAttendance: 'none', isActive: true },
    { id: 'rule_5', name: 'Nói chuyện riêng trong giờ', group: 'Nề nếp', points: -2, linkedAttendance: 'none', isActive: true },
    { id: 'rule_6', name: 'Vi phạm đồng phục / tác phong', group: 'Nề nếp', points: -2, linkedAttendance: 'none', isActive: true },
    { id: 'rule_7', name: 'Phát biểu xây dựng bài sôi nổi', group: 'Học tập', points: 2, linkedAttendance: 'none', isActive: true },
    { id: 'rule_8', name: 'Đạt điểm 9, 10 bài kiểm tra', group: 'Học tập', points: 3, linkedAttendance: 'none', isActive: true },
    { id: 'rule_9', name: 'Giúp đỡ bạn bè tiến bộ', group: 'Phong trào', points: 3, linkedAttendance: 'none', isActive: true },
    { id: 'rule_10', name: 'Tham gia tích cực phong trào trường/lớp', group: 'Phong trào', points: 5, linkedAttendance: 'none', isActive: true },
    { id: 'rule_11', name: 'Trực nhật lớp sạch sẽ, đúng giờ', group: 'Nề nếp', points: 2, linkedAttendance: 'none', isActive: true },
    { id: 'rule_12', name: 'Được tuyên dương cấp trường', group: 'Phong trào', points: 10, linkedAttendance: 'none', isActive: true }
  ];

  const defaultSubjects = [
    { id: 'sub_1', name: 'Toán học', order: 1, isActive: true },
    { id: 'sub_2', name: 'Ngữ văn', order: 2, isActive: true },
    { id: 'sub_3', name: 'Tiếng Anh', order: 3, isActive: true },
    { id: 'sub_4', name: 'Vật lí', order: 4, isActive: true },
    { id: 'sub_5', name: 'Hóa học', order: 5, isActive: true },
    { id: 'sub_6', name: 'Sinh học', order: 6, isActive: true },
    { id: 'sub_7', name: 'Lịch sử', order: 7, isActive: true },
    { id: 'sub_8', name: 'Địa lí', order: 8, isActive: true },
    { id: 'sub_9', name: 'GDCD', order: 9, isActive: true },
    { id: 'sub_10', name: 'Tin học', order: 10, isActive: true }
  ];

  const rawStudents = [
    { studentCode: 'HS001', fullName: 'Nguyễn Văn An', gender: 'Nam', dob: '15/02/2008', phone: '0912345601' },
    { studentCode: 'HS002', fullName: 'Trần Thị Bích', gender: 'Nữ', dob: '20/05/2008', phone: '0912345602' },
    { studentCode: 'HS003', fullName: 'Lê Hoàng Cường', gender: 'Nam', dob: '10/08/2008', phone: '0912345603' },
    { studentCode: 'HS004', fullName: 'Phạm Minh Dũng', gender: 'Nam', dob: '03/11/2008', phone: '0912345604' },
    { studentCode: 'HS005', fullName: 'Hoàng Thùy Dương', gender: 'Nữ', dob: '25/01/2008', phone: '0912345605' },
    { studentCode: 'HS006', fullName: 'Đặng Tuấn Hải', gender: 'Nam', dob: '18/07/2008', phone: '0912345606' },
    { studentCode: 'HS007', fullName: 'Vũ Thị Ngọc Hoa', gender: 'Nữ', dob: '12/03/2008', phone: '0912345607' },
    { studentCode: 'HS008', fullName: 'Bùi Đức Long', gender: 'Nam', dob: '09/09/2008', phone: '0912345608' },
    { studentCode: 'HS009', fullName: 'Ngô Khánh Linh', gender: 'Nữ', dob: '14/06/2008', phone: '0912345609' },
    { studentCode: 'HS010', fullName: 'Đỗ Quang Minh', gender: 'Nam', dob: '28/04/2008', phone: '0912345610' },
    { studentCode: 'HS011', fullName: 'Mai Thanh Nga', gender: 'Nữ', dob: '05/12/2008', phone: '0912345611' },
    { studentCode: 'HS012', fullName: 'Phan Quốc Việt', gender: 'Nam', dob: '17/10/2008', phone: '0912345612' }
  ];

  const students = rawStudents.map((st, index) => {
    // Default password is DOB in DDMMYYYY
    const dobPlain = st.dob.replace(/\D/g, '');
    const passObj = hashPassword(dobPlain);
    return {
      id: `st_${index + 1}`,
      studentCode: st.studentCode,
      fullName: st.fullName,
      gender: st.gender,
      dob: st.dob,
      phone: st.phone,
      account: {
        hash: passObj.hash,
        salt: passObj.salt,
        isInitialPassword: true,
        failedAttempts: 0,
        lockedUntil: 0
      }
    };
  });

  // Initial seating chart: 4 columns x 7 desks x 2 seats = 56 slots
  // Key format: `R${row}-D${desk}-S${seat}` (R: 1..4, D: 1..7, S: 1..2)
  const seating: Record<string, string | null> = {};
  for (let r = 1; r <= 4; r++) {
    for (let d = 1; d <= 7; d++) {
      for (let s = 1; s <= 2; s++) {
        seating[`R${r}-D${d}-S${s}`] = null;
      }
    }
  }
  // Place first 12 students in desks
  seating['R1-D1-S1'] = 'st_1';
  seating['R1-D1-S2'] = 'st_2';
  seating['R1-D2-S1'] = 'st_3';
  seating['R1-D2-S2'] = 'st_4';
  seating['R2-D1-S1'] = 'st_5';
  seating['R2-D1-S2'] = 'st_6';
  seating['R2-D2-S1'] = 'st_7';
  seating['R2-D2-S2'] = 'st_8';
  seating['R3-D1-S1'] = 'st_9';
  seating['R3-D1-S2'] = 'st_10';
  seating['R4-D1-S1'] = 'st_11';
  seating['R4-D1-S2'] = 'st_12';

  const today = new Date().toISOString().split('T')[0];

  const disciplineEvents = [
    {
      id: 'disc_1',
      studentId: 'st_1',
      date: today,
      ruleId: 'rule_7',
      ruleName: 'Phát biểu xây dựng bài sôi nổi',
      points: 2,
      note: 'Xung phong giải bài tập Toán khó',
      linkedAttendanceId: null,
      createdAt: new Date().toISOString()
    },
    {
      id: 'disc_2',
      studentId: 'st_3',
      date: today,
      ruleId: 'rule_1',
      ruleName: 'Đi học muộn',
      points: -2,
      note: 'Đi muộn 15 phút tiết 1 do hỏng xe',
      linkedAttendanceId: 'att_3',
      createdAt: new Date().toISOString()
    },
    {
      id: 'disc_3',
      studentId: 'st_5',
      date: today,
      ruleId: 'rule_10',
      ruleName: 'Tham gia tích cực phong trào trường/lớp',
      points: 5,
      note: 'Tổ chức tiết mục văn nghệ chào mừng 20/11',
      linkedAttendanceId: null,
      createdAt: new Date().toISOString()
    }
  ];

  const attendance = [
    { id: 'att_1', studentId: 'st_1', date: today, status: 'present', source: 'manual', updatedAt: new Date().toISOString() },
    { id: 'att_2', studentId: 'st_2', date: today, status: 'present', source: 'manual', updatedAt: new Date().toISOString() },
    { id: 'att_3', studentId: 'st_3', date: today, status: 'late', source: 'discipline_sync', linkedDisciplineId: 'disc_2', updatedAt: new Date().toISOString() },
    { id: 'att_4', studentId: 'st_4', date: today, status: 'present', source: 'manual', updatedAt: new Date().toISOString() },
    { id: 'att_5', studentId: 'st_5', date: today, status: 'present', source: 'manual', updatedAt: new Date().toISOString() },
    { id: 'att_6', studentId: 'st_6', date: today, status: 'excused_absence', source: 'manual', updatedAt: new Date().toISOString() }
  ];

  const grades = [
    { id: 'gr_1', studentId: 'st_1', subjectId: 'sub_1', semester: 'HK1', scoreType: 'giua_ky', attempt: 1, score: 9.5, note: 'Làm bài xuất sắc', updatedAt: new Date().toISOString() },
    { id: 'gr_2', studentId: 'st_1', subjectId: 'sub_2', semester: 'HK1', scoreType: 'giua_ky', attempt: 1, score: 8.5, note: 'Văn phong mạch lạc', updatedAt: new Date().toISOString() },
    { id: 'gr_3', studentId: 'st_2', subjectId: 'sub_1', semester: 'HK1', scoreType: 'giua_ky', attempt: 1, score: 9.0, note: '', updatedAt: new Date().toISOString() },
    { id: 'gr_4', studentId: 'st_3', subjectId: 'sub_1', semester: 'HK1', scoreType: 'giua_ky', attempt: 1, score: 7.0, note: '', updatedAt: new Date().toISOString() },
    { id: 'gr_5', studentId: 'st_5', subjectId: 'sub_3', semester: 'HK1', scoreType: 'giua_ky', attempt: 1, score: 9.8, note: 'Top 1 khối', updatedAt: new Date().toISOString() }
  ];

  const announcements = [
    {
      id: 'ann_1',
      title: 'Kế hoạch học tập & Sinh hoạt ngoại khóa Tuần 10',
      content: 'Kính gửi toàn thể học sinh lớp 12A1: Tuần này lớp chúng ta có bài kiểm tra giữa kỳ môn Toán và Vật lý. Các em chú ý ôn tập kỹ lưỡng theo đề cương đã phát. Thứ Bảy tuần này lớp tham gia buổi lao động dọn dẹp khuôn viên trường lúc 7h30 sáng.',
      author: 'Cô Nguyễn Thu Trang (GVCN)',
      date: new Date().toLocaleString('vi-VN'),
      category: 'Học tập',
      isPinned: true
    },
    {
      id: 'ann_2',
      title: 'Nhắc nhở nề nếp trang phục và chuyên cần',
      content: 'Đề nghị tất cả học sinh mặc đồng phục đúng quy định, đeo thẻ học sinh và đi học đúng giờ trước 6h45 hàng ngày. Ban cán sự lớp theo dõi sổ theo dõi thi đua và báo cáo GVCN vào cuối mỗi buổi học.',
      author: 'Cô Nguyễn Thu Trang (GVCN)',
      date: new Date(Date.now() - 86400000 * 2).toLocaleString('vi-VN'),
      category: 'Nhắc nhở',
      isPinned: false
    }
  ];

  const honors = [
    {
      id: 'hon_1',
      studentId: 'st_1',
      studentName: 'Nguyễn Văn An',
      title: 'Học sinh xuất sắc',
      achievement: 'Đạt điểm 10 kiểm tra khảo sát Toán và dẫn đầu phong trào thi đua lớp',
      month: 'Tháng 10/2025',
      confirmed: true
    },
    {
      id: 'hon_2',
      studentId: 'st_5',
      studentName: 'Hoàng Thùy Dương',
      title: 'Học sinh tích cực',
      achievement: 'Nhiệt tình phụ trách văn nghệ, gương mẫu hỗ trợ bạn bè trong nhóm học tập',
      month: 'Tháng 10/2025',
      confirmed: true
    }
  ];

  return {
    settings: {
      appName: 'GVCN',
      schoolName: 'Trường THPT Chu Văn An',
      className: '12A1',
      teacherName: 'Cô Nguyễn Thu Trang',
      academicYear: '2025 - 2026',
      baseDisciplinePoints: 100,
      conductThresholds: [
        { label: 'Tốt', minScore: 90 },
        { label: 'Khá', minScore: 75 },
        { label: 'Đạt', minScore: 50 },
        { label: 'Chưa đạt', minScore: 0 }
      ]
    },
    teacher: {
      username: 'admin',
      hash: teacherPass.hash,
      salt: teacherPass.salt,
      failedAttempts: 0,
      lockedUntil: 0
    },
    disciplineRules: defaultRules,
    subjects: defaultSubjects,
    students,
    seatingChart: {
      seats: seating,
      lastSaved: new Date().toISOString()
    },
    attendance,
    disciplineEvents,
    grades,
    announcements,
    honors,
    auditLogs: [
      {
        id: 'log_init',
        timestamp: new Date().toISOString(),
        action: 'Khởi tạo hệ thống',
        actor: 'Hệ thống',
        details: 'Khởi tạo dữ liệu lớp chủ nhiệm ban đầu thành công'
      }
    ]
  };
}

// Database helper functions with atomic write
function loadDatabase() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initial = getInitialData();
      saveDatabase(initial);
      return initial;
    }
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error loading database, resetting to initial seed:', err);
    const initial = getInitialData();
    saveDatabase(initial);
    return initial;
  }
}

function saveDatabase(data: any) {
  try {
    const tempPath = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, DB_FILE);
    // Background sync to Supabase Cloud
    syncToSupabase(data).catch(() => {});
  } catch (err) {
    console.error('Error saving database:', err);
    throw err;
  }
}

// In-memory active tokens session store
interface SessionUser {
  role: 'teacher' | 'student';
  id: string; // 'teacher' or studentId
  studentCode?: string;
  fullName?: string;
  expiresAt: number;
}

const activeSessions = new Map<string, SessionUser>();

function generateToken(user: Omit<SessionUser, 'expiresAt'>): string {
  const token = crypto.randomBytes(32).toString('hex');
  activeSessions.set(token, {
    ...user,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  });
  return token;
}

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Chưa đăng nhập hoặc phiên làm việc đã hết hạn' });
  }

  const token = authHeader.substring(7);
  const session = activeSessions.get(token);

  if (!session || session.expiresAt < Date.now()) {
    if (session) activeSessions.delete(token);
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

// ---------------- API ROUTES ----------------

// 1. Authentication
app.post('/api/auth/login', (req, res) => {
  const { role, username, studentCode, password } = req.body;
  const db = loadDatabase();
  const now = Date.now();

  if (role === 'teacher') {
    if (db.teacher.lockedUntil && db.teacher.lockedUntil > now) {
      const waitMin = Math.ceil((db.teacher.lockedUntil - now) / 60000);
      return res.status(429).json({ error: `Tài khoản tạm khóa do nhập sai mật khẩu nhiều lần. Vui lòng thử lại sau ${waitMin} phút.` });
    }

    const isValid = verifyPassword(password || '', db.teacher.hash, db.teacher.salt);
    if (!isValid) {
      db.teacher.failedAttempts = (db.teacher.failedAttempts || 0) + 1;
      if (db.teacher.failedAttempts >= 5) {
        db.teacher.lockedUntil = now + 5 * 60 * 1000; // 5 min lockout
        db.teacher.failedAttempts = 0;
        saveDatabase(db);
        return res.status(429).json({ error: 'Nhập sai quá 5 lần! Tài khoản bị tạm khóa 5 phút để bảo vệ.' });
      }
      saveDatabase(db);
      return res.status(401).json({ error: 'Mật khẩu giáo viên không đúng' });
    }

    // Reset failed attempts on success
    db.teacher.failedAttempts = 0;
    db.teacher.lockedUntil = 0;
    saveDatabase(db);

    const token = generateToken({ role: 'teacher', id: 'teacher' });
    return res.json({
      token,
      user: {
        role: 'teacher',
        teacherName: db.settings.teacherName,
        className: db.settings.className
      }
    });
  }

  if (role === 'student') {
    const code = (studentCode || '').trim().toUpperCase();
    const student = db.students.find((s: any) => s.studentCode.toUpperCase() === code);

    if (!student) {
      return res.status(404).json({ error: 'Mã học sinh không tồn tại trong danh sách lớp' });
    }

    if (student.account.lockedUntil && student.account.lockedUntil > now) {
      const waitMin = Math.ceil((student.account.lockedUntil - now) / 60000);
      return res.status(429).json({ error: `Tài khoản bị tạm khóa. Vui lòng liên hệ GVCN hoặc thử lại sau ${waitMin} phút.` });
    }

    const isValid = verifyPassword(password || '', student.account.hash, student.account.salt);
    if (!isValid) {
      student.account.failedAttempts = (student.account.failedAttempts || 0) + 1;
      if (student.account.failedAttempts >= 5) {
        student.account.lockedUntil = now + 5 * 60 * 1000;
        student.account.failedAttempts = 0;
        saveDatabase(db);
        return res.status(429).json({ error: 'Nhập sai mật khẩu quá 5 lần! Tài khoản bị khóa 5 phút. Hãy liên hệ GVCN nếu quên mật khẩu.' });
      }
      saveDatabase(db);
      return res.status(401).json({ error: 'Mật khẩu không chính xác' });
    }

    student.account.failedAttempts = 0;
    student.account.lockedUntil = 0;
    saveDatabase(db);

    const token = generateToken({
      role: 'student',
      id: student.id,
      studentCode: student.studentCode,
      fullName: student.fullName
    });

    return res.json({
      token,
      user: {
        role: 'student',
        id: student.id,
        studentCode: student.studentCode,
        fullName: student.fullName,
        isInitialPassword: !!student.account.isInitialPassword
      }
    });
  }

  return res.status(400).json({ error: 'Vai trò đăng nhập không hợp lệ' });
});

// 2. Change password
app.post('/api/auth/change-password', authMiddleware, (req, res) => {
  const user = (req as any).user as SessionUser;
  const { oldPassword, newPassword } = req.body;
  const db = loadDatabase();

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
  }

  if (user.role === 'teacher') {
    if (!oldPassword) {
      return res.status(400).json({ error: 'Vui lòng nhập mật khẩu cũ để xác thực' });
    }
    const isValid = verifyPassword(oldPassword, db.teacher.hash, db.teacher.salt);
    if (!isValid) {
      return res.status(401).json({ error: 'Mật khẩu cũ không chính xác' });
    }

    const newPass = hashPassword(newPassword);
    db.teacher.hash = newPass.hash;
    db.teacher.salt = newPass.salt;
    db.auditLogs.unshift({
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'Đổi mật khẩu GV',
      actor: db.settings.teacherName,
      details: 'Giáo viên đã đổi mật khẩu quản trị'
    });
    saveDatabase(db);
    return res.json({ message: 'Đổi mật khẩu thành công!' });
  }

  if (user.role === 'student') {
    const student = db.students.find((s: any) => s.id === user.id);
    if (!student) {
      return res.status(404).json({ error: 'Không tìm thấy học sinh' });
    }

    // If it's initial password change, old password check is optional or verified
    if (!student.account.isInitialPassword) {
      if (!oldPassword) {
        return res.status(400).json({ error: 'Vui lòng nhập mật khẩu cũ' });
      }
      const isValid = verifyPassword(oldPassword, student.account.hash, student.account.salt);
      if (!isValid) {
        return res.status(401).json({ error: 'Mật khẩu cũ không đúng' });
      }
    }

    const newPass = hashPassword(newPassword);
    student.account.hash = newPass.hash;
    student.account.salt = newPass.salt;
    student.account.isInitialPassword = false;
    saveDatabase(db);
    return res.json({ message: 'Đổi mật khẩu thành công! Tài khoản của bạn đã được bảo vệ.' });
  }
});

// 3. Teacher Reset Student Password
app.post('/api/auth/teacher-reset-student-password', authMiddleware, teacherOnly, (req, res) => {
  const { studentId } = req.body;
  const db = loadDatabase();
  const student = db.students.find((s: any) => s.id === studentId);

  if (!student) {
    return res.status(404).json({ error: 'Không tìm thấy học sinh' });
  }

  const defaultDobPass = student.dob.replace(/\D/g, '');
  const passObj = hashPassword(defaultDobPass);
  student.account.hash = passObj.hash;
  student.account.salt = passObj.salt;
  student.account.isInitialPassword = true;
  student.account.failedAttempts = 0;
  student.account.lockedUntil = 0;

  db.auditLogs.unshift({
    id: `log_${Date.now()}`,
    timestamp: new Date().toISOString(),
    action: 'Đặt lại mật khẩu học sinh',
    actor: db.settings.teacherName,
    details: `Đặt lại mật khẩu cho học sinh ${student.fullName} (${student.studentCode}) về ngày sinh`
  });

  saveDatabase(db);
  return res.json({ message: `Đã đặt lại mật khẩu của ${student.fullName} về ngày sinh (${defaultDobPass})` });
});

// 4. Current user session check
app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = (req as any).user as SessionUser;
  const db = loadDatabase();

  if (user.role === 'teacher') {
    return res.json({
      role: 'teacher',
      teacherName: db.settings.teacherName,
      className: db.settings.className
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
    isInitialPassword: !!student.account.isInitialPassword
  });
});

// 5. Fetch application data (Role-aware & privacy filtered)
app.get('/api/data', authMiddleware, (req, res) => {
  const user = (req as any).user as SessionUser;
  const db = loadDatabase();

  // Common public data for all
  const common = {
    settings: db.settings,
    disciplineRules: db.disciplineRules.filter((r: any) => r.isActive !== false),
    subjects: db.subjects.filter((s: any) => s.isActive !== false),
    announcements: db.announcements,
    seatingChart: db.seatingChart,
    honors: db.honors.filter((h: any) => h.confirmed !== false)
  };

  if (user.role === 'teacher') {
    // Teachers get full access to manage everything
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
        isLocked: !!(st.account.lockedUntil && st.account.lockedUntil > Date.now())
      })),
      attendance: db.attendance,
      disciplineEvents: db.disciplineEvents,
      grades: db.grades,
      honors: db.honors,
      auditLogs: db.auditLogs.slice(0, 50)
    });
  }

  // Students ONLY receive public info, minimal class roster for seating labels, AND STRICTLY their own records!
  const myStudent = db.students.find((s: any) => s.id === user.id);
  const myAttendance = db.attendance.filter((a: any) => a.studentId === user.id);
  const myDiscipline = db.disciplineEvents.filter((d: any) => d.studentId === user.id);
  const myGrades = db.grades.filter((g: any) => g.studentId === user.id);

  // Minimal public student directory for seating chart names
  const publicStudentNames = db.students.map((s: any) => ({
    id: s.id,
    studentCode: s.studentCode,
    fullName: s.fullName
  }));

  return res.json({
    ...common,
    students: publicStudentNames,
    currentUserStudent: myStudent ? {
      id: myStudent.id,
      studentCode: myStudent.studentCode,
      fullName: myStudent.fullName,
      gender: myStudent.gender,
      dob: myStudent.dob,
      phone: myStudent.phone,
      isInitialPassword: myStudent.account.isInitialPassword
    } : null,
    attendance: myAttendance,
    disciplineEvents: myDiscipline,
    grades: myGrades
  });
});

// 6. Settings update (Teacher only)
app.post('/api/settings', authMiddleware, teacherOnly, (req, res) => {
  const db = loadDatabase();
  const { appName, schoolName, className, teacherName, academicYear, baseDisciplinePoints, conductThresholds } = req.body;

  if (appName) db.settings.appName = appName;
  if (schoolName) db.settings.schoolName = schoolName;
  if (className) db.settings.className = className;
  if (teacherName) db.settings.teacherName = teacherName;
  if (academicYear) db.settings.academicYear = academicYear;
  if (typeof baseDisciplinePoints === 'number') db.settings.baseDisciplinePoints = baseDisciplinePoints;
  if (Array.isArray(conductThresholds)) db.settings.conductThresholds = conductThresholds;

  db.auditLogs.unshift({
    id: `log_${Date.now()}`,
    timestamp: new Date().toISOString(),
    action: 'Cập nhật cài đặt chung',
    actor: db.settings.teacherName,
    details: 'Thay đổi thông tin lớp học và cài đặt hệ thống'
  });

  saveDatabase(db);
  return res.json({ message: 'Lưu cài đặt thành công!', settings: db.settings });
});

// 7. Student Management (Teacher only)
app.post('/api/students', authMiddleware, teacherOnly, (req, res) => {
  const db = loadDatabase();
  const { id, studentCode, fullName, gender, dob, phone } = req.body;

  if (!studentCode || !fullName || !dob) {
    return res.status(400).json({ error: 'Mã học sinh, họ tên và ngày sinh là bắt buộc' });
  }

  const cleanCode = studentCode.trim().toUpperCase();

  // If ID provided, it's an update
  if (id) {
    const student = db.students.find((s: any) => s.id === id);
    if (!student) return res.status(404).json({ error: 'Học sinh không tồn tại' });

    // Check duplicate code with another student
    const dup = db.students.find((s: any) => s.id !== id && s.studentCode.toUpperCase() === cleanCode);
    if (dup) return res.status(400).json({ error: `Mã học sinh ${cleanCode} đã tồn tại` });

    student.studentCode = cleanCode;
    student.fullName = fullName.trim();
    student.gender = gender || 'Nam';
    student.dob = dob.trim();
    student.phone = (phone || '').trim();

    db.auditLogs.unshift({
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'Cập nhật thông tin học sinh',
      actor: db.settings.teacherName,
      details: `Cập nhật thông tin học sinh ${fullName} (${cleanCode})`
    });

    saveDatabase(db);
    return res.json({ message: 'Cập nhật học sinh thành công!', student });
  }

  // Create new student
  const dup = db.students.find((s: any) => s.studentCode.toUpperCase() === cleanCode);
  if (dup) return res.status(400).json({ error: `Mã học sinh ${cleanCode} đã tồn tại` });

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
      lockedUntil: 0
    }
  };

  db.students.push(newStudent);
  db.auditLogs.unshift({
    id: `log_${Date.now()}`,
    timestamp: new Date().toISOString(),
    action: 'Thêm mới học sinh',
    actor: db.settings.teacherName,
    details: `Thêm học sinh ${fullName} (${cleanCode})`
  });

  saveDatabase(db);
  return res.json({ message: 'Thêm học sinh thành công!', student: newStudent });
});

// Bulk Import Students from Excel
app.post('/api/students/import', authMiddleware, teacherOnly, (req, res) => {
  const { students } = req.body;
  if (!Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ error: 'Dữ liệu nhập danh sách trống' });
  }

  const db = loadDatabase();
  let addedCount = 0;
  let updatedCount = 0;

  for (const st of students) {
    if (!st.studentCode || !st.fullName) continue;
    const cleanCode = String(st.studentCode).trim().toUpperCase();
    const existing = db.students.find((s: any) => s.studentCode.toUpperCase() === cleanCode);

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

      db.students.push({
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
          lockedUntil: 0
        }
      });
      addedCount++;
    }
  }

  db.auditLogs.unshift({
    id: `log_${Date.now()}`,
    timestamp: new Date().toISOString(),
    action: 'Nhập danh sách học sinh bằng Excel',
    actor: db.settings.teacherName,
    details: `Nhập thành công: ${addedCount} học sinh mới, cập nhật ${updatedCount} học sinh`
  });

  saveDatabase(db);
  return res.json({
    message: `Nhập thành công! Đã thêm ${addedCount} học sinh mới và cập nhật ${updatedCount} học sinh hiện có.`,
    addedCount,
    updatedCount
  });
});

// Delete student
app.delete('/api/students/:id', authMiddleware, teacherOnly, (req, res) => {
  const { id } = req.params;
  const db = loadDatabase();
  const index = db.students.findIndex((s: any) => s.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Không tìm thấy học sinh để xóa' });
  }

  const removed = db.students[index];
  db.students.splice(index, 1);

  // Remove student from seating chart
  if (db.seatingChart && db.seatingChart.seats) {
    for (const key of Object.keys(db.seatingChart.seats)) {
      if (db.seatingChart.seats[key] === id) {
        db.seatingChart.seats[key] = null;
      }
    }
  }

  db.auditLogs.unshift({
    id: `log_${Date.now()}`,
    timestamp: new Date().toISOString(),
    action: 'Xóa học sinh',
    actor: db.settings.teacherName,
    details: `Đã xóa học sinh ${removed.fullName} (${removed.studentCode})`
  });

  saveDatabase(db);
  return res.json({ message: `Đã xóa học sinh ${removed.fullName}` });
});

// 8. Attendance Management
app.post('/api/attendance', authMiddleware, teacherOnly, (req, res) => {
  const { studentId, date, status } = req.body;
  if (!studentId || !date || !status) {
    return res.status(400).json({ error: 'Thiếu thông tin điểm danh' });
  }

  const db = loadDatabase();
  let record = db.attendance.find((a: any) => a.studentId === studentId && a.date === date);

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
      updatedAt: new Date().toISOString()
    };
    db.attendance.push(record);
  }

  saveDatabase(db);
  return res.json({ message: 'Cập nhật điểm danh thành công', record });
});

// 9. Discipline Management (CRITICAL FEATURE WITH ATTENDANCE SYNC)
app.post('/api/discipline/event', authMiddleware, teacherOnly, (req, res) => {
  const { studentId, date, ruleId, note } = req.body;
  if (!studentId || !date || !ruleId) {
    return res.status(400).json({ error: 'Thiếu thông tin ghi nhận thi đua' });
  }

  const db = loadDatabase();
  const student = db.students.find((s: any) => s.id === studentId);
  const rule = db.disciplineRules.find((r: any) => r.id === ruleId);

  if (!student || !rule) {
    return res.status(404).json({ error: 'Học sinh hoặc quy tắc thi đua không tồn tại' });
  }

  const eventId = `disc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  let linkedAttendanceId: string | null = null;

  // AUTO-SYNC WITH ATTENDANCE IF RULE IS LINKED
  if (rule.linkedAttendance && rule.linkedAttendance !== 'none') {
    let att = db.attendance.find((a: any) => a.studentId === studentId && a.date === date);
    if (att) {
      att.status = rule.linkedAttendance;
      att.source = 'discipline_sync';
      att.linkedDisciplineId = eventId;
      att.updatedAt = new Date().toISOString();
      linkedAttendanceId = att.id;
    } else {
      linkedAttendanceId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      db.attendance.push({
        id: linkedAttendanceId,
        studentId,
        date,
        status: rule.linkedAttendance,
        source: 'discipline_sync',
        linkedDisciplineId: eventId,
        updatedAt: new Date().toISOString()
      });
    }
  }

  // Create Discipline Event with SNAPSHOT values (ruleName, points at this moment in time)
  const newEvent = {
    id: eventId,
    studentId,
    date,
    ruleId,
    ruleName: rule.name,
    points: rule.points,
    note: (note || '').trim(),
    linkedAttendanceId,
    createdAt: new Date().toISOString()
  };

  db.disciplineEvents.unshift(newEvent);

  db.auditLogs.unshift({
    id: `log_${Date.now()}`,
    timestamp: new Date().toISOString(),
    action: 'Ghi nhận thi đua',
    actor: db.settings.teacherName,
    details: `Ghi nhận cho ${student.fullName}: ${rule.name} (${rule.points >= 0 ? '+' : ''}${rule.points} điểm)`
  });

  saveDatabase(db);
  return res.json({
    message: 'Ghi nhận sự việc thi đua thành công!',
    event: newEvent,
    attendanceSynced: !!linkedAttendanceId
  });
});

// Delete Discipline Event and Recalculate Attendance
app.delete('/api/discipline/event/:id', authMiddleware, teacherOnly, (req, res) => {
  const { id } = req.params;
  const db = loadDatabase();
  const eventIndex = db.disciplineEvents.findIndex((e: any) => e.id === id);

  if (eventIndex === -1) {
    return res.status(404).json({ error: 'Không tìm thấy bản ghi thi đua để xóa' });
  }

  const event = db.disciplineEvents[eventIndex];
  db.disciplineEvents.splice(eventIndex, 1);

  // If this event was linked to attendance, check if there are other discipline events on that date
  if (event.linkedAttendanceId) {
    const studentId = event.studentId;
    const date = event.date;

    // Check if another event exists for same student and date with attendance link
    const otherLinkedEvent = db.disciplineEvents.find(
      (e: any) => e.studentId === studentId && e.date === date && e.linkedAttendanceId
    );

    const attIndex = db.attendance.findIndex((a: any) => a.id === event.linkedAttendanceId || (a.studentId === studentId && a.date === date));
    if (attIndex !== -1) {
      if (otherLinkedEvent) {
        // Re-link to the remaining event
        const rule = db.disciplineRules.find((r: any) => r.id === otherLinkedEvent.ruleId);
        if (rule && rule.linkedAttendance && rule.linkedAttendance !== 'none') {
          db.attendance[attIndex].status = rule.linkedAttendance;
          db.attendance[attIndex].linkedDisciplineId = otherLinkedEvent.id;
        }
      } else {
        // Revert to 'present' or remove attendance sync
        db.attendance[attIndex].status = 'present';
        db.attendance[attIndex].source = 'manual';
        db.attendance[attIndex].linkedDisciplineId = undefined;
      }
    }
  }

  db.auditLogs.unshift({
    id: `log_${Date.now()}`,
    timestamp: new Date().toISOString(),
    action: 'Xóa ghi nhận thi đua',
    actor: db.settings.teacherName,
    details: `Xóa sự việc "${event.ruleName}" (${event.points} điểm) ngày ${event.date}`
  });

  saveDatabase(db);
  return res.json({ message: 'Đã xóa bản ghi thi đua và tính lại điểm thành công!' });
});

// 10. Discipline Rules Management
app.post('/api/discipline/rules', authMiddleware, teacherOnly, (req, res) => {
  const { id, name, group, points, linkedAttendance, isActive } = req.body;
  if (!name || typeof points !== 'number') {
    return res.status(400).json({ error: 'Tên quy tắc và số điểm là bắt buộc' });
  }

  const db = loadDatabase();

  if (id) {
    const rule = db.disciplineRules.find((r: any) => r.id === id);
    if (!rule) return res.status(404).json({ error: 'Không tìm thấy quy tắc' });

    rule.name = name.trim();
    rule.group = group || 'Nề nếp';
    rule.points = points;
    rule.linkedAttendance = linkedAttendance || 'none';
    if (typeof isActive === 'boolean') rule.isActive = isActive;

    saveDatabase(db);
    return res.json({ message: 'Cập nhật quy tắc thi đua thành công!', rule });
  }

  const newRule = {
    id: `rule_${Date.now()}`,
    name: name.trim(),
    group: group || 'Nề nếp',
    points,
    linkedAttendance: linkedAttendance || 'none',
    isActive: true
  };

  db.disciplineRules.push(newRule);
  saveDatabase(db);
  return res.json({ message: 'Thêm mới quy tắc thi đua thành công!', rule: newRule });
});

app.delete('/api/discipline/rules/:id', authMiddleware, teacherOnly, (req, res) => {
  const { id } = req.params;
  const db = loadDatabase();
  const rule = db.disciplineRules.find((r: any) => r.id === id);

  if (!rule) return res.status(404).json({ error: 'Không tìm thấy quy tắc' });
  // Soft deactivate so historical logs are not broken
  rule.isActive = false;

  saveDatabase(db);
  return res.json({ message: 'Đã ngừng áp dụng quy tắc thi đua' });
});

// 11. Subjects Management
app.post('/api/subjects', authMiddleware, teacherOnly, (req, res) => {
  const { id, name, order, isActive } = req.body;
  if (!name) return res.status(400).json({ error: 'Tên môn học là bắt buộc' });

  const db = loadDatabase();

  if (id) {
    const sub = db.subjects.find((s: any) => s.id === id);
    if (!sub) return res.status(404).json({ error: 'Môn học không tồn tại' });
    sub.name = name.trim();
    if (typeof order === 'number') sub.order = order;
    if (typeof isActive === 'boolean') sub.isActive = isActive;

    saveDatabase(db);
    return res.json({ message: 'Cập nhật môn học thành công!', subject: sub });
  }

  const newSub = {
    id: `sub_${Date.now()}`,
    name: name.trim(),
    order: typeof order === 'number' ? order : db.subjects.length + 1,
    isActive: true
  };

  db.subjects.push(newSub);
  saveDatabase(db);
  return res.json({ message: 'Thêm môn học thành công!', subject: newSub });
});

app.delete('/api/subjects/:id', authMiddleware, teacherOnly, (req, res) => {
  const { id } = req.params;
  const db = loadDatabase();
  const sub = db.subjects.find((s: any) => s.id === id);

  if (!sub) return res.status(404).json({ error: 'Môn học không tồn tại' });
  // Deactivate instead of hard delete to keep grade history intact
  sub.isActive = false;
  saveDatabase(db);
  return res.json({ message: 'Đã ngừng sử dụng môn học (vẫn giữ dữ liệu điểm lịch sử)' });
});

// 12. Grades Management
app.post('/api/grades', authMiddleware, teacherOnly, (req, res) => {
  const { id, studentId, subjectId, semester, scoreType, attempt, score, note } = req.body;
  if (!studentId || !subjectId || typeof score !== 'number') {
    return res.status(400).json({ error: 'Thiếu thông tin điểm số' });
  }

  if (score < 0 || score > 10) {
    return res.status(400).json({ error: 'Điểm số phải từ 0 đến 10' });
  }

  const db = loadDatabase();

  if (id) {
    const gr = db.grades.find((g: any) => g.id === id);
    if (!gr) return res.status(404).json({ error: 'Không tìm thấy bản ghi điểm' });
    gr.score = Math.round(score * 10) / 10;
    gr.semester = semester || 'HK1';
    gr.scoreType = scoreType || 'giua_ky';
    gr.attempt = attempt || 1;
    gr.note = (note || '').trim();
    gr.updatedAt = new Date().toISOString();

    saveDatabase(db);
    return res.json({ message: 'Cập nhật điểm thành công!', grade: gr });
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
    updatedAt: new Date().toISOString()
  };

  db.grades.push(newGrade);
  saveDatabase(db);
  return res.json({ message: 'Nhập điểm thành công!', grade: newGrade });
});

app.delete('/api/grades/:id', authMiddleware, teacherOnly, (req, res) => {
  const { id } = req.params;
  const db = loadDatabase();
  const index = db.grades.findIndex((g: any) => g.id === id);

  if (index === -1) return res.status(404).json({ error: 'Không tìm thấy bản ghi điểm' });
  db.grades.splice(index, 1);
  saveDatabase(db);
  return res.json({ message: 'Đã xóa điểm' });
});

// Bulk Grades Import
app.post('/api/grades/import', authMiddleware, teacherOnly, (req, res) => {
  const { grades } = req.body;
  if (!Array.isArray(grades) || grades.length === 0) {
    return res.status(400).json({ error: 'Danh sách điểm nhập rỗng' });
  }

  const db = loadDatabase();
  let imported = 0;

  for (const item of grades) {
    const student = db.students.find((s: any) => s.studentCode.toUpperCase() === String(item.studentCode || '').trim().toUpperCase());
    const subject = db.subjects.find((s: any) => s.name.toLowerCase() === String(item.subjectName || '').trim().toLowerCase() || s.id === item.subjectId);

    if (!student || !subject) continue;
    const numScore = parseFloat(item.score);
    if (isNaN(numScore) || numScore < 0 || numScore > 10) continue;

    // Check if duplicate grade item exists
    const existing = db.grades.find(
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
      db.grades.push({
        id: `gr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        studentId: student.id,
        subjectId: subject.id,
        semester: item.semester || 'HK1',
        scoreType: item.scoreType || 'giua_ky',
        attempt: Number(item.attempt) || 1,
        score: Math.round(numScore * 10) / 10,
        note: String(item.note || '').trim(),
        updatedAt: new Date().toISOString()
      });
    }
    imported++;
  }

  saveDatabase(db);
  return res.json({ message: `Nhập điểm thành công cho ${imported} bản ghi!` });
});

// 13. Seating Chart Management
app.post('/api/seating', authMiddleware, teacherOnly, (req, res) => {
  const { seats } = req.body;
  if (!seats || typeof seats !== 'object') {
    return res.status(400).json({ error: 'Dữ liệu sơ đồ không hợp lệ' });
  }

  const db = loadDatabase();
  db.seatingChart = {
    seats,
    lastSaved: new Date().toISOString()
  };

  db.auditLogs.unshift({
    id: `log_${Date.now()}`,
    timestamp: new Date().toISOString(),
    action: 'Cập nhật sơ đồ lớp',
    actor: db.settings.teacherName,
    details: 'Đã lưu bố trí vị trí ngồi của học sinh'
  });

  saveDatabase(db);
  return res.json({ message: 'Lưu sơ đồ lớp học thành công!' });
});

// 14. Announcements Management
app.post('/api/announcements', authMiddleware, teacherOnly, (req, res) => {
  const { id, title, content, category, isPinned, imageUrl } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'Tiêu đề và nội dung là bắt buộc' });
  }

  const db = loadDatabase();

  if (id) {
    const ann = db.announcements.find((a: any) => a.id === id);
    if (!ann) return res.status(404).json({ error: 'Không tìm thấy thông báo' });

    ann.title = title.trim();
    ann.content = content.trim();
    ann.category = category || 'Thông báo chung';
    ann.isPinned = !!isPinned;
    if (imageUrl !== undefined) ann.imageUrl = imageUrl;

    saveDatabase(db);
    return res.json({ message: 'Cập nhật thông báo thành công!', announcement: ann });
  }

  const newAnn = {
    id: `ann_${Date.now()}`,
    title: title.trim(),
    content: content.trim(),
    author: `${db.settings.teacherName} (GVCN)`,
    date: new Date().toLocaleString('vi-VN'),
    category: category || 'Thông báo chung',
    isPinned: !!isPinned,
    imageUrl: imageUrl || ''
  };

  db.announcements.unshift(newAnn);
  saveDatabase(db);
  return res.json({ message: 'Đăng thông báo mới thành công!', announcement: newAnn });
});

app.delete('/api/announcements/:id', authMiddleware, teacherOnly, (req, res) => {
  const { id } = req.params;
  const db = loadDatabase();
  const idx = db.announcements.findIndex((a: any) => a.id === id);

  if (idx === -1) return res.status(404).json({ error: 'Không tìm thấy thông báo' });
  db.announcements.splice(idx, 1);
  saveDatabase(db);
  return res.json({ message: 'Đã xóa thông báo' });
});

// 15. Honors Management
app.post('/api/honors', authMiddleware, teacherOnly, (req, res) => {
  const { id, studentId, studentName, title, achievement, month, avatar, confirmed } = req.body;
  if (!studentId || !title || !achievement) {
    return res.status(400).json({ error: 'Thiếu thông tin vinh danh' });
  }

  const db = loadDatabase();
  const student = db.students.find((s: any) => s.id === studentId);

  if (id) {
    const hon = db.honors.find((h: any) => h.id === id);
    if (!hon) return res.status(404).json({ error: 'Không tìm thấy mục vinh danh' });

    hon.studentId = studentId;
    hon.studentName = student ? student.fullName : (studentName || hon.studentName);
    hon.title = title.trim();
    hon.achievement = achievement.trim();
    hon.month = month || 'Tháng này';
    if (avatar) hon.avatar = avatar;
    hon.confirmed = confirmed !== false;

    saveDatabase(db);
    return res.json({ message: 'Cập nhật danh hiệu vinh danh thành công!', honor: hon });
  }

  const newHon = {
    id: `hon_${Date.now()}`,
    studentId,
    studentName: student ? student.fullName : studentName,
    title: title.trim(),
    achievement: achievement.trim(),
    month: month || `Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`,
    avatar: avatar || '',
    confirmed: confirmed !== false
  };

  db.honors.unshift(newHon);
  saveDatabase(db);
  return res.json({ message: 'Thêm vinh danh học sinh thành công!', honor: newHon });
});

app.delete('/api/honors/:id', authMiddleware, teacherOnly, (req, res) => {
  const { id } = req.params;
  const db = loadDatabase();
  const idx = db.honors.findIndex((h: any) => h.id === id);

  if (idx === -1) return res.status(404).json({ error: 'Không tìm thấy danh hiệu vinh danh' });
  db.honors.splice(idx, 1);
  saveDatabase(db);
  return res.json({ message: 'Đã xóa mục vinh danh' });
});

// 16. Backup & Restore Data
app.get('/api/backup/export', authMiddleware, teacherOnly, (req, res) => {
  const db = loadDatabase();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="gvcn_backup_${Date.now()}.json"`);
  return res.send(JSON.stringify(db, null, 2));
});

app.post('/api/backup/restore', authMiddleware, teacherOnly, (req, res) => {
  const { backupData } = req.body;
  if (!backupData || !backupData.settings || !Array.isArray(backupData.students)) {
    return res.status(400).json({ error: 'File sao lưu không đúng định dạng chuẩn của hệ thống GVCN' });
  }

  saveDatabase(backupData);
  return res.json({ message: 'Khôi phục dữ liệu toàn bộ thành công!' });
});

app.post('/api/database/reset-demo', authMiddleware, teacherOnly, (req, res) => {
  const initial = getInitialData();
  saveDatabase(initial);
  return res.json({ message: 'Đã đặt lại dữ liệu mẫu lớp học thành công!' });
});

// 17. Supabase Cloud Integration Endpoints
app.get('/api/supabase/status', authMiddleware, async (req, res) => {
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
      error: error ? error.message : null,
      isTableCreated: !error,
    });
  } catch (err: any) {
    return res.json({
      connected: false,
      url: SUPABASE_URL,
      lastSync: supabaseLastSyncTime,
      error: err.message,
      isTableCreated: false,
    });
  }
});

app.post('/api/supabase/sync', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const db = loadDatabase();
    const { error } = await supabase
      .from('gvcn_store')
      .upsert({
        id: 'gvcn_primary',
        data: db,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      return res.status(400).json({
        error: `Lỗi đồng bộ Supabase: ${error.message}. Nếu chưa tạo bảng "gvcn_store", vui lòng chạy mã SQL trong mục Cài đặt trên Supabase SQL Editor.`,
      });
    }

    supabaseLastSyncTime = new Date().toISOString();
    supabaseSyncError = null;
    return res.json({
      message: 'Đã đồng bộ toàn bộ dữ liệu lên cơ sở dữ liệu Supabase thành công!',
      lastSync: supabaseLastSyncTime,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Lỗi khi đồng bộ lên Supabase' });
  }
});

// ---------------- VITE MIDDLEWARE / STATIC FILES ----------------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  // Initial cloud sync attempt
  await initFromSupabase().catch(() => {});

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[GVCN Server] Running on http://localhost:${PORT}`);
    console.log(`[GVCN Server] Connected to Supabase: ${SUPABASE_URL}`);
  });
}

startServer();
