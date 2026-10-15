export type UserRole = 'teacher' | 'student';

export interface AppSettings {
  appName: string;
  schoolName: string;
  className: string;
  teacherName: string;
  academicYear: string;
  baseDisciplinePoints: number;
  conductThresholds: {
    label: string;
    minScore: number;
  }[];
}

export interface Student {
  id: string;
  studentCode: string;
  fullName: string;
  gender: 'Nam' | 'Nữ';
  dob: string;
  phone: string;
  avatar?: string;
  isInitialPassword?: boolean;
  isLocked?: boolean;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  status: 'present' | 'excused_absence' | 'unexcused_absence' | 'late';
  source: 'manual' | 'discipline_sync';
  linkedDisciplineId?: string;
  updatedAt: string;
}

export interface DisciplineRule {
  id: string;
  name: string;
  group: 'Học tập' | 'Nề nếp' | 'Chuyên cần' | 'Phong trào' | 'Khác';
  points: number;
  linkedAttendance: 'none' | 'present' | 'excused_absence' | 'unexcused_absence' | 'late';
  isActive: boolean;
}

export interface DisciplineEvent {
  id: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  ruleId: string;
  ruleName: string;
  points: number;
  note?: string;
  linkedAttendanceId?: string | null;
  createdAt: string;
}

export interface Subject {
  id: string;
  name: string;
  order: number;
  isActive: boolean;
}

export interface Grade {
  id: string;
  studentId: string;
  subjectId: string;
  semester: 'HK1' | 'HK2';
  scoreType: 'diem_mieng' | '15_phut' | 'giua_ky' | 'cuoi_ky';
  attempt: number;
  score: number;
  note?: string;
  updatedAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  author: string;
  date: string;
  category: 'Thông báo chung' | 'Học tập' | 'Hoạt động' | 'Nhắc nhở';
  isPinned: boolean;
  imageUrl?: string;
}

export interface SeatingChart {
  seats: Record<string, string | null>;
  lastSaved: string;
}

export interface HonorItem {
  id: string;
  studentId: string;
  studentName: string;
  title: string;
  achievement: string;
  month: string;
  avatar?: string;
  confirmed: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  details: string;
}

export interface AppData {
  settings: AppSettings;
  disciplineRules: DisciplineRule[];
  subjects: Subject[];
  students: Student[];
  attendance: AttendanceRecord[];
  disciplineEvents: DisciplineEvent[];
  grades: Grade[];
  announcements: Announcement[];
  seatingChart: SeatingChart;
  honors: HonorItem[];
  auditLogs?: AuditLog[];
  currentUserStudent?: Student | null;
}

export interface AuthState {
  token: string | null;
  role: UserRole | null;
  studentId?: string;
  studentCode?: string;
  fullName?: string;
  teacherName?: string;
  isInitialPassword?: boolean;
}
