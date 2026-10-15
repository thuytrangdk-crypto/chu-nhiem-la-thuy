import React, { useState, useRef } from 'react';
import {
  Newspaper,
  LayoutGrid,
  Award,
  PlusCircle,
  Pin,
  Trash2,
  Edit2,
  Search,
  Save,
  RotateCcw,
  Printer,
  CheckCircle,
  AlertCircle,
  Image as ImageIcon,
  Sparkles,
  ArrowRightLeft,
  Upload,
  X,
  Maximize2,
  RefreshCw,
  Link2
} from 'lucide-react';
import { AppData, UserRole, Announcement, HonorItem } from '../types';
import { apiRequest } from '../utils/api';

// Client-side image compression and conversion to Base64 data URL
function processSelectedImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('Tệp không phải là hình ảnh. Vui lòng chọn tệp .jpg, .png, .webp...'));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc tệp hình ảnh'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Hình ảnh bị lỗi hoặc không hỗ trợ định dạng này'));
      img.onload = () => {
        const maxDim = 1200;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(reader.result as string);
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Compress as JPEG 0.82 to keep file size lightweight and crisp
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

interface BoardAndSeatingViewProps {
  data: AppData;
  role: UserRole;
  initialTab?: number;
  onRefreshData: () => Promise<void>;
}

export const BoardAndSeatingView: React.FC<BoardAndSeatingViewProps> = ({
  data,
  role,
  initialTab = 0,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<number>(initialTab);

  // --- TAB 1: BẢNG TIN STATE ---
  const [editingAnn, setEditingAnn] = useState<Announcement | null>(null);
  const [annCategoryFilter, setAnnCategoryFilter] = useState<string>('all');
  const [previewFullImageUrl, setPreviewFullImageUrl] = useState<string | null>(null);

  // --- TAB 2: SƠ ĐỒ LỚP STATE ---
  // Local copy of seating chart for editing & drag/swap
  const [seats, setSeats] = useState<Record<string, string | null>>(() => {
    return { ...data.seatingChart.seats };
  });
  const [selectedSeatForSwap, setSelectedSeatForSwap] = useState<string | null>(null);
  const [seatingSearchQuery, setSeatingSearchQuery] = useState('');
  const [isSavingSeating, setIsSavingSeating] = useState(false);
  const [seatingSuccessMsg, setSeatingSuccessMsg] = useState<string | null>(null);

  // --- TAB 3: VINH DANH STATE ---
  const [isAddingHonor, setIsAddingHonor] = useState(false);
  const [newHonorStudentId, setNewHonorStudentId] = useState(data.students[0]?.id || '');
  const [newHonorTitle, setNewHonorTitle] = useState('Học sinh xuất sắc');
  const [newHonorAchievement, setNewHonorAchievement] = useState('');
  const [newHonorMonth, setNewHonorMonth] = useState(`Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`);

  // --- TAB 4: ĐĂNG THÔNG TIN MỚI STATE ---
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<'Thông báo chung' | 'Học tập' | 'Hoạt động' | 'Nhắc nhở'>('Thông báo chung');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newIsPinned, setNewIsPinned] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [postSuccess, setPostSuccess] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);

  // Image Upload & Selection State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [imageInputMode, setImageInputMode] = useState<'upload' | 'url'>('upload');
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  // Helper map studentId to student object
  const studentMap = React.useMemo(() => {
    const map = new Map<string, any>();
    data.students.forEach((s) => map.set(s.id, s));
    return map;
  }, [data.students]);

  // Tab definitions
  const tabs = [
    { id: 0, label: '1. BẢNG TIN THÔNG BÁO', icon: Newspaper },
    { id: 1, label: '2. SƠ ĐỒ LỚP HỌC', icon: LayoutGrid },
    { id: 2, label: '3. VINH DANH', icon: Award },
    ...(role === 'teacher' ? [{ id: 3, label: '4. ĐĂNG THÔNG TIN MỚI', icon: PlusCircle }] : []),
  ];

  // ---------------- TAB 1 HANDLERS (BẢNG TIN) ----------------
  const handleDeleteAnn = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa thông báo này?')) return;
    try {
      await apiRequest(`/api/announcements/${id}`, { method: 'DELETE' });
      await onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xóa thông báo');
    }
  };

  const handleTogglePin = async (ann: Announcement) => {
    try {
      await apiRequest('/api/announcements', {
        method: 'POST',
        body: {
          ...ann,
          isPinned: !ann.isPinned,
        },
      });
      await onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi ghim thông báo');
    }
  };

  const filteredAnnouncements = data.announcements.filter((ann) => {
    if (annCategoryFilter === 'all') return true;
    return ann.category === annCategoryFilter;
  });

  // ---------------- TAB 2 HANDLERS (SƠ ĐỒ LỚP) ----------------
  // Click seat handler for swap
  const handleSeatClick = (seatKey: string) => {
    if (role !== 'teacher') return;

    if (!selectedSeatForSwap) {
      // First select
      setSelectedSeatForSwap(seatKey);
    } else if (selectedSeatForSwap === seatKey) {
      // Deselect
      setSelectedSeatForSwap(null);
    } else {
      // Swap seat contents
      setSeats((prev) => {
        const next = { ...prev };
        const temp = next[selectedSeatForSwap];
        next[selectedSeatForSwap] = next[seatKey];
        next[seatKey] = temp;
        return next;
      });
      setSelectedSeatForSwap(null);
    }
  };

  const handleDragStart = (e: React.DragEvent, seatKey: string) => {
    if (role !== 'teacher') return;
    e.dataTransfer.setData('text/plain', seatKey);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetSeatKey: string) => {
    if (role !== 'teacher') return;
    e.preventDefault();
    const sourceSeatKey = e.dataTransfer.getData('text/plain');
    if (!sourceSeatKey || sourceSeatKey === targetSeatKey) return;

    setSeats((prev) => {
      const next = { ...prev };
      const temp = next[sourceSeatKey];
      next[sourceSeatKey] = next[targetSeatKey];
      next[targetSeatKey] = temp;
      return next;
    });
  };

  const handleSaveSeating = async () => {
    setIsSavingSeating(true);
    setSeatingSuccessMsg(null);
    try {
      await apiRequest('/api/seating', {
        method: 'POST',
        body: { seats },
      });
      await onRefreshData();
      setSeatingSuccessMsg('Đã lưu sơ đồ lớp học thành công!');
      setTimeout(() => setSeatingSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu sơ đồ');
    } finally {
      setIsSavingSeating(false);
    }
  };

  const handleResetSeating = () => {
    if (!confirm('Đặt lại sơ đồ theo vị trí ban đầu của danh sách lớp?')) return;
    const initialSeats: Record<string, string | null> = {};
    for (let r = 1; r <= 4; r++) {
      for (let d = 1; d <= 7; d++) {
        for (let s = 1; s <= 2; s++) {
          initialSeats[`R${r}-D${d}-S${s}`] = null;
        }
      }
    }
    data.students.forEach((st, idx) => {
      if (idx < 56) {
        const row = (idx % 4) + 1;
        const desk = Math.floor(idx / 8) + 1;
        const seat = (Math.floor(idx / 4) % 2) + 1;
        initialSeats[`R${row}-D${desk}-S${seat}`] = st.id;
      }
    });
    setSeats(initialSeats);
  };

  const handlePrintSeating = () => {
    window.print();
  };

  // ---------------- TAB 3 HANDLERS (VINH DANH) ----------------
  const handleAddHonor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHonorStudentId || !newHonorAchievement) return;

    const st = studentMap.get(newHonorStudentId);
    try {
      await apiRequest('/api/honors', {
        method: 'POST',
        body: {
          studentId: newHonorStudentId,
          studentName: st?.fullName,
          title: newHonorTitle,
          achievement: newHonorAchievement,
          month: newHonorMonth,
          confirmed: true,
        },
      });
      await onRefreshData();
      setIsAddingHonor(false);
      setNewHonorAchievement('');
    } catch (err: any) {
      alert(err.message || 'Lỗi khi thêm danh hiệu');
    }
  };

  const handleDeleteHonor = async (id: string) => {
    if (!confirm('Xóa danh hiệu vinh danh này?')) return;
    try {
      await apiRequest(`/api/honors/${id}`, { method: 'DELETE' });
      await onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xóa vinh danh');
    }
  };

  // ---------------- TAB 4 HANDLERS (ĐĂNG & SỬA THÔNG TIN) ----------------
  const processAndSetImage = async (file: File) => {
    setIsProcessingImage(true);
    setPostError(null);
    try {
      const dataUrl = await processSelectedImage(file);
      setNewImageUrl(dataUrl);
    } catch (err: any) {
      setPostError(err.message || 'Lỗi khi xử lý file ảnh');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processAndSetImage(file);
      // Reset input value so same file can be selected again if needed
      e.target.value = '';
    }
  };

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processAndSetImage(file);
    }
  };

  const handlePasteImage = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          processAndSetImage(file);
          setImageInputMode('upload');
          break;
        }
      }
    }
  };

  const handleEditAnn = (ann: Announcement) => {
    setEditingAnn(ann);
    setNewTitle(ann.title);
    setNewContent(ann.content);
    setNewCategory(ann.category);
    setNewImageUrl(ann.imageUrl || '');
    setNewIsPinned(ann.isPinned);
    setPostError(null);
    setPostSuccess(null);
    setActiveTab(3); // Switch to form tab
  };

  const handleCancelEdit = () => {
    setEditingAnn(null);
    setNewTitle('');
    setNewContent('');
    setNewImageUrl('');
    setNewIsPinned(false);
    setPostError(null);
    setPostSuccess(null);
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setPostError(null);
    setPostSuccess(null);
    setIsPosting(true);

    try {
      await apiRequest('/api/announcements', {
        method: 'POST',
        body: {
          id: editingAnn ? editingAnn.id : undefined,
          title: newTitle,
          content: newContent,
          category: newCategory,
          imageUrl: newImageUrl,
          isPinned: newIsPinned,
        },
      });
      await onRefreshData();
      setPostSuccess(editingAnn ? 'Đã cập nhật thông báo thành công!' : 'Đã đăng thông báo thành công!');
      setNewTitle('');
      setNewContent('');
      setNewImageUrl('');
      setNewIsPinned(false);
      setEditingAnn(null);
      setTimeout(() => {
        setActiveTab(0); // switch to announcements tab
        setPostSuccess(null);
      }, 1000);
    } catch (err: any) {
      setPostError(err.message || 'Không thể đăng thông báo');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 4 Tabs Bar */}
      <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-xs overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[150px] py-2.5 px-3 rounded-xl text-xs font-semibold tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-sky-50 text-sky-800 shadow-xs border border-sky-200/70'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon
                className={`w-4 h-4 ${isActive ? 'text-sky-600' : 'text-slate-400'}`}
              />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ================= TAB 1: BẢNG TIN THÔNG BÁO ================= */}
      {activeTab === 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            {/* Category filter */}
            <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl">
              {['all', 'Thông báo chung', 'Học tập', 'Hoạt động', 'Nhắc nhở'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setAnnCategoryFilter(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                    annCategoryFilter === cat
                      ? 'bg-sky-100 text-sky-800'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat === 'all' ? 'Tất cả danh mục' : cat}
                </button>
              ))}
            </div>

            {role === 'teacher' && (
              <button
                onClick={() => setActiveTab(3)}
                className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <PlusCircle className="w-4 h-4" />
                Đăng Thông Báo Mới
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAnnouncements.length === 0 ? (
              <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-200/80">
                <Newspaper className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">Chưa có thông báo nào trong danh mục này</p>
              </div>
            ) : (
              filteredAnnouncements.map((ann) => (
                <div
                  key={ann.id}
                  className={`bg-white rounded-2xl border p-5 shadow-xs transition-all relative flex flex-col justify-between ${
                    ann.isPinned
                      ? 'border-amber-200 bg-amber-50/20 shadow-amber-900/5'
                      : 'border-slate-200/80'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        {ann.isPinned && (
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                            <Pin className="w-3 h-3 fill-amber-500" />
                            Đã ghim
                          </div>
                        )}
                        <span className="text-[11px] font-medium text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100">
                          {ann.category}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-600 font-mono shrink-0">
                        {ann.date}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-800 leading-snug mb-2">
                      {ann.title}
                    </h3>

                    {ann.imageUrl && (
                      <div
                        onClick={() => setPreviewFullImageUrl(ann.imageUrl || null)}
                        className="my-3 rounded-xl overflow-hidden border border-slate-200/80 max-h-56 bg-slate-50 flex items-center justify-center cursor-pointer group relative"
                        title="Nhấn để xem ảnh phóng to"
                      >
                        <img
                          src={ann.imageUrl}
                          alt={ann.title}
                          className="object-cover w-full h-full group-hover:scale-102 transition-transform duration-200"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5 backdrop-blur-[1px]">
                          <Maximize2 className="w-4 h-4" />
                          <span>Xem ảnh lớn</span>
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">
                      {ann.content}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-medium text-slate-500">
                      Người đăng: <strong className="text-slate-700">{ann.author}</strong>
                    </span>

                    {role === 'teacher' && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditAnn(ann)}
                          title="Chỉnh sửa thông báo & hình ảnh"
                          className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleTogglePin(ann)}
                          title={ann.isPinned ? 'Bỏ ghim' : 'Ghim thông báo'}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            ann.isPinned
                              ? 'text-amber-600 hover:bg-amber-100'
                              : 'text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteAnn(ann.id)}
                          title="Xóa thông báo"
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 2: SƠ ĐỒ LỚP HỌC ================= */}
      {activeTab === 1 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Sơ Đồ Bố Trí Chỗ Ngồi Lớp {data.settings.className}
              </h3>
              <p className="text-xs text-slate-500">
                Bố trí 4 dãy bàn học · Mỗi dãy 7 bàn · Mỗi bàn 2 chỗ (Tổng cộng 56 vị trí ngồi)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Search student on seating chart */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Tìm học sinh trên sơ đồ..."
                  value={seatingSearchQuery}
                  onChange={(e) => setSeatingSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 w-48"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>

              {role === 'teacher' && (
                <>
                  <button
                    onClick={handleResetSeating}
                    title="Đặt lại sơ đồ"
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Đặt lại
                  </button>
                  <button
                    onClick={handleSaveSeating}
                    disabled={isSavingSeating}
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {isSavingSeating ? 'Đang lưu...' : 'Lưu Sơ Đồ'}
                  </button>
                </>
              )}

              <button
                onClick={handlePrintSeating}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                In Sơ Đồ
              </button>
            </div>
          </div>

          {seatingSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-700">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{seatingSuccessMsg}</span>
            </div>
          )}

          {role === 'teacher' && (
            <div className="p-3 bg-sky-50/70 border border-sky-100 rounded-xl text-xs text-sky-800 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-sky-600 shrink-0" />
              <span>
                <strong>Mẹo thao tác:</strong> Giáo viên có thể kéo thả học sinh hoặc click vào một chỗ ngồi, sau đó click vào chỗ ngồi thứ hai để hoán đổi vị trí hai em.
              </span>
            </div>
          )}

          {/* VISUAL SEATING CHART (TOP-DOWN VIEW) */}
          <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50/50 print:border-none print:p-0">
            {/* 1. BLACKBOARD & TEACHER DESK AT TOP */}
            <div className="max-w-xl mx-auto mb-6 space-y-3">
              {/* Blackboard */}
              <div className="h-10 bg-slate-800 rounded-xl flex items-center justify-center text-white text-xs font-bold tracking-widest shadow-md border-2 border-slate-700 uppercase">
                BẢNG LỚP HỌC
              </div>

              {/* Teacher Desk & Color Legend */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-3 text-[11px] font-medium bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500 ring-1 ring-sky-300" />
                    <span className="text-sky-800 font-bold">Nam</span>
                  </div>
                  <span className="text-slate-300">|</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-400 ring-1 ring-rose-300" />
                    <span className="text-rose-700 font-bold">Nữ</span>
                  </div>
                  <span className="text-slate-300">|</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded border border-dashed border-slate-400 bg-slate-100" />
                    <span className="text-slate-500">Chỗ trống</span>
                  </div>
                </div>

                <div className="w-32 h-9 bg-amber-100 border-2 border-amber-300 rounded-lg flex items-center justify-center text-[11px] font-bold text-amber-900 shadow-xs">
                  BÀN GIÁO VIÊN
                </div>
              </div>
            </div>

            {/* 2. 4 COLUMNS (DÃY BÀN) WITH 7 DESKS EACH */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((colIndex) => (
                <div
                  key={colIndex}
                  className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs space-y-3"
                >
                  <div className="text-center pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-sky-800 uppercase tracking-wide">
                      DÃY {colIndex}
                    </span>
                  </div>

                  {/* 7 Desks in this column */}
                  <div className="space-y-2.5">
                    {Array.from({ length: 7 }, (_, dIndex) => {
                      const deskNum = dIndex + 1;
                      const seat1Key = `R${colIndex}-D${deskNum}-S1`;
                      const seat2Key = `R${colIndex}-D${deskNum}-S2`;
                      const st1Id = seats[seat1Key];
                      const st2Id = seats[seat2Key];
                      const st1 = st1Id ? studentMap.get(st1Id) : null;
                      const st2 = st2Id ? studentMap.get(st2Id) : null;

                      const isMatch1 =
                        seatingSearchQuery &&
                        st1 &&
                        st1.fullName.toLowerCase().includes(seatingSearchQuery.toLowerCase());
                      const isMatch2 =
                        seatingSearchQuery &&
                        st2 &&
                        st2.fullName.toLowerCase().includes(seatingSearchQuery.toLowerCase());

                      return (
                        <div
                          key={deskNum}
                          className="bg-slate-50/80 p-2 rounded-xl border border-slate-200/70"
                        >
                          <div className="text-[10px] font-bold text-slate-600 mb-1.5 flex items-center justify-between px-0.5">
                            <span className="font-semibold text-slate-700">Bàn {deskNum}</span>
                            <span className="text-[9px] text-slate-600 font-medium">2 chỗ ngồi</span>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5">
                            {/* Seat 1 */}
                            <div
                              draggable={role === 'teacher'}
                              onDragStart={(e) => handleDragStart(e, seat1Key)}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, seat1Key)}
                              onClick={() => handleSeatClick(seat1Key)}
                              className={`p-2 rounded-xl text-center transition-all min-h-[58px] flex flex-col items-center justify-center cursor-pointer select-none ${
                                selectedSeatForSwap === seat1Key
                                  ? 'bg-amber-100 border-2 border-amber-500 shadow-md ring-2 ring-amber-300 scale-[1.02]'
                                  : isMatch1
                                  ? 'bg-emerald-100 border-2 border-emerald-500 shadow-md ring-2 ring-emerald-300 scale-[1.02]'
                                  : st1
                                  ? st1.gender === 'Nữ'
                                    ? 'bg-rose-50/70 border border-rose-200 hover:border-rose-300 hover:bg-rose-50 shadow-2xs'
                                    : 'bg-sky-50/70 border border-sky-200 hover:border-sky-300 hover:bg-sky-50 shadow-2xs'
                                  : 'bg-slate-100/60 border border-dashed border-slate-300 hover:bg-slate-200/50'
                              }`}
                            >
                              {st1 ? (
                                <div className="w-full flex flex-col items-center justify-center text-center space-y-1">
                                  <div className="flex items-center justify-center gap-1 w-full px-0.5">
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                        st1.gender === 'Nữ' ? 'bg-rose-400' : 'bg-sky-500'
                                      }`}
                                      title={st1.gender}
                                    />
                                    <span
                                      title={st1.fullName}
                                      className={`text-[11.5px] font-bold leading-tight truncate text-center ${
                                        st1.gender === 'Nữ'
                                          ? 'text-rose-600'
                                          : 'text-sky-700'
                                      }`}
                                    >
                                      {st1.fullName}
                                    </span>
                                  </div>
                                  <span
                                    className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-md border text-center ${
                                      st1.gender === 'Nữ'
                                        ? 'bg-white/90 text-rose-600 border-rose-200/80'
                                        : 'bg-white/90 text-sky-700 border-sky-200/80'
                                    }`}
                                  >
                                    {st1.studentCode}
                                  </span>
                                </div>
                              ) : (
                                <div className="w-full flex flex-col items-center justify-center text-center py-1">
                                  <span className="text-[10px] font-medium text-slate-600 italic">Trống</span>
                                </div>
                              )}
                            </div>

                            {/* Seat 2 */}
                            <div
                              draggable={role === 'teacher'}
                              onDragStart={(e) => handleDragStart(e, seat2Key)}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, seat2Key)}
                              onClick={() => handleSeatClick(seat2Key)}
                              className={`p-2 rounded-xl text-center transition-all min-h-[58px] flex flex-col items-center justify-center cursor-pointer select-none ${
                                selectedSeatForSwap === seat2Key
                                  ? 'bg-amber-100 border-2 border-amber-500 shadow-md ring-2 ring-amber-300 scale-[1.02]'
                                  : isMatch2
                                  ? 'bg-emerald-100 border-2 border-emerald-500 shadow-md ring-2 ring-emerald-300 scale-[1.02]'
                                  : st2
                                  ? st2.gender === 'Nữ'
                                    ? 'bg-rose-50/70 border border-rose-200 hover:border-rose-300 hover:bg-rose-50 shadow-2xs'
                                    : 'bg-sky-50/70 border border-sky-200 hover:border-sky-300 hover:bg-sky-50 shadow-2xs'
                                  : 'bg-slate-100/60 border border-dashed border-slate-300 hover:bg-slate-200/50'
                              }`}
                            >
                              {st2 ? (
                                <div className="w-full flex flex-col items-center justify-center text-center space-y-1">
                                  <div className="flex items-center justify-center gap-1 w-full px-0.5">
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                        st2.gender === 'Nữ' ? 'bg-rose-400' : 'bg-sky-500'
                                      }`}
                                      title={st2.gender}
                                    />
                                    <span
                                      title={st2.fullName}
                                      className={`text-[11.5px] font-bold leading-tight truncate text-center ${
                                        st2.gender === 'Nữ'
                                          ? 'text-rose-600'
                                          : 'text-sky-700'
                                      }`}
                                    >
                                      {st2.fullName}
                                    </span>
                                  </div>
                                  <span
                                    className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-md border text-center ${
                                      st2.gender === 'Nữ'
                                        ? 'bg-white/90 text-rose-600 border-rose-200/80'
                                        : 'bg-white/90 text-sky-700 border-sky-200/80'
                                    }`}
                                  >
                                    {st2.studentCode}
                                  </span>
                                </div>
                              ) : (
                                <div className="w-full flex flex-col items-center justify-center text-center py-1">
                                  <span className="text-[10px] font-medium text-slate-600 italic">Trống</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: VINH DANH ================= */}
      {activeTab === 2 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Bảng Vàng Vinh Danh Học Sinh Xuất Sắc Lớp {data.settings.className}
              </h3>
              <p className="text-xs text-slate-500">
                Ghi nhận các gương sáng học tập, nỗ lực tiến bộ và hoạt động tích cực
              </p>
            </div>

            {role === 'teacher' && (
              <button
                onClick={() => setIsAddingHonor(!isAddingHonor)}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Sparkles className="w-4 h-4" />
                {isAddingHonor ? 'Đóng biểu mẫu' : 'Thêm Danh Hiệu Vinh Danh'}
              </button>
            )}
          </div>

          {/* Add Honor Form (Teacher only) */}
          {role === 'teacher' && isAddingHonor && (
            <form
              onSubmit={handleAddHonor}
              className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm space-y-4 animate-in fade-in"
            >
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                Tuyên Dương Học Sinh Mới
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Chọn học sinh
                  </label>
                  <select
                    value={newHonorStudentId}
                    onChange={(e) => setNewHonorStudentId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  >
                    {data.students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.studentCode} - {st.fullName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Danh hiệu
                  </label>
                  <select
                    value={newHonorTitle}
                    onChange={(e) => setNewHonorTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  >
                    <option value="Học sinh xuất sắc">Học sinh xuất sắc</option>
                    <option value="Học sinh tiến bộ">Học sinh tiến bộ</option>
                    <option value="Học sinh tích cực">Học sinh tích cực</option>
                    <option value="Học sinh có thành tích nổi bật">Học sinh có thành tích nổi bật</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tháng vinh danh
                  </label>
                  <input
                    type="text"
                    value={newHonorMonth}
                    onChange={(e) => setNewHonorMonth(e.target.value)}
                    placeholder="Ví dụ: Tháng 10/2025"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Thành tích cụ thể được ghi nhận
                </label>
                <textarea
                  rows={2}
                  value={newHonorAchievement}
                  onChange={(e) => setNewHonorAchievement(e.target.value)}
                  placeholder="Mô tả thành tích nổi bật (ví dụ: Đạt giải Nhất thi học sinh giỏi, giúp đỡ nhiều bạn nâng cao điểm số...)"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingHonor(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-xl cursor-pointer shadow-xs"
                >
                  Xác Nhận & Công Bố
                </button>
              </div>
            </form>
          )}

          {/* Honors Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {data.honors.length === 0 ? (
              <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-200/80">
                <Award className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">Chưa có danh hiệu vinh danh nào được công bố</p>
              </div>
            ) : (
              data.honors.map((hon) => (
                <div
                  key={hon.id}
                  className="bg-white rounded-2xl border border-amber-200/80 p-5 shadow-xs relative flex flex-col justify-between hover:border-amber-300 transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                        {hon.title}
                      </span>
                      <span className="text-[11px] font-mono text-slate-600">
                        {hon.month}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 my-2">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-base shadow-inner">
                        {hon.studentName.charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">
                          {hon.studentName}
                        </h4>
                        <span className="text-[11px] text-slate-500">
                          Gương sáng tiêu biểu
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 leading-relaxed italic">
                      "{hon.achievement}"
                    </p>
                  </div>

                  {role === 'teacher' && (
                    <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={() => handleDeleteHonor(hon.id)}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Xóa
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 4: ĐĂNG & SỬA THÔNG TIN (Teacher only) ================= */}
      {activeTab === 3 && role === 'teacher' && (
        <div
          onPaste={handlePasteImage}
          className="max-w-2xl mx-auto bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5"
        >
          <div className="pb-3 border-b border-slate-100 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-800">
                {editingAnn ? 'Chỉnh Sửa Thông Báo & Tin Tức' : 'Đăng Thông Báo & Tin Tức Mới'}
              </h3>
              <p className="text-xs text-slate-500">
                Thông tin sau khi lưu sẽ tự động xuất hiện tại Bảng tin lớp cho học sinh và phụ huynh xem
              </p>
            </div>
            {editingAnn && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer shrink-0"
              >
                Hủy chỉnh sửa
              </button>
            )}
          </div>

          {postSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-700">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{postSuccess}</span>
            </div>
          )}

          {postError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{postError}</span>
            </div>
          )}

          <form onSubmit={handleCreateAnnouncement} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tiêu đề thông báo *
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ví dụ: Kế hoạch thi giữa kỳ môn Toán và Vật lý"
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Phân loại thông tin *
              </label>
              <select
                value={newCategory}
                onChange={(e: any) => setNewCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer"
              >
                <option value="Thông báo chung">Thông báo chung</option>
                <option value="Học tập">Học tập</option>
                <option value="Hoạt động">Hoạt động ngoại khóa</option>
                <option value="Nhắc nhở">Nhắc nhở nề nếp</option>
              </select>
            </div>

            {/* Hình ảnh đính kèm (Chọn từ máy hoặc nhập URL) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  Hình ảnh đính kèm (Tùy chọn)
                </label>
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px]">
                  <button
                    type="button"
                    onClick={() => setImageInputMode('upload')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                      imageInputMode === 'upload'
                        ? 'bg-white text-sky-700 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tải từ máy / điện thoại
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageInputMode('url')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                      imageInputMode === 'url'
                        ? 'bg-white text-sky-700 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Nhập liên kết (URL)
                  </button>
                </div>
              </div>

              {imageInputMode === 'upload' ? (
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="hidden"
                  />

                  {newImageUrl ? (
                    <div className="relative border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-3 flex items-center gap-3">
                      <div className="w-20 h-20 rounded-lg overflow-hidden border border-slate-200 bg-white shrink-0 flex items-center justify-center shadow-xs">
                        <img
                          src={newImageUrl}
                          alt="Đính kèm"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 mb-0.5">
                          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Đã chọn ảnh thành công</span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Ảnh đã sẵn sàng đưa lên bảng tin cho học sinh xem
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-2.5 py-1 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors cursor-pointer border border-sky-200/60"
                          >
                            Đổi ảnh khác
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewImageUrl('')}
                            className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1 border border-rose-200/60"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Xóa ảnh
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleImageDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-sky-300 hover:border-sky-500 bg-sky-50/50 hover:bg-sky-50 rounded-xl p-5 text-center transition-all cursor-pointer group"
                    >
                      {isProcessingImage ? (
                        <div className="flex flex-col items-center justify-center py-2 space-y-2">
                          <RefreshCw className="w-6 h-6 text-sky-600 animate-spin" />
                          <span className="text-xs font-medium text-sky-700">Đang nén và xử lý hình ảnh...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center space-y-1.5">
                          <div className="w-11 h-11 rounded-full bg-white shadow-xs border border-sky-200 flex items-center justify-center text-sky-600 group-hover:scale-105 transition-transform">
                            <Upload className="w-5 h-5 text-sky-600" />
                          </div>
                          <span className="text-xs font-bold text-slate-800">
                            Nhấn để chọn ảnh từ máy hoặc kéo thả ảnh vào đây
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Hỗ trợ JPG, PNG, WEBP, GIF · Có thể chụp ảnh trực tiếp từ điện thoại hoặc dán ảnh (Ctrl+V)
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type="url"
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      placeholder="Dán đường dẫn ảnh: https://example.com/anh.jpg"
                      className="w-full pl-3.5 pr-9 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                    <ImageIcon className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  </div>
                  {newImageUrl && (
                    <div className="flex items-center gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                      <img
                        src={newImageUrl}
                        alt="Preview"
                        className="w-12 h-12 object-cover rounded-lg border border-slate-200 bg-white shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <span className="text-xs text-slate-600 truncate flex-1">{newImageUrl}</span>
                      <button
                        type="button"
                        onClick={() => setNewImageUrl('')}
                        className="text-xs text-rose-500 hover:text-rose-700 font-medium px-2 py-1 cursor-pointer"
                      >
                        Xóa
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nội dung chi tiết *
              </label>
              <textarea
                rows={5}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Nhập nội dung đầy đủ để thông báo đến lớp..."
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                required
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="pinNotice"
                checked={newIsPinned}
                onChange={(e) => setNewIsPinned(e.target.checked)}
                className="w-4 h-4 text-sky-600 rounded-md border-slate-300 focus:ring-sky-500 cursor-pointer"
              />
              <label htmlFor="pinNotice" className="text-xs font-medium text-slate-700 cursor-pointer">
                Ghim thông báo này lên đầu trang bảng tin
              </label>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  if (editingAnn) handleCancelEdit();
                  setActiveTab(0);
                }}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isPosting}
                className="px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isPosting
                  ? 'Đang lưu...'
                  : editingAnn
                  ? 'Lưu Thay Đổi'
                  : 'Đăng Thông Tin'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lightbox Image Preview Modal */}
      {previewFullImageUrl && (
        <div
          onClick={() => setPreviewFullImageUrl(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[92vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-slate-700"
          >
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-white">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <ImageIcon className="w-4 h-4 text-sky-400" />
                <span>Xem hình ảnh đầy đủ</span>
              </div>
              <button
                onClick={() => setPreviewFullImageUrl(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 overflow-auto max-h-[calc(92vh-50px)] flex items-center justify-center bg-slate-950">
              <img
                src={previewFullImageUrl}
                alt="Hình ảnh đầy đủ"
                className="max-h-[82vh] w-auto max-w-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
