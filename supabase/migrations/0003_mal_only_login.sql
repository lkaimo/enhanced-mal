-- MAL-only login: OAuth state now exists before any app user does.
alter table mal_oauth_states drop column user_id;
