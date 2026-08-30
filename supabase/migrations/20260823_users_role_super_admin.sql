-- users.role CHECK 제약에 super_admin 추가
-- 실행: Supabase SQL Editor에서 실행

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'user', 'super_admin'));
