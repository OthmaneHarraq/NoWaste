-- =====================================================================
-- NoWaste — where things sit, and what happened to what left
--
-- Moves two things the app kept on each phone (AsyncStorage) into the
-- database, so every housemate sees the same fridge:
--   inventory.location    top_shelf / middle_shelf / drawer / door / freezer.
--                         NULL = the food's usual spot for its category (the
--                         app knows that mapping), so the camera never has to.
--   inventory.thawed_at   when it last came out of the freezer; the fridge
--                         clock restarts from here.
--   events.location       'in': where it went; 'out': where it came from.
--                         Lets undo put a frozen item back in the freezer.
--   events.disposition    'out' only: consumed, thrown_away or composted (binned,
--                         but in the compost), when someone said so.
--                         NULL = not confirmed (the app infers it).
--
-- Writes still go through security-definer functions: record_event() takes
-- an optional location / disposition, set_location() moves an item, and
-- update_disposition() confirms an 'out' after the fact.
-- Existing rows keep NULLs; nothing is backfilled.
-- =====================================================================

-- ---------- Columns --------------------------------------------------

alter table public.inventory
    add column location  text check (location in ('top_shelf', 'middle_shelf', 'drawer', 'door', 'freezer')),
    add column thawed_at timestamptz;

alter table public.events
    add column location    text check (location in ('top_shelf', 'middle_shelf', 'drawer', 'door', 'freezer')),
    add column disposition text check (disposition in ('consumed', 'thrown_away', 'composted')),
    add constraint events_disposition_only_out check (disposition is null or action = 'out');

-- ---------- Internal helpers (signatures change, so drop + recreate) --

drop function public._inventory_add(uuid, text, uuid, int, date);
drop function public._inventory_remove(uuid, text, int);

