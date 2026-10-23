import * as XLSX from 'xlsx';
import { Student, AppSettings, DisciplineEvent } from '../types';
import { calculateDisciplineScore, evaluateConduct } from './scoring';

export interface ParsedStudentRow {
  stt?: number;
  studentCode: string;
  fullName: string;
  gender: 'Nam' | 'Nữ';
  dob: string;
  phone: string;
  rowNumber: number;
}

export interface ValidationError {
  rowNumber: number;
  studentCode?: string;
  error: string;
}

// 1. Download Student Roster Sample Template
export function downloadStudentTemplate() {
  const headers = ['STT', 'Mã học sinh', 'Họ và tên', 'Giới tính', 'Ngày sinh', 'Số điện thoại liên hệ'];
  const sampleData = [
    [1, 'HS013', 'Nguyễn Hoàng Nam', 'Nam', '15/04/2008', '0981234567'],
    [2, 'HS014', 'Trần Thảo Ly', 'Nữ', '22/09/2008', '0982345678'],
    [3, 'HS015', 'Lê Khắc Quân', 'Nam', '30/12/2008', '0983456789'],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 26 },
    { wch: 10 },
    { wch: 16 },
    { wch: 18 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DanhSachHocSinh');
  XLSX.writeFile(wb, 'Mau_Danh_Sach_Hoc_Sinh_GVCN.xlsx');
}

// 2. Parse Student Excel File with Validation
export async function parseStudentExcel(file: File, existingCodes: string[] = []): Promise<{
  validRows: ParsedStudentRow[];
  errors: ValidationError[];
  totalRows: number;
}> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  if (rawRows.length <= 1) {
    throw new Error('File Excel không có dữ liệu học sinh hoặc chỉ chứa tiêu đề.');
  }

  // Row 0 is header
  const validRows: ParsedStudentRow[] = [];
  const errors: ValidationError[] = [];
  const seenCodesInFile = new Set<string>();

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    const rowNumber = i + 1; // 1-indexed Excel row

    // Skip empty rows
    if (!row || row.length === 0 || row.every((c: any) => c === undefined || c === null || String(c).trim() === '')) {
      continue;
    }

    const stt = row[0];
    const rawCode = row[1];
    const rawName = row[2];
    const rawGender = row[3];
    const rawDob = row[4];
    const rawPhone = row[5];

    if (!rawCode || String(rawCode).trim() === '') {
      errors.push({ rowNumber, error: 'Thiếu Mã học sinh' });
      continue;
    }

    const studentCode = String(rawCode).trim().toUpperCase();

    if (seenCodesInFile.has(studentCode)) {
      errors.push({ rowNumber, studentCode, error: `Mã học sinh "${studentCode}" bị trùng lặp trong file tải lên` });
      continue;
    }
    seenCodesInFile.add(studentCode);

    if (!rawName || String(rawName).trim() === '') {
      errors.push({ rowNumber, studentCode, error: 'Thiếu Họ và tên học sinh' });
      continue;
    }
    const fullName = String(rawName).trim();

    // Gender check
    let gender: 'Nam' | 'Nữ' = 'Nam';
    if (rawGender) {
      const gStr = String(rawGender).trim().toLowerCase();
      if (gStr === 'nữ' || gStr === 'nu' || gStr === 'female' || gStr === 'f') {
        gender = 'Nữ';
      }
    }

    // DOB formatting & validation
    let dob = '';
    if (rawDob) {
      if (typeof rawDob === 'number') {
        // Excel serial date
        const parsedDate = XLSX.SSF.parse_date_code(rawDob);
        const day = String(parsedDate.d).padStart(2, '0');
        const month = String(parsedDate.m).padStart(2, '0');
        const year = parsedDate.y;
        dob = `${day}/${month}/${year}`;
      } else {
        const clean = String(rawDob).trim();
        // check formats: DD/MM/YYYY or YYYY-MM-DD or DD-MM-YYYY
        if (clean.includes('/')) {
          dob = clean;
        } else if (clean.includes('-')) {
          const parts = clean.split('-');
          if (parts[0].length === 4) {
            dob = `${parts[2]}/${parts[1]}/${parts[0]}`;
          } else {
            dob = `${parts[0]}/${parts[1]}/${parts[2]}`;
          }
        } else {
          dob = clean;
        }
      }
    } else {
      errors.push({ rowNumber, studentCode, error: 'Thiếu ngày tháng năm sinh' });
      continue;
    }

    const phone = rawPhone ? String(rawPhone).trim() : '';

    validRows.push({
      stt: Number(stt) || validRows.length + 1,
      studentCode,
      fullName,
      gender,
      dob,
      phone,
      rowNumber,
    });
  }

  return {
    validRows,
    errors,
    totalRows: rawRows.length - 1,
  };
}

