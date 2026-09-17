-- 업무관리도 업체별 지정. 이미 업무관리를 쓰는 사용자가 있는 업체와 pwindow 는 켜 둔다.
alter table companies add column if not exists feat_hub boolean not null default false;
update companies set feat_hub = true where lower(company_id) = 'pwindow' or id in (select company_id from users where hub_enabled = true);
