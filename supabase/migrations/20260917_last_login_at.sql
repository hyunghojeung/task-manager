-- 최종 접속일. 로그인할 때마다 갱신한다. 기록이 없던 업체는 남아 있는 활동(작업·발주서·메모·공지)의 마지막 시각으로 채운다.
alter table companies add column if not exists last_login_at timestamptz;
alter table users add column if not exists last_login_at timestamptz;

update companies c set last_login_at = a.t
from (
  select company_id, max(t) as t from (
    select company_id, greatest(created_at, coalesce(updated_at, created_at)) as t from orders
    union all select company_id, greatest(created_at, coalesce(updated_at, created_at)) from purchase_orders
    union all select company_id, greatest(created_at, coalesce(updated_at, created_at)) from memos
    union all select company_id, created_at from notices
  ) x where t is not null group by company_id
) a
where c.id = a.company_id and c.last_login_at is null;
