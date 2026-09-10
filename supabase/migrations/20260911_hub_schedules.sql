-- 업무관리 · 개인 일정
-- 시간 개념 없이 날짜별로 제목·내용·색상 항목을 적어둔다.
-- 실행: Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS hub_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  on_date DATE NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  color VARCHAR(20) NOT NULL DEFAULT 'yellow',
  done BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hub_schedules_user_date_idx
  ON hub_schedules (user_id, on_date);

ALTER TABLE hub_schedules ENABLE ROW LEVEL SECURITY;

-- 공휴일 (연 1회 갱신)
CREATE TABLE IF NOT EXISTS hub_holidays (
  on_date DATE PRIMARY KEY,
  name VARCHAR(50) NOT NULL
);

ALTER TABLE hub_holidays ENABLE ROW LEVEL SECURITY;

INSERT INTO hub_holidays (on_date, name) VALUES
  ('2026-01-01','신정'),
  ('2026-02-16','설날 연휴'), ('2026-02-17','설날'), ('2026-02-18','설날 연휴'),
  ('2026-03-01','삼일절'), ('2026-03-02','대체공휴일'),
  ('2026-05-05','어린이날'),
  ('2026-05-24','부처님오신날'), ('2026-05-25','대체공휴일'),
  ('2026-06-06','현충일'),
  ('2026-08-15','광복절'), ('2026-08-17','대체공휴일'),
  ('2026-09-24','추석 연휴'), ('2026-09-25','추석'), ('2026-09-26','추석 연휴'),
  ('2026-10-03','개천절'), ('2026-10-05','대체공휴일'),
  ('2026-10-09','한글날'),
  ('2026-12-25','성탄절')
ON CONFLICT (on_date) DO NOTHING;
