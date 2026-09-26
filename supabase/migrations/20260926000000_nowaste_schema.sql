-- =====================================================================
-- NoWaste — Supabase schema
-- Paste into Supabase → SQL Editor → Run (or `supabase db push`).
--
-- Model:
--   households ── household_members ── auth.users   (a fridge is shared)
--   inventory   what is in the fridge right now
--   events      every in/out the camera (or a person) recorded; undoable
--   foods       global catalog + each household's custom foods (shelf life)
--   food_aliases  learned renames: AI said "plastic container" → "chili"
--
-- The camera/Edge Function calls record_event(); the phone app calls
-- undo_event() / correct_event(). Those functions keep inventory in sync,
-- so nobody writes to inventory for camera events directly.
-- =====================================================================

-- ---------- Tables ---------------------------------------------------

create table public.households (
    id          uuid primary key default gen_random_uuid(),
    name        text not null default 'My fridge',
    join_code   text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
    created_by  uuid not null default auth.uid() references auth.users on delete cascade,
    created_at  timestamptz not null default now()
);

create table public.household_members (
    household_id uuid not null references public.households on delete cascade,
    user_id      uuid not null references auth.users on delete cascade,
    role         text not null default 'member' check (role in ('owner', 'member')),
    joined_at    timestamptz not null default now(),
    primary key (household_id, user_id)
);

