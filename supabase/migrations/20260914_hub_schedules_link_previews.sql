-- 일정 내용에 적은 URL 의 미리보기(제목·설명·대표이미지) — 개인메모와 같은 방식
ALTER TABLE hub_schedules
  ADD COLUMN IF NOT EXISTS link_previews JSONB NOT NULL DEFAULT '[]'::jsonb;
