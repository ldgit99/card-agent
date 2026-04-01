create table if not exists lesson_designs (
  id text primary key,
  current_version integer not null,
  title text not null,
  topic text not null,
  subject_label text not null,
  target_label text not null,
  payload jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists lesson_design_versions (
  id bigserial primary key,
  lesson_design_id text not null references lesson_designs(id) on delete cascade,
  version integer not null,
  title text not null,
  payload jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (lesson_design_id, version)
);

create index if not exists idx_lesson_design_versions_design_id
  on lesson_design_versions (lesson_design_id, version desc);

create table if not exists simulation_sessions (
  id text primary key,
  lesson_design_id text not null references lesson_designs(id) on delete cascade,
  design_version integer not null,
  analysis jsonb,
  scenario jsonb,
  turns jsonb not null,
  risks jsonb not null,
  questions jsonb not null,
  journal jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

alter table simulation_sessions add column if not exists scenario jsonb;

create index if not exists idx_simulation_sessions_design_id
  on simulation_sessions (lesson_design_id, updated_at desc);