-- internal: add qty of an item (merges with a row of the same name, date and spot)
create or replace function public._inventory_add(hid uuid, p_name text, p_food uuid, p_qty int, p_expires date, p_location text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare existing uuid;
begin
    select id into existing from public.inventory
     where household_id = hid and lower(name) = lower(p_name)
       and expires_on is not distinct from p_expires
       and location is not distinct from p_location
     limit 1;
    if existing is not null then
        update public.inventory set quantity = quantity + p_qty, updated_at = now() where id = existing;
    else
        insert into public.inventory (household_id, food_id, name, quantity, expires_on, added_by, location)
        values (hid, p_food, p_name, p_qty, p_expires, auth.uid(), p_location);
    end if;
end;
$$;

-- internal: remove qty of an item. Takes from p_location first when given,
-- then prefers the fridge over the freezer, then soonest-expiring. Returns
-- the expiry and spot of what was removed, so undo can put it back.
create or replace function public._inventory_remove(hid uuid, p_name text, p_qty int, p_location text default null,
                                                    out removed boolean, out removed_expiry date, out removed_location text)
language plpgsql security definer set search_path = public
as $$
declare row public.inventory;
begin
    removed := false;
    select * into row from public.inventory
     where household_id = hid and lower(name) = lower(p_name)
     order by case when p_location is not null then location is distinct from p_location end,
              coalesce(location, '') = 'freezer',
              expires_on nulls last, added_at
     limit 1
     for update;
    if not found then return; end if;

    removed := true;
    removed_expiry := row.expires_on;
    removed_location := row.location;
    if row.quantity > p_qty then
        update public.inventory set quantity = quantity - p_qty, updated_at = now() where id = row.id;
    else
        delete from public.inventory where id = row.id;
    end if;
end;
$$;

-- ---------- record_event: optional location + disposition -------------

drop function public.record_event(uuid, text, text, real, text, int);

--   select * from record_event('<household>', 'ice cream', 'in', p_location => 'freezer');
--   select * from record_event('<household>', 'milk', 'out', p_source => 'manual', p_disposition => 'consumed');
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

    -- 2. catalog lookup for shelf life (household's custom food wins over global)
    select * into v_food from public.foods
     where lower(name) = lower(v_name)
       and (household_id = p_household_id or household_id is null)
     order by household_id nulls last
     limit 1;

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

-- ---------- undo / correct: keep the spot and the disposition ---------

create or replace function public.undo_event(p_event_id uuid)
returns public.events
language plpgsql security definer set search_path = public
as $$
declare ev public.events;
begin
    select * into ev from public.events where id = p_event_id for update;
    if not found or not public.is_member(ev.household_id) then
        raise exception 'event not found' using errcode = '42501';
    end if;
    if ev.status = 'undone' then return ev; end if;

    if ev.action = 'in' then
        perform public._inventory_remove(ev.household_id, ev.item_name, ev.quantity, ev.location);
    elsif ev.matched then
        perform public._inventory_add(ev.household_id, ev.item_name, null, ev.quantity, ev.expires_on, ev.location);
    end if;

    update public.events set status = 'undone' where id = ev.id returning * into ev;
    return ev;
end;
$$;

create or replace function public.correct_event(p_event_id uuid, p_item_name text, p_action text default null)
returns public.events
language plpgsql security definer set search_path = public
as $$
declare old public.events; new_ev public.events; v_action text;
begin
    old := public.undo_event(p_event_id);
    v_action := coalesce(p_action, old.action);

    if old.raw_label is not null and lower(trim(p_item_name)) <> lower(trim(old.raw_label)) then
        insert into public.food_aliases (household_id, alias, item_name)
        values (old.household_id, lower(trim(old.raw_label)), lower(trim(p_item_name)))
        on conflict (household_id, alias) do update set item_name = excluded.item_name;
    end if;

    new_ev := public.record_event(old.household_id, p_item_name, v_action,
                                  old.confidence, 'manual', old.quantity, old.location,
                                  case when v_action = 'out' then old.disposition end);
    update public.events set replaced_by = new_ev.id where id = old.id;
    return new_ev;
end;
$$;

-- ---------- New: move an item, confirm what happened to it ----------

-- Freezer ↔ fridge (or shelf to shelf). NULL = back to its usual spot.
-- Coming out of the freezer stamps thawed_at; going in clears it.
create or replace function public.set_location(p_inventory_id uuid, p_location text)
returns public.inventory
language plpgsql security definer set search_path = public
as $$
declare row public.inventory;
begin
    select * into row from public.inventory where id = p_inventory_id for update;
    if not found or not public.is_member(row.household_id) then
        raise exception 'item not found' using errcode = '42501';
    end if;
    if p_location is not null and p_location not in ('top_shelf', 'middle_shelf', 'drawer', 'door', 'freezer') then
        raise exception 'unknown location %', p_location;
    end if;
    if row.location is not distinct from p_location then return row; end if;

    update public.inventory
       set location   = p_location,
           thawed_at  = case
                            when p_location = 'freezer' then null
                            when row.location = 'freezer' then now()
                            else thawed_at
                        end,
           updated_at = now()
     where id = row.id
    returning * into row;
    return row;
end;
$$;

-- "Mark used" / "Thrown away" on something that already left (e.g. a
-- camera 'out' still in its grace period). NULL clears it.
create or replace function public.update_disposition(p_event_id uuid, p_disposition text)
returns public.events
language plpgsql security definer set search_path = public
as $$
declare ev public.events;
begin
    select * into ev from public.events where id = p_event_id for update;
    if not found or not public.is_member(ev.household_id) then
        raise exception 'event not found' using errcode = '42501';
    end if;
    if ev.action <> 'out' then
        raise exception 'only an out event can have a disposition';
    end if;
    if p_disposition is not null and p_disposition not in ('consumed', 'thrown_away', 'composted') then
        raise exception 'disposition must be consumed, thrown_away or composted';
    end if;

    update public.events set disposition = p_disposition where id = ev.id returning * into ev;
    return ev;
end;
$$;

-- Recreated internal helpers got fresh default grants; take them back.
revoke all on function public._inventory_add(uuid, text, uuid, int, date, text) from public, anon, authenticated;
revoke all on function public._inventory_remove(uuid, text, int, text)          from public, anon, authenticated;
