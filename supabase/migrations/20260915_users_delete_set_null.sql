-- 사용자 삭제가 막히던 문제
-- 그 사용자가 만든 작업·발주서·메모·작업전달이 있으면 외래키(NO ACTION) 때문에 지워지지 않았다.
-- 사용자를 지워도 기록은 남기고 작성자만 비운다(화면에는 "-"로 표시).
-- 실행: Supabase SQL Editor에서 실행

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_created_by_fkey;
ALTER TABLE orders ADD CONSTRAINT orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_created_by_fkey;
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE memos DROP CONSTRAINT IF EXISTS memos_created_by_fkey;
ALTER TABLE memos ADD CONSTRAINT memos_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE notices DROP CONSTRAINT IF EXISTS notices_created_by_fkey;
ALTER TABLE notices ADD CONSTRAINT notices_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE notices DROP CONSTRAINT IF EXISTS notices_completed_by_fkey;
ALTER TABLE notices ADD CONSTRAINT notices_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL;
