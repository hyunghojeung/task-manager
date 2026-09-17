-- 업체별 기능 사용 여부 (최고관리자가 지정). 기본은 끔, pwindow 만 켬.
alter table companies add column if not exists feat_imposition boolean not null default false;
alter table companies add column if not exists feat_taekbae boolean not null default false;
alter table companies add column if not exists feat_sales boolean not null default false;
update companies set feat_imposition = true, feat_taekbae = true, feat_sales = true where lower(company_id) = 'pwindow';
