-- 쇼핑몰 연동 (blackcopy.co.kr → Bcount, 단방향)
-- 쇼핑몰이 주문을 보내면 작업으로 자동 등록한다. 기존 화면·컬럼은 그대로 두고 덧붙이기만 한다.
-- 실행: Supabase SQL Editor에서 실행

-- 1. 작업에 쇼핑몰 출처 표시
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS source VARCHAR(10) NOT NULL DEFAULT 'manual',   -- 'manual' | 'shop'
  ADD COLUMN IF NOT EXISTS external_order_id VARCHAR(100),                -- 쇼핑몰 주문번호
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;                           -- 쇼핑몰이 입금 확인을 보낸 시각

-- 같은 쇼핑몰 주문이 두 번 와도 한 건만 등록된다
CREATE UNIQUE INDEX IF NOT EXISTS orders_company_external_idx
  ON orders (company_id, external_order_id) WHERE external_order_id IS NOT NULL;

-- 2. 배송지 — 화면에는 나오지 않고 송장변환 "쇼핑몰 주문 불러오기"에서만 쓴다
CREATE TABLE IF NOT EXISTS shipments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  recipient VARCHAR(100),
  zip VARCHAR(10),
  address1 TEXT,
  address2 TEXT,
  mobile VARCHAR(20),
  tel VARCHAR(20),
  method VARCHAR(20),          -- 택배선불 | 택배착불 | 퀵(착불) | 직접수령
  memo TEXT,
  box_count INT DEFAULT 1,
  exported_at TIMESTAMPTZ,     -- 변환기에 넣은 시각. 있으면 "이미 내보낸 것"
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS shipments_order_idx ON shipments (order_id);
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

-- 3. 업체별 쇼핑몰 연동 설정 — 키는 해시로만 저장한다
CREATE TABLE IF NOT EXISTS company_integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  kind VARCHAR(20) NOT NULL DEFAULT 'shop',
  api_key_hash VARCHAR(64) NOT NULL,
  api_key_hint VARCHAR(12),            -- 앞 몇 글자만, 화면 표시용
  shop_url VARCHAR(255),
  category_name VARCHAR(50) DEFAULT '블랙카피',   -- 쇼핑몰 주문이 들어갈 카테고리
  template_name VARCHAR(100),          -- 품목 표양식 이름 (없으면 '단가계산없이…'를 찾아 쓴다)
  last_received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_id, kind)
);

CREATE INDEX IF NOT EXISTS company_integrations_key_idx ON company_integrations (api_key_hash);
ALTER TABLE company_integrations ENABLE ROW LEVEL SECURITY;

-- 4. 수신 로그 — 관리자 화면 "최근 수신"
CREATE TABLE IF NOT EXISTS shop_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  external_order_id VARCHAR(100),
  kind VARCHAR(20) NOT NULL,           -- order | paid | duplicate | error
  result TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shop_events_company_idx ON shop_events (company_id, created_at DESC);
ALTER TABLE shop_events ENABLE ROW LEVEL SECURITY;
