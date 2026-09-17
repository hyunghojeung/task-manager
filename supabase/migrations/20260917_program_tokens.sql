-- 프로그램(Bcount 임포지션) 로그인 토큰. 사용자가 지워지면 토큰도 지워진다.
create table if not exists program_tokens (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  company_id uuid not null,
  program text not null default 'imposition',
  device text not null default '',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists program_tokens_user_idx on program_tokens(user_id);
