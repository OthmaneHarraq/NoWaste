-- =====================================================================
-- NoWaste: smarter expiry matching
-- Run AFTER 20260926120000_add_location_and_disposition.sql (SQL Editor → paste → Run).
--
-- Before: an item only got a catalog shelf life when its name matched exactly,
-- so "oat milk", "2% milk" or "chicken breast" got no expiry from the catalog.
-- Now: exact name first, then a whole-word match with plurals, preferring the
-- household's own foods, then the longest (most specific) catalog name:
--   "philadelphia cream cheese" → cream cheese (not cheese)
--   "strawberry"                → strawberries
--   "chocolate milk"            → milk
-- The matched food is also stored on the inventory row (food_id), so the
-- dashboard can read its category.
--
-- record_event below is the location/disposition version from 20260926120000
-- with only step 2 (catalog lookup) changed. Safe to run more than once.
-- =====================================================================

create or replace function public.find_food(p_household_id uuid, p_name text)
returns public.foods
language plpgsql stable security definer set search_path = public
as $$
declare
    v_food public.foods;
    v_name text := lower(trim(p_name));
begin
    -- 1. exact name
    select * into v_food from public.foods
     where lower(name) = v_name
       and (household_id = p_household_id or household_id is null)
     order by household_id nulls last
     limit 1;
    if found then return v_food; end if;

    -- 2. a catalog name appearing as whole word(s) in the item name, plural-tolerant
    select f.* into v_food
      from public.foods f,
           lateral (
               -- escape regex characters in the catalog name, then allow plural endings
               select regexp_replace(lower(f.name), '([.*+?^${}()|\[\]\\])', '\\\1', 'g') as n
           ) esc,
           lateral (
               select case
                   when esc.n ~ 'ies$' then regexp_replace(esc.n, 'ies$', '') || '(y|ies)'
                   when esc.n ~ 'oes$' then regexp_replace(esc.n, 'es$', '') || '(es)?'
                   when esc.n ~ '[^s]s$' then regexp_replace(esc.n, 's$', '') || 's?'
                   else esc.n || '(s|es)?'
               end as pattern
           ) p
     where (f.household_id = p_household_id or f.household_id is null)
       and v_name ~ ('\m' || p.pattern || '\M')
     order by f.household_id nulls last, length(f.name) desc
     limit 1;
    return v_food; -- all-null row when nothing matched
end;
$$;

-- An earlier draft of this file defined the old 6-argument record_event. If that ran after
-- the location migration, two versions would exist and calls would be ambiguous: remove it.
drop function if exists public.record_event(uuid, text, text, real, text, int);

-- The location/disposition record_event, with step 2 using find_food()
create or replace function public.record_event(
    p_household_id uuid,
    p_label        text,
    p_action       text,
    p_confidence   real default null,
    p_source       text default 'camera',
    p_quantity     int  default 1,
    p_location     text default null,   -- 'in': where it goes (NULL = usual spot); 'out': take from here first
    p_disposition  text default null    -- 'out' only: consumed / thrown_away / composted, if already known
)
returns public.events
language plpgsql security definer set search_path = public
as $$
declare
    v_name     text;
    v_food     public.foods;
    v_expires  date;
    v_location text;
    v_matched  boolean := true;
    rem        record;
    ev         public.events;
begin
    if not public.is_member(p_household_id) then
        raise exception 'not a member of this household' using errcode = '42501';
    end if;
    if p_action not in ('in', 'out') then
        raise exception 'action must be in or out';
    end if;
    if p_disposition is not null and p_action <> 'out' then
        raise exception 'only an out event can have a disposition';
    end if;

    -- 1. learned alias ("plastic container" → "chili"), else the AI label as-is
    select item_name into v_name from public.food_aliases
     where household_id = p_household_id and lower(alias) = lower(trim(p_label));
    v_name := coalesce(v_name, lower(trim(p_label)));

    -- 2. catalog lookup for shelf life: exact name, else whole-word match (see find_food)
    v_food := public.find_food(p_household_id, v_name);

    -- 3. apply to inventory
    if p_action = 'in' then
        v_expires := case when v_food.shelf_days is not null then current_date + v_food.shelf_days end;
        v_location := p_location;
        perform public._inventory_add(p_household_id, v_name, v_food.id, p_quantity, v_expires, v_location);
    else
        rem := public._inventory_remove(p_household_id, v_name, p_quantity, p_location);
        v_matched := rem.removed;
        v_expires := rem.removed_expiry;
        v_location := rem.removed_location;
    end if;

    insert into public.events (household_id, action, item_name, raw_label, quantity, confidence, source, matched,
                               expires_on, location, disposition)
    values (p_household_id, p_action, v_name, p_label, p_quantity, p_confidence, p_source, v_matched,
            v_expires, v_location, p_disposition)
    returning * into ev;
    return ev;
end;
$$;

revoke all on function public.find_food(uuid, text) from public, anon, authenticated;
