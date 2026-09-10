-- 업무관리 · 개인메모
-- 기존 memos(업무용메모)와는 별개인 나만 보는 메모.
-- 본문에 적은 #태그를 뽑아 tags 에 저장하고, 첨부 사진도 같은 태그를 물려받는다.
-- 실행: Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS hub_memos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  share_token VARCHAR(32) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hub_memos_user_idx
  ON hub_memos (user_id, pinned DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS hub_memos_tags_idx
  ON hub_memos USING GIN (tags);

ALTER TABLE hub_memos ENABLE ROW LEVEL SECURITY;

-- 사진: 갤러리에 올린 것과 메모에 붙인 것을 한 표에 둔다.
-- 한 번의 태그 검색으로 둘 다 찾기 위해서다. (앨범은 5단계에서 추가)
CREATE TABLE IF NOT EXISTS hub_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  memo_id UUID REFERENCES hub_memos(id) ON DELETE CASCADE,
  album_id UUID,
  url TEXT NOT NULL,
  file_name VARCHAR(255),
  file_size BIGINT,
  caption TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hub_photos_user_idx
  ON hub_photos (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS hub_photos_memo_idx
  ON hub_photos (memo_id);
CREATE INDEX IF NOT EXISTS hub_photos_tags_idx
  ON hub_photos USING GIN (tags);

ALTER TABLE hub_photos ENABLE ROW LEVEL SECURITY;
