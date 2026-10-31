-- Manually added titles: private to the account that created them. Never synced to MyAnimeList.
create table custom_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  kind text not null check (kind in ('anime','manga','manhwa','manhua')),
  cover_path text,
  status text not null,
  score smallint not null default 0 check (score between 0 and 10),
  progress integer not null default 0 check (progress >= 0),
  volumes_read integer not null default 0 check (volumes_read >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'anime' and status in ('watching','completed','on_hold','dropped','plan_to_watch'))
      or (kind <> 'anime' and status in ('reading','completed','on_hold','dropped','plan_to_read'))),
  check (cover_path is null or cover_path like user_id::text || '/%')   -- images live in the owner's own folder
);
create index custom_entries_user_idx on custom_entries (user_id, created_at);
alter table custom_entries enable row level security;
create policy "own custom entries" on custom_entries for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Private bucket: files are only reachable by their owner (via signed URLs).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('custom-covers', 'custom-covers', false, 2097152, array['image/webp','image/png','image/jpeg'])
on conflict (id) do nothing;
create policy "custom covers read own" on storage.objects for select to authenticated
  using (bucket_id = 'custom-covers' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "custom covers upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'custom-covers' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "custom covers delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'custom-covers' and (storage.foldername(name))[1] = auth.uid()::text);
