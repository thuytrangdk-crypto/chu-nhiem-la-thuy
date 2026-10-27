import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://sohuavueougdlsqerwuk.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_2BcotajR597WKnTP9G0wrg_N8oBj1PM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const SUPABASE_SQL_SCHEMA = `-- ====================================================================
-- MÃ SQL BẢO MẬT VÀ TỐI ƯU CƠ SỞ DỮ LIỆU GVCN TRÊN SUPABASE
-- Dán đoạn mã này vào mục "SQL Editor" trên Supabase và bấm RUN khi đã cấu hình SUPABASE_SERVICE_ROLE_KEY
-- ====================================================================

-- 1. Bật Row Level Security (RLS) để kiểm soát quyền truy cập
ALTER TABLE public.gvcn_store ENABLE ROW LEVEL SECURITY;

-- 2. GỠ BỎ TẤT CẢ CHÍNH SÁCH CÔNG KHAI CỦA KHÓA ANON
-- Không cho phép khóa anon bên ngoài đọc hoặc ghi trực tiếp dữ liệu học sinh
DROP POLICY IF EXISTS "Cho phép ứng dụng GVCN đọc dữ liệu" ON public.gvcn_store;
DROP POLICY IF EXISTS "Cho phép ứng dụng GVCN cập nhật dữ liệu" ON public.gvcn_store;
DROP POLICY IF EXISTS "gvcn_store_allow_read" ON public.gvcn_store;
DROP POLICY IF EXISTS "gvcn_store_restrict_write_to_backend" ON public.gvcn_store;

-- 3. CHỈ CẤP QUYỀN TRUY CẬP (ĐỌC & GHI) CHO MÁY CHỦ BACKEND QUA SERVICE_ROLE
-- Mọi truy cập của giáo viên và học sinh đều phải qua Express API (/api/*)
-- để được xác thực JWT, phân quyền và lọc bỏ các trường nhạy cảm.
CREATE POLICY "gvcn_store_backend_only"
ON public.gvcn_store
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 4. BỔ SUNG CỘT VERSION VÀ CHỈ MỤC TỐI ƯU ĐỒNG BỘ
ALTER TABLE public.gvcn_store ADD COLUMN IF NOT EXISTS version BIGINT DEFAULT 1 NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gvcn_store_updated ON public.gvcn_store (updated_at DESC);
`;
