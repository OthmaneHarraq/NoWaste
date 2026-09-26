-- =====================================================================
-- NoWaste — cache for AI-written insights and recipe ideas
--
-- The generate-insights / suggest-recipes Edge Functions store their last
-- LLM answer here, one row per household per kind, so the LLM is called a
-- few times a day at most instead of on every page load. input_hash is a
-- hash of what was sent, so an unchanged input reuses the cached answer.
--
-- Members can read their household's rows. Writes go through
-- save_ai_cache() (security definer + is_member), like everything else.
-- Nothing here is needed for the app to work: without it (or without an
-- LLM key) the app shows templated insights and TheMealDB recipes.
-- =====================================================================

create table public.ai_cache (
    household_id  uuid not null references public.households on delete cascade,
    kind          text not null check (kind in ('insights', 'recipes')),
    input_hash    text not null,
    payload       jsonb not null,
    generated_at  timestamptz not null default now(),
    primary key (household_id, kind)
);

alter table public.ai_cache enable row level security;
create policy "household reads cache" on public.ai_cache for select using (public.is_member(household_id));
-- written only through save_ai_cache()

create or replace function public.save_ai_cache(p_household_id uuid, p_kind text, p_input_hash text, p_payload jsonb)
returns public.ai_cache
language plpgsql security definer set search_path = public
as $$
declare row public.ai_cache;
begin
    if not public.is_member(p_household_id) then
        raise exception 'not a member of this household' using errcode = '42501';
    end if;
    insert into public.ai_cache (household_id, kind, input_hash, payload, generated_at)
    values (p_household_id, p_kind, p_input_hash, p_payload, now())
    on conflict (household_id, kind) do update
        set input_hash = excluded.input_hash, payload = excluded.payload, generated_at = excluded.generated_at
    returning * into row;
    return row;
end;
$$;

revoke all on function public.save_ai_cache(uuid, text, text, jsonb) from public, anon;
