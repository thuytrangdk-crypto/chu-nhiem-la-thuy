import React, { useState } from 'react';
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
  ArrowRightLeft
} from 'lucide-react';
import { AppData, UserRole, Announcement, HonorItem } from '../types';
import { apiRequest } from '../utils/api';

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

  // ---------------- TAB 4 HANDLERS (ĐĂNG THÔNG TIN MỚI) ----------------
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setPostError(null);
    setPostSuccess(null);
    setIsPosting(true);

    try {
      await apiRequest('/api/announcements', {
        method: 'POST',
        body: {
          title: newTitle,
          content: newContent,
          category: newCategory,
          imageUrl: newImageUrl,
          isPinned: newIsPinned,
        },
      });
      await onRefreshData();
      setPostSuccess('Đã đăng thông báo thành công!');
      setNewTitle('');
      setNewContent('');
      setNewImageUrl('');
      setNewIsPinned(false);
      setTimeout(() => {
        setActiveTab(0); // switch to announcements tab
        setPostSuccess(null);
      }, 1200);
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
                      <div className="my-3 rounded-xl overflow-hidden border border-slate-100 max-h-48 bg-slate-50 flex items-center justify-center">
                        <img
                          src={ann.imageUrl}
                          alt={ann.title}
                          className="object-cover w-full h-full"
                          referrerPolicy="no-referrer"
                        />
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
            <div className="max-w-xl mx-auto mb-8 space-y-3">
              {/* Blackboard */}
              <div className="h-10 bg-slate-800 rounded-xl flex items-center justify-center text-white text-xs font-bold tracking-widest shadow-md border-2 border-slate-700 uppercase">
                BẢNG LỚP HỌC
              </div>

              {/* Teacher Desk */}
              <div className="flex justify-end pr-4">
                <div className="w-36 h-10 bg-amber-100 border-2 border-amber-300 rounded-lg flex items-center justify-center text-[11px] font-bold text-amber-900 shadow-xs">
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
                          <div className="text-[10px] font-bold text-slate-600 mb-1 flex items-center justify-between">
                            <span>Bàn {deskNum}</span>
                            <span className="text-[9px] text-slate-600">2 chỗ</span>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5">
                            {/* Seat 1 */}
                            <div
                              draggable={role === 'teacher'}
                              onDragStart={(e) => handleDragStart(e, seat1Key)}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, seat1Key)}
                              onClick={() => handleSeatClick(seat1Key)}
                              className={`p-2 rounded-lg text-center transition-all min-h-[46px] flex flex-col justify-center cursor-pointer ${
                                selectedSeatForSwap === seat1Key
                                  ? 'bg-sky-200 border-2 border-sky-600 shadow-md ring-2 ring-sky-300'
                                  : isMatch1
                                  ? 'bg-amber-100 border-2 border-amber-500'
                                  : st1
                                  ? 'bg-white border border-slate-200 hover:border-sky-300 shadow-xs'
                                  : 'bg-slate-100/60 border border-dashed border-slate-300 hover:bg-slate-200/50'
                              }`}
                            >
                              {st1 ? (
                                <>
                                  <span className="text-[11px] font-bold text-slate-800 truncate block">
                                    {st1.fullName}
                                  </span>
                                  <span className="text-[9px] font-mono text-slate-600 block">
                                    {st1.studentCode}
                                  </span>
                                </>
                              ) : (
                                <span className="text-[10px] text-slate-600 italic">Trống</span>
                              )}
                            </div>

                            {/* Seat 2 */}
                            <div
                              draggable={role === 'teacher'}
                              onDragStart={(e) => handleDragStart(e, seat2Key)}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, seat2Key)}
                              onClick={() => handleSeatClick(seat2Key)}
                              className={`p-2 rounded-lg text-center transition-all min-h-[46px] flex flex-col justify-center cursor-pointer ${
                                selectedSeatForSwap === seat2Key
                                  ? 'bg-sky-200 border-2 border-sky-600 shadow-md ring-2 ring-sky-300'
                                  : isMatch2
                                  ? 'bg-amber-100 border-2 border-amber-500'
                                  : st2
                                  ? 'bg-white border border-slate-200 hover:border-sky-300 shadow-xs'
                                  : 'bg-slate-100/60 border border-dashed border-slate-300 hover:bg-slate-200/50'
                              }`}
                            >
                              {st2 ? (
                                <>
                                  <span className="text-[11px] font-bold text-slate-800 truncate block">
                                    {st2.fullName}
                                  </span>
                                  <span className="text-[9px] font-mono text-slate-600 block">
                                    {st2.studentCode}
                                  </span>
                                </>
                              ) : (
                                <span className="text-[10px] text-slate-600 italic">Trống</span>
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

      {/* ================= TAB 4: ĐĂNG THÔNG TIN MỚI (Teacher only) ================= */}
      {activeTab === 3 && role === 'teacher' && (
        <div className="max-w-2xl mx-auto bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-800">Đăng Thông Báo & Tin Tức Mới</h3>
            <p className="text-xs text-slate-500">
              Thông tin sau khi đăng sẽ tự động xuất hiện tại Bảng tin lớp cho học sinh và phụ huynh xem
            </p>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Phân loại thông tin
                </label>
                <select
                  value={newCategory}
                  onChange={(e: any) => setNewCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                >
                  <option value="Thông báo chung">Thông báo chung</option>
                  <option value="Học tập">Học tập</option>
                  <option value="Hoạt động">Hoạt động ngoại khóa</option>
                  <option value="Nhắc nhở">Nhắc nhở nề nếp</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Hình ảnh đính kèm (URL tùy chọn)
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                  <ImageIcon className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                </div>
              </div>
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
                onClick={() => setActiveTab(0)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isPosting}
                className="px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isPosting ? 'Đang đăng...' : 'Đăng Thông Tin'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
