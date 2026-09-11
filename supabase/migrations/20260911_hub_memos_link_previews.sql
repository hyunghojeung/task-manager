-- 개인메모 본문에 적은 URL 의 미리보기(제목·설명·대표이미지)를 저장한다.
-- 저장해 두면 공유받은 사람도 로그인 없이 같은 카드를 볼 수 있다.
-- 실행: Supabase SQL Editor에서 실행

ALTER TABLE hub_memos
  ADD COLUMN IF NOT EXISTS link_previews JSONB NOT NULL DEFAULT '[]'::jsonb;
