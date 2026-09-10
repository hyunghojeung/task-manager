-- 업무관리 · 갤러리 앨범
-- 사진은 hub_photos 에 이미 있고, 앨범에 속하거나 메모에 속한다.
-- 실행: Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS hub_albums (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hub_albums_user_idx
  ON hub_albums (user_id, created_at DESC);

ALTER TABLE hub_albums ENABLE ROW LEVEL SECURITY;

-- 앨범을 지우면 사진은 남기고 소속만 푼다 (전체 보기에서는 계속 보인다)
ALTER TABLE hub_photos
  DROP CONSTRAINT IF EXISTS hub_photos_album_fk;
ALTER TABLE hub_photos
  ADD CONSTRAINT hub_photos_album_fk
  FOREIGN KEY (album_id) REFERENCES hub_albums(id) ON DELETE SET NULL;
