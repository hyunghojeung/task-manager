-- 개인메모 카테고리 — 메모 하나에 하나, 목록 거르기용.
-- 태그(여러 개, 검색용)와는 별개다.
-- 실행: Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS hub_memo_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hub_memo_categories_user_idx
  ON hub_memo_categories (user_id, sort_order, created_at);

ALTER TABLE hub_memo_categories ENABLE ROW LEVEL SECURITY;

-- 카테고리를 지우면 메모는 남고 미분류가 된다
ALTER TABLE hub_memos
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES hub_memo_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS hub_memos_category_idx
  ON hub_memos (user_id, category_id);
