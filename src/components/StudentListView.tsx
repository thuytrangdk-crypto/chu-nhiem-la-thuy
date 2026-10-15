import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  UserPlus,
  FileSpreadsheet,
  Download,
  Upload,
  Edit2,
  Trash2,
  KeyRound,
  Eye,
  CheckCircle,
  AlertCircle,
  X,
  RefreshCw,
  Lock,
  Unlock,
  AlertTriangle
} from 'lucide-react';
import { AppData, Student } from '../types';
import { apiRequest } from '../utils/api';
import {
  downloadStudentTemplate,
  parseStudentExcel,
  exportStudentsToExcel,
  ParsedStudentRow,
  ValidationError
} from '../utils/excel';

interface StudentListViewProps {
  data: AppData;
  onSelectStudent: (studentId: string) => void;
  onRefreshData: () => Promise<void>;
}

export const StudentListView: React.FC<StudentListViewProps> = ({
  data,
  onSelectStudent,
  onRefreshData,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'Nam' | 'Nữ'>('all');
  const [sortField, setSortField] = useState<'code' | 'name'>('code');

  // Add / Edit Student modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formGender, setFormGender] = useState<'Nam' | 'Nữ'>('Nam');
  const [formDob, setFormDob] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Excel Import Modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedStudentRow[]>([]);
  const [importErrors, setImportErrors] = useState<ValidationError[]>([]);
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [isCommittingImport, setIsCommittingImport] = useState(false);

  // Filtered & sorted student list
  const filteredStudents = useMemo(() => {
    return data.students
      .filter((st) => {
        const matchesQuery =
          st.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          st.studentCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (st.phone && st.phone.includes(searchQuery));
        const matchesGender = genderFilter === 'all' || st.gender === genderFilter;
        return matchesQuery && matchesGender;
      })
      .sort((a, b) => {
        if (sortField === 'code') {
          return a.studentCode.localeCompare(b.studentCode, undefined, { numeric: true });
        }
        return a.fullName.localeCompare(b.fullName, 'vi');
      });
  }, [data.students, searchQuery, genderFilter, sortField]);

  // Open Add modal
  const handleOpenAdd = () => {
    setEditingStudent(null);
    // Auto suggest next code
    const nextNum = data.students.length + 1;
    setFormCode(`HS${String(nextNum).padStart(3, '0')}`);
    setFormName('');
    setFormGender('Nam');
    setFormDob('01/01/2008');
    setFormPhone('');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Edit modal
  const handleOpenEdit = (st: Student) => {
    setEditingStudent(st);
    setFormCode(st.studentCode);
    setFormName(st.fullName);
    setFormGender(st.gender);
    setFormDob(st.dob);
    setFormPhone(st.phone || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Save student (Add / Edit)
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      await apiRequest('/api/students', {
        method: 'POST',
        body: {
          id: editingStudent ? editingStudent.id : undefined,
          studentCode: formCode,
          fullName: formName,
          gender: formGender,
          dob: formDob,
          phone: formPhone,
        },
      });
      await onRefreshData();
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Lỗi khi lưu học sinh');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete student
  const handleDeleteStudent = async (st: Student) => {
    if (
      !confirm(
        `Bạn có chắc chắn muốn xóa học sinh "${st.fullName}" (${st.studentCode}) khỏi danh sách? Thao tác này sẽ xóa vị trí ngồi và chuyển dữ liệu sang trạng thái lưu trữ.`
      )
    ) {
      return;
    }

    try {
      await apiRequest(`/api/students/${st.id}`, { method: 'DELETE' });
      await onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xóa học sinh');
    }
  };

  // Reset student password
  const handleResetPassword = async (st: Student) => {
    const dobPlain = st.dob.replace(/\D/g, '');
    if (
      !confirm(
        `Đặt lại mật khẩu cho học sinh "${st.fullName}" (${st.studentCode}) về ngày sinh mặc định (${dobPlain})?`
      )
    ) {
      return;
    }

    try {
      const res = await apiRequest('/api/auth/teacher-reset-student-password', {
        method: 'POST',
        body: { studentId: st.id },
      });
      alert(res.message);
      await onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi đặt lại mật khẩu');
    }
  };

  // Excel file selection & parsing
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelFile(file);
    setIsParsingExcel(true);
    setImportErrors([]);
    setParsedRows([]);

    try {
      const existingCodes = data.students.map((s) => s.studentCode.toUpperCase());
      const res = await parseStudentExcel(file, existingCodes);
      setParsedRows(res.validRows);
      setImportErrors(res.errors);
    } catch (err: any) {
      setImportErrors([{ rowNumber: 1, error: err.message || 'Lỗi khi đọc file Excel' }]);
    } finally {
      setIsParsingExcel(false);
    }
  };

  // Commit imported rows
  const handleCommitImport = async () => {
    if (parsedRows.length === 0) return;
    setIsCommittingImport(true);

    try {
      const res = await apiRequest('/api/students/import', {
        method: 'POST',
        body: { students: parsedRows },
      });
      alert(res.message);
      await onRefreshData();
      setIsImportModalOpen(false);
      setExcelFile(null);
      setParsedRows([]);
      setImportErrors([]);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi nhập danh sách học sinh');
    } finally {
      setIsCommittingImport(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Action Header & Tools */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Search & Filter */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <input
              type="text"
              placeholder="Tìm theo tên, mã HS, SĐT..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 w-60"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl text-xs">
            {(['all', 'Nam', 'Nữ'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGenderFilter(g)}
                className={`px-3 py-1 font-medium rounded-lg transition-colors cursor-pointer ${
                  genderFilter === g ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {g === 'all' ? 'Tất cả' : g}
              </button>
            ))}
          </div>

          <select
            value={sortField}
            onChange={(e: any) => setSortField(e.target.value)}
            className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 cursor-pointer"
          >
            <option value="code">Sắp xếp theo Mã HS</option>
            <option value="name">Sắp xếp theo Tên (A-Z)</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={downloadStudentTemplate}
            title="Tải file mẫu Excel"
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            File Excel Mẫu
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Nhập Excel
          </button>

          <button
            onClick={() =>
              exportStudentsToExcel(
                filteredStudents,
                data.settings.className,
                data.settings.academicYear
              )
            }
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Xuất Excel
          </button>

          <button
            onClick={handleOpenAdd}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
            Thêm Học Sinh
          </button>
        </div>
      </div>

      {/* Student Roster Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[11px] tracking-wider">
                <th className="py-3 px-4 w-12 text-center">STT</th>
                <th className="py-3 px-4 w-28">Mã HS</th>
                <th className="py-3 px-4">Họ và Tên</th>
                <th className="py-3 px-4 w-24">Giới tính</th>
                <th className="py-3 px-4 w-32">Ngày sinh</th>
                <th className="py-3 px-4 w-32">SĐT Liên hệ</th>
                <th className="py-3 px-4 w-36">Tài khoản</th>
                <th className="py-3 px-4 w-44 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Không tìm thấy học sinh nào phù hợp
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st, index) => (
                  <tr
                    key={st.id}
                    className="hover:bg-sky-50/40 transition-colors group cursor-pointer"
                    onClick={() => onSelectStudent(st.id)}
                  >
                    <td className="py-3 px-4 text-center font-mono text-slate-600">
                      {index + 1}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-sky-800">
                      {st.studentCode}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      <div className="flex items-center gap-2">
                        <span>{st.fullName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[11px] font-medium ${
                          st.gender === 'Nữ' ? 'text-pink-600' : 'text-blue-700'
                        }`}
                      >
                        {st.gender}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{st.dob}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {st.phone || <span className="text-slate-600 italic">Chưa có</span>}
                    </td>
                    <td className="py-3 px-4">
                      {st.isLocked ? (
                        <span className="text-[11px] text-rose-600 font-medium flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Tạm khóa
                        </span>
                      ) : st.isInitialPassword ? (
                        <span className="text-[11px] text-amber-600 font-medium">
                          Chưa đổi MK
                        </span>
                      ) : (
                        <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Đã kích hoạt
                        </span>
                      )}
                    </td>
                    <td
                      className="py-3 px-4 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onSelectStudent(st.id)}
                          title="Xem hồ sơ chi tiết"
                          className="p-1.5 text-sky-600 hover:bg-sky-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(st)}
                          title="Sửa thông tin"
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleResetPassword(st)}
                          title="Đặt lại mật khẩu về ngày sinh"
                          className="p-1.5 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(st)}
                          title="Xóa học sinh"
                          className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= MODAL: ADD / EDIT STUDENT ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800">
                {editingStudent ? 'Cập Nhật Thông Tin Học Sinh' : 'Thêm Mới Học Sinh'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="p-5 space-y-3.5">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mã học sinh *
                  </label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="HS001"
                    className="w-full px-3 py-2 text-xs font-mono uppercase bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Giới tính
                  </label>
                  <select
                    value={formGender}
                    onChange={(e: any) => setFormGender(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Họ và tên *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn An"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ngày sinh (DD/MM/YYYY) *
                  </label>
                  <input
                    type="text"
                    value={formDob}
                    onChange={(e) => setFormDob(e.target.value)}
                    placeholder="15/02/2008"
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Số điện thoại liên hệ
                  </label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="0912345678"
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-500 pt-1">
                * Học sinh mới được cấp tài khoản với mật khẩu ban đầu là ngày sinh dạng DDMMYYYY.
              </p>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang lưu...' : 'Lưu Thông Tin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EXCEL IMPORT PRE-FLIGHT ================= */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Nhập Danh Sách Học Sinh Từ File Excel (.xlsx)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Kiểm tra dữ liệu thiếu, mã trùng và định dạng ngày sinh trước khi xác nhận
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              {/* File upload drag drop input */}
              <div className="border-2 border-dashed border-slate-200 hover:border-sky-400 rounded-xl p-6 text-center transition-colors bg-slate-50/50">
                <input
                  type="file"
                  id="excelFileInput"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="excelFileInput"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                >
                  <FileSpreadsheet className="w-10 h-10 text-emerald-500" />
                  <span className="text-xs font-semibold text-slate-700">
                    {excelFile ? excelFile.name : 'Nhấn để chọn file Excel (.xlsx)'}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Hỗ trợ file .xlsx với các cột: STT, Mã HS, Họ tên, Giới tính, Ngày sinh, SĐT
                  </span>
                </label>
              </div>

              {isParsingExcel && (
                <div className="py-4 text-center text-xs text-sky-600 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Đang phân tích dữ liệu file...
                </div>
              )}

              {/* Errors report */}
              {importErrors.length > 0 && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-800">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Phát hiện {importErrors.length} dòng có lỗi cần sửa:</span>
                  </div>
                  <ul className="text-xs text-rose-700 list-disc list-inside space-y-1 max-h-32 overflow-y-auto">
                    {importErrors.map((err, i) => (
                      <li key={i}>
                        Dòng {err.rowNumber}: {err.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Parsed Rows Preview */}
              {parsedRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">
                      Bản xem trước dữ liệu hợp lệ ({parsedRows.length} học sinh)
                    </span>
                    <span className="text-emerald-700 font-medium">Sẵn sàng nhập</span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-600 font-semibold">
                        <tr>
                          <th className="py-2 px-3">Mã HS</th>
                          <th className="py-2 px-3">Họ và Tên</th>
                          <th className="py-2 px-3">Giới tính</th>
                          <th className="py-2 px-3">Ngày sinh</th>
                          <th className="py-2 px-3">Số điện thoại</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono font-bold text-sky-800">
                              {row.studentCode}
                            </td>
                            <td className="py-2 px-3 font-medium text-slate-800">
                              {row.fullName}
                            </td>
                            <td className="py-2 px-3">{row.gender}</td>
                            <td className="py-2 px-3 font-mono">{row.dob}</td>
                            <td className="py-2 px-3 font-mono">{row.phone || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50">
              <button
                type="button"
                onClick={downloadStudentTemplate}
                className="text-xs font-semibold text-sky-700 hover:text-sky-800 flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                Tải lại file mẫu
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-xl"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  disabled={parsedRows.length === 0 || isCommittingImport}
                  onClick={handleCommitImport}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isCommittingImport ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Đang nhập dữ liệu...
                    </>
                  ) : (
                    `Xác Nhận Nhập (${parsedRows.length} HS)`
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
