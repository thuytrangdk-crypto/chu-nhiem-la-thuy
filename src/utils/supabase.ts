import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://sohuavueougdlsqerwuk.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_2BcotajR597WKnTP9G0wrg_N8oBj1PM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const SUPABASE_SQL_SCHEMA = `-- =======================================================
-- MÃ SQL KHỞI TẠO CƠ SỞ DỮ LIỆU GVCN TRÊN SUPABASE
-- Dán đoạn mã này vào mục "SQL Editor" trên Supabase và bấm RUN
-- =======================================================

-- 1. Tạo bảng lưu trữ toàn diện GVCN (gvcn_store)
CREATE TABLE IF NOT EXISTS public.gvcn_store (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Bật Row Level Security (RLS) để bảo vệ dữ liệu
ALTER TABLE public.gvcn_store ENABLE ROW LEVEL SECURITY;

-- 3. Tạo chính sách cho phép đọc và ghi đối với ứng dụng GVCN
CREATE POLICY "Cho phép ứng dụng GVCN đọc dữ liệu"
ON public.gvcn_store
FOR SELECT
USING (true);

CREATE POLICY "Cho phép ứng dụng GVCN cập nhật dữ liệu"
ON public.gvcn_store
FOR ALL
USING (true)
WITH CHECK (true);

-- 4. Tạo chỉ mục JSONB để tăng tốc độ truy vấn
CREATE INDEX IF NOT EXISTS idx_gvcn_store_updated ON public.gvcn_store (updated_at DESC);
`;