-- household_id NULL = global food (visible to everyone, editable by no one)
create table public.foods (
    id            uuid primary key default gen_random_uuid(),
    household_id  uuid references public.households on delete cascade,
    name          text not null,
    category      text,
    shelf_days    int check (shelf_days > 0),
    created_at    timestamptz not null default now()
);
create unique index foods_name_per_household
    on public.foods (coalesce(household_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

create table public.food_aliases (
    household_id uuid not null references public.households on delete cascade,
    alias        text not null,          -- what the AI said
    item_name    text not null,          -- what the household calls it
    created_at   timestamptz not null default now(),
    primary key (household_id, alias)
);
create unique index food_aliases_ci on public.food_aliases (household_id, lower(alias));

create table public.inventory (
    id            uuid primary key default gen_random_uuid(),
    household_id  uuid not null references public.households on delete cascade,
    food_id       uuid references public.foods on delete set null,
    name          text not null,
    quantity      int  not null default 1 check (quantity > 0),
    added_at      timestamptz not null default now(),
    expires_on    date,
    added_by      uuid references auth.users on delete set null,
    updated_at    timestamptz not null default now()
);
create index inventory_household on public.inventory (household_id, lower(name));

create table public.events (
    id            uuid primary key default gen_random_uuid(),
    household_id  uuid not null references public.households on delete cascade,
    action        text not null check (action in ('in', 'out')),
    item_name     text not null,          -- name after alias lookup
    raw_label     text,                   -- exactly what the AI returned
    quantity      int  not null default 1 check (quantity > 0),
    confidence    real check (confidence between 0 and 1),
    source        text not null default 'camera' check (source in ('camera', 'manual')),
    status        text not null default 'applied' check (status in ('applied', 'undone')),
    matched       boolean not null default true,  -- false = "out" for something not in inventory
    expires_on    date,                   -- remembered so an undo can restore it
    replaced_by   uuid references public.events on delete set null,
    created_by    uuid references auth.users on delete set null default auth.uid(),
    created_at    timestamptz not null default now()
);
create index events_household_time on public.events (household_id, created_at desc);

-- ---------- Membership helper (used by every RLS policy) -------------

create or replace function public.is_member(hid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
    select exists (
        select 1 from public.household_members
        where household_id = hid and user_id = auth.uid()
    );
$$;

-- Creator of a household becomes its owner automatically
create or replace function public.add_owner_membership()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
    insert into public.household_members (household_id, user_id, role)
    values (new.id, new.created_by, 'owner');
    return new;
end;
$$;

create trigger households_add_owner
    after insert on public.households
    for each row execute function public.add_owner_membership();

-- ---------- Row Level Security ---------------------------------------

alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.foods             enable row level security;
alter table public.food_aliases      enable row level security;
alter table public.inventory         enable row level security;
alter table public.events            enable row level security;

-- households
create policy "members read household"   on public.households for select using (public.is_member(id) or created_by = auth.uid());
create policy "anyone signed in creates"  on public.households for insert with check (created_by = auth.uid());
create policy "owner updates household"   on public.households for update using (created_by = auth.uid());
create policy "owner deletes household"   on public.households for delete using (created_by = auth.uid());

-- household_members: see your housemates; leave by deleting yourself; owner can remove anyone
create policy "members see members" on public.household_members for select using (public.is_member(household_id));
create policy "leave or remove"     on public.household_members for delete using (
    user_id = auth.uid()
    or exists (select 1 from public.households h where h.id = household_id and h.created_by = auth.uid())
);
-- (joining happens through join_household(), not direct inserts)

-- foods: global rows readable by all; custom rows per household
create policy "read foods"   on public.foods for select using (household_id is null or public.is_member(household_id));
create policy "write custom" on public.foods for all
    using (household_id is not null and public.is_member(household_id))
    with check (household_id is not null and public.is_member(household_id));

-- aliases, inventory, events: household members only
create policy "household only" on public.food_aliases for all
    using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy "household only" on public.inventory for all
    using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy "household reads events" on public.events for select using (public.is_member(household_id));
-- events are written only through record_event / undo_event / correct_event

-- ---------- Inventory logic ------------------------------------------

-- internal: add qty of an item (merges with an existing row of the same name)
create or replace function public._inventory_add(hid uuid, p_name text, p_food uuid, p_qty int, p_expires date)
returns void
language plpgsql security definer set search_path = public
as $$
declare existing uuid;
begin
    select id into existing from public.inventory
     where household_id = hid and lower(name) = lower(p_name)
       and expires_on is not distinct from p_expires
     limit 1;
    if existing is not null then
        update public.inventory set quantity = quantity + p_qty, updated_at = now() where id = existing;
    else
        insert into public.inventory (household_id, food_id, name, quantity, expires_on, added_by)
        values (hid, p_food, p_name, p_qty, p_expires, auth.uid());
    end if;
end;
$$;

-- internal: remove qty of an item, soonest-expiring first. Returns the expiry
-- of what was removed (so undo can put it back), or raises no_data_found-like null.
create or replace function public._inventory_remove(hid uuid, p_name text, p_qty int, out removed boolean, out removed_expiry date)
language plpgsql security definer set search_path = public
as $$
declare row public.inventory;
begin
    removed := false;
    select * into row from public.inventory
     where household_id = hid and lower(name) = lower(p_name)
     order by expires_on nulls last, added_at
     limit 1
     for update;
    if not found then return; end if;

    removed := true;
    removed_expiry := row.expires_on;
    if row.quantity > p_qty then
        update public.inventory set quantity = quantity - p_qty, updated_at = now() where id = row.id;
    else
        delete from public.inventory where id = row.id;
    end if;
end;
$$;

-- What the camera / Edge Function calls after the AI answers.
--   select * from record_event('<household>', 'milk', 'in', 0.93);
create or replace function public.record_event(
    p_household_id uuid,
    p_label        text,
    p_action       text,
    p_confidence   real default null,
    p_source       text default 'camera',
    p_quantity     int  default 1
)
returns public.events
language plpgsql security definer set search_path = public
as $$
declare
    v_name    text;
    v_food    public.foods;
    v_expires date;
    v_matched boolean := true;
    rem       record;
    ev        public.events;
begin
    if not public.is_member(p_household_id) then
        raise exception 'not a member of this household' using errcode = '42501';
    end if;
    if p_action not in ('in', 'out') then
        raise exception 'action must be in or out';
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
        perform public._inventory_add(p_household_id, v_name, v_food.id, p_quantity, v_expires);
    else
        rem := public._inventory_remove(p_household_id, v_name, p_quantity);
        v_matched := rem.removed;
        v_expires := rem.removed_expiry;
    end if;

    insert into public.events (household_id, action, item_name, raw_label, quantity, confidence, source, matched, expires_on)
    values (p_household_id, p_action, v_name, p_label, p_quantity, p_confidence, p_source, v_matched, v_expires)
    returning * into ev;
    return ev;
end;
$$;

-- "Undo" button
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
        perform public._inventory_remove(ev.household_id, ev.item_name, ev.quantity);
    elsif ev.matched then
        perform public._inventory_add(ev.household_id, ev.item_name, null, ev.quantity, ev.expires_on);
    end if;

    update public.events set status = 'undone' where id = ev.id returning * into ev;
    return ev;
end;
$$;

-- "Fix" button: rename and/or flip in/out. If the name changed, the household
-- learns an alias so the next time the AI says the same thing it's right.
create or replace function public.correct_event(p_event_id uuid, p_item_name text, p_action text default null)
returns public.events
language plpgsql security definer set search_path = public
as $$
declare old public.events; new_ev public.events;
begin
    old := public.undo_event(p_event_id);

    if old.raw_label is not null and lower(trim(p_item_name)) <> lower(trim(old.raw_label)) then
        insert into public.food_aliases (household_id, alias, item_name)
        values (old.household_id, lower(trim(old.raw_label)), lower(trim(p_item_name)))
        on conflict (household_id, alias) do update set item_name = excluded.item_name;
    end if;

    new_ev := public.record_event(old.household_id, p_item_name, coalesce(p_action, old.action),
                                  old.confidence, 'manual', old.quantity);
    update public.events set replaced_by = new_ev.id where id = old.id;
    return new_ev;
end;
$$;

-- Join a housemate's fridge with the 6-character code
create or replace function public.join_household(p_code text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare hid uuid;
begin
    if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
    select id into hid from public.households where join_code = upper(trim(p_code));
    if hid is null then raise exception 'invalid code'; end if;
    insert into public.household_members (household_id, user_id) values (hid, auth.uid())
    on conflict do nothing;
    return hid;
end;
$$;

-- Internal helpers are not callable from the app. Supabase grants every new
-- function to anon/authenticated by default, so revoke from those explicitly.
revoke all on function public._inventory_add(uuid, text, uuid, int, date)  from public, anon, authenticated;
revoke all on function public._inventory_remove(uuid, text, int)            from public, anon, authenticated;
revoke all on function public.add_owner_membership()                        from public, anon, authenticated;

-- ---------- Convenience view -----------------------------------------

create or replace view public.expiring_soon
with (security_invoker = true) as
    select *, expires_on - current_date as days_left
      from public.inventory
     where expires_on is not null and expires_on <= current_date + 3
     order by expires_on;

-- ---------- Realtime (phone app sees camera events instantly) --------

do $$
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        alter publication supabase_realtime add table public.inventory, public.events;
    end if;
end $$;

-- ---------- Seed: common foods with typical fridge life (days) -------

insert into public.foods (name, category, shelf_days) values
    ('milk', 'dairy', 7), ('eggs', 'dairy', 28), ('butter', 'dairy', 30),
    ('yogurt', 'dairy', 14), ('cheese', 'dairy', 21), ('cream cheese', 'dairy', 14),
    ('chicken', 'meat', 2), ('ground beef', 'meat', 2), ('bacon', 'meat', 7),
    ('deli meat', 'meat', 5), ('fish', 'seafood', 2),
    ('lettuce', 'produce', 7), ('spinach', 'produce', 5), ('strawberries', 'produce', 4),
    ('grapes', 'produce', 10), ('carrots', 'produce', 21), ('broccoli', 'produce', 5),
    ('apples', 'produce', 30), ('tomatoes', 'produce', 7), ('avocado', 'produce', 4),
    ('orange juice', 'drinks', 7), ('leftovers', 'prepared', 4), ('tofu', 'protein', 5),
    ('hummus', 'prepared', 7), ('ketchup', 'condiment', 180), ('mayonnaise', 'condiment', 60);
