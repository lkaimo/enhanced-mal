-- Enhanced MyAnimeList: initial schema. RLS enabled on every table.
create type media_type as enum ('anime','manga');
create type sync_status as enum ('local_only','pending','synced','failed');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text, avatar_url text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table linked_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  provider text not null, provider_user_id text not null,
  connected_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id, provider));

-- MAL tokens: RLS on with NO policies => unreachable from the browser; only Edge Functions (service role) touch it.
create table mal_credentials (
  user_id uuid primary key references auth.users on delete cascade,
  access_token text not null, refresh_token text not null, expires_at timestamptz not null,
  updated_at timestamptz not null default now());

create table catalog_items (
  id uuid primary key default gen_random_uuid(),
  mal_id integer not null, media_type media_type not null,
  title text not null, alternative_titles jsonb, cover_image_url text, synopsis text,
  genres jsonb, metadata jsonb, cached_at timestamptz not null default now(),
  unique (mal_id, media_type));

create table list_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  mal_id integer not null, media_type media_type not null,
  status text not null, score smallint check (score between 0 and 10),
  progress integer not null default 0 check (progress >= 0),
  volumes_read integer check (volumes_read >= 0),
  started_at date, completed_at date, notes text,   -- notes are local-only, never sent to MAL
  is_manhwa boolean,                                -- null = unknown, true/false = classified
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  sync_status sync_status not null default 'local_only', last_synced_at timestamptz,
  unique (user_id, media_type, mal_id));

create table tags (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
  name text not null, created_at timestamptz not null default now(), unique (user_id, name));
create table list_entry_tags (list_entry_id uuid references list_entries on delete cascade, tag_id uuid references tags on delete cascade,
  primary key (list_entry_id, tag_id));
create table collections (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
  name text not null, description text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table collection_items (collection_id uuid references collections on delete cascade, list_entry_id uuid references list_entries on delete cascade,
  position integer not null default 0, primary key (collection_id, list_entry_id));
create table sync_jobs (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
  job_type text not null, status text not null default 'queued', started_at timestamptz, finished_at timestamptz,
  error_message text, metadata jsonb);
create table user_preferences (user_id uuid primary key references auth.users on delete cascade,
  theme text not null default 'default', discovery jsonb not null default '{}');

alter table profiles enable row level security;
alter table linked_accounts enable row level security;
alter table mal_credentials enable row level security;
alter table catalog_items enable row level security;
alter table list_entries enable row level security;
alter table tags enable row level security;
alter table list_entry_tags enable row level security;
alter table collections enable row level security;
alter table collection_items enable row level security;
alter table sync_jobs enable row level security;
alter table user_preferences enable row level security;

create policy "own profile" on profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "read own links" on linked_accounts for select using (user_id = auth.uid());   -- writes via Edge Functions
create policy "catalog readable" on catalog_items for select using (true);                   -- writes via Edge Functions
create policy "own entries" on list_entries for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own tags" on tags for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own entry tags" on list_entry_tags for all
  using (exists (select 1 from list_entries e where e.id = list_entry_id and e.user_id = auth.uid()))
  with check (exists (select 1 from list_entries e where e.id = list_entry_id and e.user_id = auth.uid())
              and exists (select 1 from tags t where t.id = tag_id and t.user_id = auth.uid()));
create policy "own collections" on collections for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own collection items" on collection_items for all
  using (exists (select 1 from collections c where c.id = collection_id and c.user_id = auth.uid()))
  with check (exists (select 1 from collections c where c.id = collection_id and c.user_id = auth.uid())
              and exists (select 1 from list_entries e where e.id = list_entry_id and e.user_id = auth.uid()));
create policy "read own sync jobs" on sync_jobs for select using (user_id = auth.uid());
create policy "own preferences" on user_preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  insert into user_preferences (user_id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
