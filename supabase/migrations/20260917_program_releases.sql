-- 프로그램 배포 (Bcount 임포지션 exe 등). 파일은 Storage 비공개 버킷 'downloads' 에, 정보는 이 표에.
create table if not exists program_releases (
  key text primary key,                 -- 'imposition'
  file_name text not null,
  version text not null default '',
  size_bytes bigint not null default 0,
  storage_path text not null,           -- downloads 버킷 안 경로
  note text not null default '',
  uploaded_by text not null default '',
  updated_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public, file_size_limit)
values ('downloads', 'downloads', false, 209715200)
on conflict (id) do nothing;
