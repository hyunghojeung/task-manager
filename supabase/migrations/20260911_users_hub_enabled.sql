-- 업무관리(개인 일정·갤러리·개인메모) 사용 권한
-- 관리자가 사용자관리 화면에서 사람별로 켜고 끈다. 기본값은 꺼짐.
-- 실행: Supabase SQL Editor에서 실행

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS hub_enabled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.hub_enabled IS '업무관리 기능 사용 권한 (관리자가 지정)';
