-- =====================================================================
-- NoWaste: reset one account's fridge and fill it with demo data
--
-- Run in Supabase → SQL Editor → paste → Run. Change v_email first.
--
-- What it does, for the fridge (household) that account belongs to:
--   * deletes its items, history, name corrections, custom foods and cached AI text
--   * renames it to v_fridge_name (the join code stays the same, so housemates stay in)
--   * adds a realistic fridge: ~22 items with a mix of fresh / use soon / expired,
--     6 freezer items, 2 things "just taken out", and 20 days of history
--     (waste going down over time, so the Impact page tells a story)
-- It does NOT touch the login itself (email, password) or other households.
-- If the account has no fridge yet, one is created.
-- Safe to run again: every run starts from a clean fridge.
-- =====================================================================

do $$
declare
    v_email      text := 'gaurabg2005@gmail.com';   -- ← the email you sign in with
    v_fridge_name text := 'Our fridge';
    v_tz         text := 'America/New_York';        -- your timezone, so "expires today" means your today

    v_today date := (now() at time zone v_tz)::date;
    v_uid  uuid;
    hid    uuid;
    s      record;
    t_in   timestamptz;
    t_out  timestamptz;
    v_exp  date;
    d      int;
    k      int;
    n      int;
    v_name text;
    wasted boolean;
    by_cam boolean;
    history_names text[] := array[
        'milk', 'rotisserie chicken', 'lettuce', 'sweetgreen salad', 'raspberries', 'yogurt cups',
        'pad thai', 'deli turkey', 'apple juice', 'cilantro', 'ramen', 'cream cheese',
        'broccoli', 'pesto', 'burrito'];
