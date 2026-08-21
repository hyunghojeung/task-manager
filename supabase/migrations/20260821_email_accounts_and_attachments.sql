-- 이메일 계정 3슬롯 + 통장사본 3장 + 사업자등록증 3장 확장
-- 실행: Supabase SQL Editor에서 순서대로 실행

-- 1) companies 테이블 컬럼 추가
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS mail_service_2 VARCHAR(20),
  ADD COLUMN IF NOT EXISTS mail_email_2 VARCHAR(100),
  ADD COLUMN IF NOT EXISTS mail_id_2 VARCHAR(100),
  ADD COLUMN IF NOT EXISTS mail_password_2 VARCHAR(255),
  ADD COLUMN IF NOT EXISTS mail_service_3 VARCHAR(20),
  ADD COLUMN IF NOT EXISTS mail_email_3 VARCHAR(100),
  ADD COLUMN IF NOT EXISTS mail_id_3 VARCHAR(100),
  ADD COLUMN IF NOT EXISTS mail_password_3 VARCHAR(255),
  ADD COLUMN IF NOT EXISTS default_mail SMALLINT DEFAULT 1,

  -- 통장사본 3장 (URL + 라벨)
  ADD COLUMN IF NOT EXISTS bankbook_url_1 TEXT,
  ADD COLUMN IF NOT EXISTS bankbook_url_2 TEXT,
  ADD COLUMN IF NOT EXISTS bankbook_url_3 TEXT,
  ADD COLUMN IF NOT EXISTS bankbook_label_1 VARCHAR(60),
  ADD COLUMN IF NOT EXISTS bankbook_label_2 VARCHAR(60),
  ADD COLUMN IF NOT EXISTS bankbook_label_3 VARCHAR(60),

  -- 사업자등록증 3장 (URL + 라벨)
  ADD COLUMN IF NOT EXISTS biz_reg_url_1 TEXT,
  ADD COLUMN IF NOT EXISTS biz_reg_url_2 TEXT,
  ADD COLUMN IF NOT EXISTS biz_reg_url_3 TEXT,
  ADD COLUMN IF NOT EXISTS biz_reg_label_1 VARCHAR(60),
  ADD COLUMN IF NOT EXISTS biz_reg_label_2 VARCHAR(60),
  ADD COLUMN IF NOT EXISTS biz_reg_label_3 VARCHAR(60);

-- 2) Storage 버킷 생성 (Supabase Storage)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-docs',
  'company-docs',
  false,
  20971520, -- 20MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];

-- 3) Storage RLS 정책 (Service Role 우회 방식이지만, 안전을 위해 기본 정책 명시)
-- 인증된 사용자는 자기 회사 폴더의 파일만 읽기/쓰기 가능
-- 실제 인증은 API 라우트의 세션 검증에서 하고, Storage는 Service Role로 접근

-- 익명 접근 차단
DROP POLICY IF EXISTS "company-docs-anon-deny" ON storage.objects;
CREATE POLICY "company-docs-anon-deny" ON storage.objects
  FOR ALL TO anon USING (bucket_id != 'company-docs') WITH CHECK (bucket_id != 'company-docs');
