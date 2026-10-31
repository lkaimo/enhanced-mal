-- Short-lived OAuth state. RLS on with no policies => Edge Functions (service role) only.
create table mal_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users on delete cascade,
  code_verifier text not null,
  created_at timestamptz not null default now());
alter table mal_oauth_states enable row level security;
-- One MAL account can only be linked to one app user.
alter table linked_accounts add constraint linked_accounts_provider_uid_key unique (provider, provider_user_id);