// 3. Export Student Roster to Excel
export function exportStudentsToExcel(
  students: Student[],
  className: string,
  academicYear: string
) {
  const titleRow = [`DANH SÁCH HỌC SINH LỚP ${className} - NĂM HỌC ${academicYear}`];
  const blankRow: any[] = [];
  const headers = ['STT', 'Mã học sinh', 'Họ và tên', 'Giới tính', 'Ngày sinh', 'Số điện thoại'];

  const rows = students.map((st, idx) => [
    idx + 1,
    st.studentCode,
    st.fullName,
    st.gender,
    st.dob,
    st.phone || 'Chưa cập nhật'
  ]);

  const ws = XLSX.utils.aoa_to_sheet([titleRow, blankRow, headers, ...rows]);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 28 },
    { wch: 10 },
    { wch: 16 },
    { wch: 18 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DanhSachLop');
  XLSX.writeFile(wb, `Danh_Sach_Lop_${className}_${academicYear.replace(/\s+/g, '')}.xlsx`);
}

// 4. Download Grade Sample Template
export function downloadGradeTemplate(subjects: { name: string }[]) {
  const headers = ['Mã học sinh', 'Họ và tên', 'Môn học', 'Học kỳ', 'Loại điểm', 'Lần đánh giá', 'Điểm số', 'Ghi chú'];
  const sampleData = [
    ['HS001', 'Nguyễn Văn An', subjects[0]?.name || 'Toán học', 'HK1', 'giua_ky', 1, 9.5, 'Làm bài tốt'],
    ['HS001', 'Nguyễn Văn An', subjects[1]?.name || 'Ngữ văn', 'HK1', '15_phut', 1, 8.0, ''],
    ['HS002', 'Trần Thị Bích', subjects[0]?.name || 'Toán học', 'HK1', 'giua_ky', 1, 9.0, ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
  ws['!cols'] = [
    { wch: 14 },
    { wch: 24 },
    { wch: 18 },
    { wch: 10 },
    { wch: 14 },
    { wch: 12 },
    { wch: 10 },
    { wch: 24 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'MauNhapDiem');
  XLSX.writeFile(wb, 'Mau_Nhap_Bang_Diem_GVCN.xlsx');
}

// 5. Parse Grade Excel
export async function parseGradeExcel(file: File): Promise<{
  validRows: any[];
  errors: ValidationError[];
}> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (rawRows.length <= 1) {
    throw new Error('File bảng điểm không có dữ liệu');
  }

  const validRows: any[] = [];
  const errors: ValidationError[] = [];

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    const rowNumber = i + 1;
    if (!row || row.length === 0 || row.every((c: any) => c === undefined || c === null || String(c).trim() === '')) {
      continue;
    }

    const studentCode = row[0] ? String(row[0]).trim().toUpperCase() : '';
    const subjectName = row[2] ? String(row[2]).trim() : '';
    const semester = row[3] ? String(row[3]).trim() : 'HK1';
    const scoreType = row[4] ? String(row[4]).trim() : 'giua_ky';
    const attempt = Number(row[5]) || 1;
    const rawScore = row[6];
    const note = row[7] ? String(row[7]).trim() : '';

    if (!studentCode) {
      errors.push({ rowNumber, error: 'Thiếu Mã học sinh' });
      continue;
    }
    if (!subjectName) {
      errors.push({ rowNumber, studentCode, error: 'Thiếu Tên môn học' });
      continue;
    }

    const numScore = parseFloat(rawScore);
    if (isNaN(numScore) || numScore < 0 || numScore > 10) {
      errors.push({ rowNumber, studentCode, error: `Điểm số "${rawScore}" không hợp lệ (phải từ 0 đến 10)` });
      continue;
    }

    validRows.push({
      studentCode,
      subjectName,
      semester,
      scoreType,
      attempt,
      score: Math.round(numScore * 10) / 10,
      note,
    });
  }

  return { validRows, errors };
}

// ----------------------------------------------------
// 6. Export Discipline & Competition Report (2 Sheets)
// ----------------------------------------------------

export interface DisciplineExportOptions {
  periodType: 'week' | 'month' | 'semester' | 'year' | 'custom';
  periodLabel: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

function sanitizeExcelText(val: any): string {
  if (val === undefined || val === null) return '';
  const str = String(val).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

function formatDateVN(dateStr?: string): string {
  if (!dateStr) return '';
  const clean = dateStr.slice(0, 10);
  if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts.length === 3) {
      return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    }
  }
  return clean;
}

function formatDateTimeVN(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${hours}:${minutes} ${day}/${month}/${year}`;
}

export function exportDisciplineToExcel(
  allStudents: Student[],
  events: DisciplineEvent[],
  settings: AppSettings,
  options: DisciplineExportOptions
) {
  if (!allStudents || allStudents.length === 0) {
    throw new Error('Không có dữ liệu học sinh trong lớp để xuất báo cáo thi đua.');
  }

  const exportTimeStr = formatDateTimeVN(new Date());
  const basePoints = typeof settings.baseDisciplinePoints === 'number' ? settings.baseDisciplinePoints : 100;

  // 1. Calculate discipline scores for all students in the class
  const studentMap = new Map<string, Student>();
  allStudents.forEach((s) => studentMap.set(s.id, s));

  const studentScores = allStudents.map((st) => {
    const scoreData = calculateDisciplineScore(
      st.id,
      events,
      basePoints,
      { startDate: options.startDate, endDate: options.endDate }
    );
    const conduct = evaluateConduct(scoreData.totalScore, settings.conductThresholds);
    return {
      student: st,
      totalScore: scoreData.totalScore,
      deltaPoints: scoreData.deltaPoints,
      positivePoints: scoreData.positivePoints,
      negativePoints: scoreData.negativePoints, // positive number
      positiveCount: scoreData.positiveCount,
      negativeCount: scoreData.negativeCount,
      conduct: conduct.label,
    };
  });

  // Sort by totalScore DESCENDING; secondary sort by fullName Vietnamese locale
  studentScores.sort((a, b) => {
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    return a.student.fullName.localeCompare(b.student.fullName, 'vi');
  });

  // Calculate ranking: equal score = same rank (Standard Competition Ranking: 1, 2, 2, 4...)
  let currentRank = 1;
  const rankedData = studentScores.map((item, idx) => {
    if (idx > 0 && item.totalScore === studentScores[idx - 1].totalScore) {
      return { ...item, rank: currentRank };
    } else {
      currentRank = idx + 1;
      return { ...item, rank: currentRank };
    }
  });

  // ==========================================
  // SHEET 1: TỔNG HỢP THI ĐUA
  // ==========================================
  const s1Metadata: any[][] = [
    ['BẢNG TỔNG HỢP THI ĐUA HỌC SINH'],
    ['Trường:', settings.schoolName || 'Chưa cập nhật', '', 'Năm học:', settings.academicYear || 'Chưa cập nhật'],
    ['Lớp:', settings.className || 'Chưa cập nhật', '', 'Giáo viên chủ nhiệm:', settings.teacherName || 'Chưa cập nhật'],
    ['Kỳ báo cáo:', options.periodLabel, '', 'Thời gian xuất:', exportTimeStr],
    ['Khoảng thời gian:', `Từ ngày ${formatDateVN(options.startDate)} đến ngày ${formatDateVN(options.endDate)} (trọn ngày, múi giờ Việt Nam)`],
    [], // Blank separator row
    [
      'STT',
      'Mã hồ sơ học sinh',
      'Họ và tên',
      'Lớp',
      'Điểm ban đầu',
      'Tổng điểm cộng',
      'Tổng điểm trừ',
      'Tổng điểm thi đua',
      'Xếp loại thi đua',
      'Xếp hạng',
      'Số lượt ghi nhận tích cực',
      'Số lượt ghi nhận vi phạm',
      'Ghi chú',
    ],
  ];

  const s1Rows: any[][] = rankedData.map((item, idx) => [
    idx + 1,
    sanitizeExcelText(item.student.studentCode),
    sanitizeExcelText(item.student.fullName),
    sanitizeExcelText(settings.className || ''),
    basePoints,
    item.positivePoints,
    item.negativePoints,
    item.totalScore,
    item.conduct,
    item.rank,
    item.positiveCount,
    item.negativeCount,
    '',
  ]);

  const ws1Data = [...s1Metadata, ...s1Rows];
  const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);

  // Format cell types explicitly for Sheet 1
  const headerRowIdxS1 = 6; // 0-indexed row for table headers (Row 7 in Excel)
  for (let r = 0; r < rankedData.length; r++) {
    const rowNum = headerRowIdxS1 + 1 + r;
    const item = rankedData[r];

    // STT (col A)
    const cellA = XLSX.utils.encode_cell({ r: rowNum, c: 0 });
    ws1[cellA] = { t: 'n', v: r + 1 };

    // Mã hồ sơ (col B) -> string to preserve leading zeroes
    const cellB = XLSX.utils.encode_cell({ r: rowNum, c: 1 });
    ws1[cellB] = { t: 's', v: String(item.student.studentCode) };

    // Họ tên (col C)
    const cellC = XLSX.utils.encode_cell({ r: rowNum, c: 2 });
    ws1[cellC] = { t: 's', v: sanitizeExcelText(item.student.fullName) };

    // Lớp (col D)
    const cellD = XLSX.utils.encode_cell({ r: rowNum, c: 3 });
    ws1[cellD] = { t: 's', v: sanitizeExcelText(settings.className || '') };

    // Điểm ban đầu (col E) -> number
    const cellE = XLSX.utils.encode_cell({ r: rowNum, c: 4 });
    ws1[cellE] = { t: 'n', v: basePoints };

    // Tổng điểm cộng (col F) -> number
    const cellF = XLSX.utils.encode_cell({ r: rowNum, c: 5 });
    ws1[cellF] = { t: 'n', v: item.positivePoints };

    // Tổng điểm trừ (col G) -> number (positive number)
    const cellG = XLSX.utils.encode_cell({ r: rowNum, c: 6 });
    ws1[cellG] = { t: 'n', v: item.negativePoints };

    // Tổng điểm thi đua (col H) -> number
    const cellH = XLSX.utils.encode_cell({ r: rowNum, c: 7 });
    ws1[cellH] = { t: 'n', v: item.totalScore };

    // Xếp loại thi đua (col I)
    const cellI = XLSX.utils.encode_cell({ r: rowNum, c: 8 });
    ws1[cellI] = { t: 's', v: item.conduct };

    // Xếp hạng (col J) -> number
    const cellJ = XLSX.utils.encode_cell({ r: rowNum, c: 9 });
    ws1[cellJ] = { t: 'n', v: item.rank };

    // Số lượt tích cực (col K) -> number
    const cellK = XLSX.utils.encode_cell({ r: rowNum, c: 10 });
    ws1[cellK] = { t: 'n', v: item.positiveCount };

    // Số lượt vi phạm (col L) -> number
    const cellL = XLSX.utils.encode_cell({ r: rowNum, c: 11 });
    ws1[cellL] = { t: 'n', v: item.negativeCount };

    // Ghi chú (col M)
    const cellM = XLSX.utils.encode_cell({ r: rowNum, c: 12 });
    ws1[cellM] = { t: 's', v: '' };
  }

  // Freeze header row and enable autofilter
  ws1['!views'] = [{ state: 'frozen', ySplit: 7 }];
  ws1['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: headerRowIdxS1, c: 0 },
      e: { r: headerRowIdxS1 + rankedData.length, c: 12 },
    }),
  };

  // Column widths for Sheet 1
  ws1['!cols'] = [
    { wch: 6 },  // STT
    { wch: 18 }, // Mã hồ sơ học sinh
    { wch: 26 }, // Họ và tên
    { wch: 10 }, // Lớp
    { wch: 14 }, // Điểm ban đầu
    { wch: 16 }, // Tổng điểm cộng
    { wch: 16 }, // Tổng điểm trừ
    { wch: 18 }, // Tổng điểm thi đua
    { wch: 16 }, // Xếp loại thi đua
    { wch: 12 }, // Xếp hạng
    { wch: 24 }, // Số lượt ghi nhận tích cực
    { wch: 24 }, // Số lượt ghi nhận vi phạm
    { wch: 28 }, // Ghi chú
  ];

  // ==========================================
  // SHEET 2: CHI TIẾT GHI NHẬN
  // ==========================================
  // Filter events within date range belonging to students in this class
  const classStudentIds = new Set(allStudents.map((s) => s.id));
  const seenEventIds = new Set<string>();
  const filteredEvents: DisciplineEvent[] = [];

  for (const ev of events) {
    if (!classStudentIds.has(ev.studentId)) continue;
    if (ev.id) {
      if (seenEventIds.has(ev.id)) continue;
      seenEventIds.add(ev.id);
    }

    const evDate = (ev.date || '').slice(0, 10);
    if (!evDate) continue;

    if (options.startDate && evDate < options.startDate) continue;
    if (options.endDate && evDate > options.endDate) continue;

    filteredEvents.push(ev);
  }

  // Sort events chronologically (date ascending, studentCode ascending)
  filteredEvents.sort((a, b) => {
    const dComp = a.date.localeCompare(b.date);
    if (dComp !== 0) return dComp;
    const stA = studentMap.get(a.studentId)?.studentCode || '';
    const stB = studentMap.get(b.studentId)?.studentCode || '';
    return stA.localeCompare(stB);
  });

  const s2Metadata: any[][] = [
    ['BẢNG CHI TIẾT GHI NHẬN THI ĐUA HỌC SINH'],
    ['Trường:', settings.schoolName || 'Chưa cập nhật', '', 'Năm học:', settings.academicYear || 'Chưa cập nhật'],
    ['Lớp:', settings.className || 'Chưa cập nhật', '', 'Giáo viên chủ nhiệm:', settings.teacherName || 'Chưa cập nhật'],
    ['Kỳ báo cáo:', options.periodLabel, '', 'Thời gian xuất:', exportTimeStr],
    ['Khoảng thời gian:', `Từ ngày ${formatDateVN(options.startDate)} đến ngày ${formatDateVN(options.endDate)} (trọn ngày, múi giờ Việt Nam)`],
    [], // Blank separator row
    [
      'STT',
      'Thời gian',
      'Mã hồ sơ học sinh',
      'Họ và tên',
      'Nội dung sự việc',
      'Loại ghi nhận',
      'Điểm cộng/trừ',
      'Người ghi nhận',
      'Ghi chú',
    ],
  ];

  const teacherRecorderName = settings.teacherName ? `GVCN ${settings.teacherName}` : 'Giáo viên chủ nhiệm';

  const s2Rows: any[][] = filteredEvents.map((ev, idx) => {
    const student = studentMap.get(ev.studentId);
    const pts = typeof ev.points === 'number' ? ev.points : Number(ev.points) || 0;
    const pointsFormatted = pts > 0 ? `+${pts}` : pts === 0 ? '0' : `${pts}`;
    const eventType = pts > 0 ? 'Tích cực' : pts < 0 ? 'Vi phạm' : 'Ghi nhận';

    return [
      idx + 1,
      formatDateVN(ev.date),
      sanitizeExcelText(student?.studentCode || 'N/A'),
      sanitizeExcelText(student?.fullName || 'N/A'),
      sanitizeExcelText(ev.ruleName || 'Ghi nhận thi đua'),
      eventType,
      pointsFormatted,
      teacherRecorderName,
      sanitizeExcelText(ev.note || ''),
    ];
  });

  // If no events in the selected period, add an informative notice row
  if (s2Rows.length === 0) {
    s2Rows.push([
      1,
      '-',
      '-',
      '-',
      'Không có sự việc thi đua nào phát sinh trong khoảng thời gian đã chọn',
      '-',
      '-',
      teacherRecorderName,
      '',
    ]);
  }

  const ws2Data = [...s2Metadata, ...s2Rows];
  const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);

  const headerRowIdxS2 = 6;
  for (let r = 0; r < s2Rows.length; r++) {
    const rowNum = headerRowIdxS2 + 1 + r;
    const rowItem = s2Rows[r];

    // STT (col A)
    const cellA = XLSX.utils.encode_cell({ r: rowNum, c: 0 });
    ws2[cellA] = { t: 'n', v: r + 1 };

    // Thời gian (col B)
    const cellB = XLSX.utils.encode_cell({ r: rowNum, c: 1 });
    ws2[cellB] = { t: 's', v: String(rowItem[1]) };

    // Mã HS (col C)
    const cellC = XLSX.utils.encode_cell({ r: rowNum, c: 2 });
    ws2[cellC] = { t: 's', v: String(rowItem[2]) };

    // Họ tên (col D)
    const cellD = XLSX.utils.encode_cell({ r: rowNum, c: 3 });
    ws2[cellD] = { t: 's', v: String(rowItem[3]) };

    // Nội dung (col E)
    const cellE = XLSX.utils.encode_cell({ r: rowNum, c: 4 });
    ws2[cellE] = { t: 's', v: String(rowItem[4]) };

    // Loại ghi nhận (col F)
    const cellF = XLSX.utils.encode_cell({ r: rowNum, c: 5 });
    ws2[cellF] = { t: 's', v: String(rowItem[5]) };

    // Điểm cộng/trừ có dấu (col G)
    const cellG = XLSX.utils.encode_cell({ r: rowNum, c: 6 });
    ws2[cellG] = { t: 's', v: String(rowItem[6]) };

    // Người ghi nhận (col H)
    const cellH = XLSX.utils.encode_cell({ r: rowNum, c: 7 });
    ws2[cellH] = { t: 's', v: String(rowItem[7]) };

    // Ghi chú (col I)
    const cellI = XLSX.utils.encode_cell({ r: rowNum, c: 8 });
    ws2[cellI] = { t: 's', v: String(rowItem[8]) };
  }

  // Freeze header row and enable autofilter
  ws2['!views'] = [{ state: 'frozen', ySplit: 7 }];
  ws2['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: headerRowIdxS2, c: 0 },
      e: { r: headerRowIdxS2 + s2Rows.length, c: 8 },
    }),
  };

  // Column widths for Sheet 2
  ws2['!cols'] = [
    { wch: 6 },  // STT
    { wch: 14 }, // Thời gian
    { wch: 18 }, // Mã hồ sơ học sinh
    { wch: 26 }, // Họ và tên
    { wch: 34 }, // Nội dung sự việc
    { wch: 16 }, // Loại ghi nhận
    { wch: 16 }, // Điểm cộng/trừ
    { wch: 24 }, // Người ghi nhận
    { wch: 32 }, // Ghi chú
  ];

  // ==========================================
  // ASSEMBLE WORKBOOK & DOWNLOAD
  // ==========================================
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'Tổng hợp thi đua');
  XLSX.utils.book_append_sheet(wb, ws2, 'Chi tiết ghi nhận');

  // Filename format: Thi_dua_[TenLop]_[TuNgay]_[DenNgay].xlsx
  const fromDateFormatted = options.startDate.split('-').reverse().join('-');
  const toDateFormatted = options.endDate.split('-').reverse().join('-');
  const safeClassName = (settings.className || 'Lop').replace(/[\s/\\?%*:|"<>]/g, '_');
  const filename = `Thi_dua_${safeClassName}_${fromDateFormatted}_${toDateFormatted}.xlsx`;

  XLSX.writeFile(wb, filename);
}