begin
    select id into v_uid from auth.users where lower(email) = lower(trim(v_email));
    if v_uid is null then
        raise exception 'No account signs in with %. Check the email at the top of this script.', v_email;
    end if;

    select h.id into hid
      from public.households h
      join public.household_members m on m.household_id = h.id and m.user_id = v_uid
     order by m.joined_at desc
     limit 1;
    if hid is null then
        insert into public.households (name, created_by) values (v_fridge_name, v_uid) returning id into hid;
    end if;

    -- ---------- 1. Clean slate ------------------------------------------
    delete from public.events       where household_id = hid;
    delete from public.inventory    where household_id = hid;
    delete from public.food_aliases where household_id = hid;
    delete from public.foods        where household_id = hid;
    if to_regclass('public.ai_cache') is not null then
        execute 'delete from public.ai_cache where household_id = $1' using hid;
    end if;
    update public.households set name = v_fridge_name where id = hid;

    perform setseed(0.42); -- same "random" history every run

    -- ---------- 2. What's in the fridge now ------------------------------
    -- name, spot (null = the usual spot for its category), added N days ago,
    -- expires in N days (null = let the app estimate: used for the freezer), how it came in
    for s in
        select * from (values
            ('chicken breast',        null,      3,    1, 'camera'),
            ('chipotle burrito bowl', null,      2,    1, 'camera'),
            ('pad see ew',            null,      3,    0, 'camera'),
            ('strawberries',          null,      7,   -1, 'camera'),
            ('baby spinach',          null,      4,    2, 'camera'),
            ('greek yogurt',          null,      4,   10, 'camera'),
            ('sharp cheddar',         null,      3,   18, 'camera'),
            ('eggs',                  null,      2,   26, 'manual'),
            ('salmon fillet',         null,      1,    1, 'camera'),
            ('oat milk',              null,      5,    5, 'camera'),
            ('sriracha',              null,     12,  170, 'manual'),
            ('hummus',                null,      2,    5, 'camera'),
            ('avocados',              null,      2,    3, 'camera'),
            ('pizza slices',          null,      1,    2, 'camera'),
            ('apples',                null,      1,   29, 'camera'),
            ('grapes',                null,      2,    8, 'camera'),
            ('lemons',                null,      1,   20, 'camera'),
            ('cherries',              null,      3,    4, 'camera'),
            ('watermelon slice',      null,      4,    2, 'camera'),
            ('kiwis',                 null,      1,   12, 'camera'),
            ('bacon',                 null,      2,    5, 'camera'),
            ('ketchup',               null,      5,  175, 'manual'),
            ('vanilla ice cream',     'freezer', 59, null, 'camera'),
            ('frozen peas',           'freezer', 120, null, 'manual'),
            ('ground beef',           'freezer', 40, null, 'camera'),
            ('pork dumplings',        'freezer', 30, null, 'camera'),
            ('leftover chili',        'freezer', 20, null, 'camera'),
            ('mixed berries',         'freezer', 90, null, 'camera')
        ) as v(name, loc, added_days, exp_days, src)
    loop
        t_in  := now() - make_interval(days => s.added_days) - make_interval(hours => 1 + (length(s.name) % 5));
        v_exp := case when s.exp_days is not null then v_today + s.exp_days end;
        insert into public.inventory (household_id, food_id, name, quantity, added_at, expires_on, added_by, location, updated_at)
        values (hid, (public.find_food(hid, s.name)).id, s.name, 1, t_in, v_exp, v_uid, s.loc, t_in);
        insert into public.events (household_id, action, item_name, raw_label, quantity, confidence, source,
                                   expires_on, location, created_by, created_at)
        values (hid, 'in', s.name, s.name, 1,
                case when s.src = 'camera' then round((0.82 + random() * 0.16)::numeric, 2) end,
                s.src, v_exp, s.loc, v_uid, t_in);
    end loop;

    -- ---------- 3. Just taken out (dashed "taken out" cards for ~10 min) --
    for s in
        select * from (values
            ('orange juice',   10, 4, 2),
            ('leftover pasta',  6, 1, 7)
        ) as v(name, added_days, exp_days, mins_ago)
    loop
        t_in  := now() - make_interval(days => s.added_days);
        v_exp := v_today + s.exp_days;
        insert into public.events (household_id, action, item_name, raw_label, quantity, confidence, source, expires_on, created_by, created_at)
        values (hid, 'in',  s.name, s.name, 1, 0.9,  'camera', v_exp, v_uid, t_in),
               (hid, 'out', s.name, s.name, 1, 0.93, 'camera', v_exp, v_uid, now() - make_interval(mins => s.mins_ago));
    end loop;

    -- Used up by hand this morning
    insert into public.events (household_id, action, item_name, raw_label, quantity, confidence, source, expires_on, disposition, created_by, created_at)
    values (hid, 'in',  'cilantro', 'cilantro', 1, 0.88, 'camera', v_today + 1, null,       v_uid, now() - interval '4 days'),
           (hid, 'out', 'cilantro', 'cilantro', 1, null, 'manual', v_today + 1, 'consumed', v_uid, now() - interval '3 hours');

    -- ---------- 4. Twenty days of history --------------------------------
    -- Waste chance drops from ~30% to ~4%: "the app is working".
    for d in reverse 20..1 loop
        n := 1 + floor(random() * 3)::int;
        for k in 1..n loop
            v_name := history_names[1 + floor(random() * array_length(history_names, 1))::int];
            wasted := random() < case when d > 12 then 0.3 when d > 5 then 0.12 else 0.04 end;
            by_cam := random() < 0.6;
            t_out  := ((v_today - d) + make_interval(hours => 8 + floor(random() * 13)::int)) at time zone v_tz;
            t_in   := t_out - make_interval(days => 2 + floor(random() * 6)::int, hours => floor(random() * 5)::int);
            v_exp  := case when wasted then (v_today - d) - (1 + floor(random() * 3)::int)
                           else (v_today - d) + (1 + floor(random() * 4)::int) end;

            insert into public.events (household_id, action, item_name, raw_label, quantity, confidence, source, expires_on, created_by, created_at)
            values (hid, 'in', v_name, v_name, 1, round((0.8 + random() * 0.18)::numeric, 2), 'camera', v_exp, v_uid, t_in);

            insert into public.events (household_id, action, item_name, raw_label, quantity, confidence, source,
                                       expires_on, disposition, created_by, created_at)
            values (hid, 'out', v_name, v_name, 1,
                    case when by_cam then round((0.8 + random() * 0.18)::numeric, 2) end,
                    case when by_cam then 'camera' else 'manual' end,
                    v_exp,
                    case
                        when not wasted and not by_cam then 'consumed'
                        when wasted and not by_cam then (case when random() < 0.4 then 'composted' else 'thrown_away' end)
                        else null  -- camera: the app works it out (past its date = wasted, else eaten)
                    end,
                    v_uid, t_out);
        end loop;
    end loop;

    -- A remembered correction, to show off "Fix" (the AI said "plastic container")
    insert into public.food_aliases (household_id, alias, item_name) values (hid, 'plastic container', 'leftover chili');

    raise notice 'Done: "%" now has % items and % events.',
        v_fridge_name,
        (select count(*) from public.inventory where household_id = hid),
        (select count(*) from public.events where household_id = hid);
end $$;
