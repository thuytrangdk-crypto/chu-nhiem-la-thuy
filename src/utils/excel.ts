import * as XLSX from 'xlsx';
import { Student } from '../types';

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
