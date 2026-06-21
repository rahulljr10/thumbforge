create extension if not exists "pgcrypto";

create type public.plan_type as enum ('free', 'starter', 'pro', 'custom');
create type public.project_status as enum (
  'draft',
  'submitted',
  'in_progress',
  'review',
  'delivered',
  'revision_requested',
  'archived'
);
create type public.transaction_type as enum (
  'subscription',
  'topup',
  'delivery',
  'refund',
  'adjustment'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  channel_name text not null default '',
  country_code text not null default '',
  timezone text not null default 'UTC',
  role text not null default 'member' check (role in ('member', 'admin')),
  plan public.plan_type not null default 'free',
  monthly_credits integer not null default 1 check (monthly_credits >= 0),
  rollover_credits integer not null default 0 check (rollover_credits >= 0),
  topup_credits integer not null default 0 check (topup_credits >= 0),
  renewal_at timestamptz,
  visual_style text not null default '',
  exclusions text not null default '',
  delivery_alerts boolean not null default true,
  product_updates boolean not null default false,
  intended_plan public.plan_type not null default 'free',
  trial_granted_at timestamptz not null default now(),
  trial_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  video_url text,
  script_text text,
  source_file_path text,
  niche text not null,
  concepts_requested integer not null default 2 check (concepts_requested between 1 and 3),
  core_promise text not null,
  allowed_people text,
  excluded_elements text,
  reference_url text,
  reference_notes text,
  status public.project_status not null default 'submitted',
  selected_concept_id uuid,
  credits_charged integer not null default 0 check (credits_charged >= 0),
  submitted_at timestamptz not null default now(),
  delivered_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.concepts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  storage_path text not null,
  notes text,
  is_selected boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.project_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('subject_image', 'reference_image')),
  storage_path text not null,
  original_name text not null,
  created_at timestamptz not null default now()
);

alter table public.projects
  add constraint projects_selected_concept_fk
  foreign key (selected_concept_id) references public.concepts(id) on delete set null;

create table public.revisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  type public.transaction_type not null,
  credit_delta integer not null default 0,
  amount_cents integer,
  currency text,
  provider text,
  provider_reference text,
  description text not null,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  channel_name text,
  request_type text not null,
  videos_per_month integer,
  channel_count integer,
  message text not null,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);

create index projects_user_id_idx on public.projects(user_id, submitted_at desc);
create index concepts_project_id_idx on public.concepts(project_id, created_at);
create index project_assets_project_id_idx on public.project_assets(project_id, created_at);
create index transactions_user_id_idx on public.credit_transactions(user_id, created_at desc);
create index notifications_user_id_idx on public.notifications(user_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger projects_touch_updated_at
before update on public.projects
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, channel_name, country_code, timezone, intended_plan)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'channel_name', ''),
    upper(coalesce(new.raw_user_meta_data ->> 'country_code', '')),
    coalesce(new.raw_user_meta_data ->> 'timezone', 'UTC'),
    case
      when coalesce(new.raw_user_meta_data ->> 'intended_plan', '') in ('starter', 'pro')
        then (new.raw_user_meta_data ->> 'intended_plan')::public.plan_type
      else 'free'::public.plan_type
    end
  );

  insert into public.credit_transactions (
    user_id, type, credit_delta, description
  ) values (
    new.id, 'adjustment', 1, 'Free first thumbnail trial'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.available_credits(target_user uuid)
returns integer
language plpgsql stable security definer set search_path = public
as $$
begin
  if target_user <> auth.uid() and not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Not authorized';
  end if;

  return (
    select greatest(
      p.monthly_credits + p.rollover_credits + p.topup_credits
      - coalesce((
        select sum(pr.concepts_requested)
        from public.projects pr
        where pr.user_id = target_user
          and pr.credits_charged = 0
          and pr.status in ('submitted', 'in_progress', 'review', 'revision_requested')
      ), 0),
      0
    )
    from public.profiles p
    where p.id = target_user
  );
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.consume_credits(target_user uuid, amount integer)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  profile_row public.profiles%rowtype;
  remaining integer := amount;
  used integer;
begin
  if amount <= 0 then
    raise exception 'Credit amount must be positive';
  end if;

  select * into profile_row
  from public.profiles
  where id = target_user
  for update;

  if profile_row.monthly_credits + profile_row.rollover_credits + profile_row.topup_credits < amount then
    raise exception 'Insufficient credits';
  end if;

  used := least(profile_row.monthly_credits, remaining);
  profile_row.monthly_credits := profile_row.monthly_credits - used;
  remaining := remaining - used;

  used := least(profile_row.rollover_credits, remaining);
  profile_row.rollover_credits := profile_row.rollover_credits - used;
  remaining := remaining - used;

  profile_row.topup_credits := profile_row.topup_credits - remaining;

  update public.profiles
  set monthly_credits = profile_row.monthly_credits,
      rollover_credits = profile_row.rollover_credits,
      topup_credits = profile_row.topup_credits
  where id = target_user;
end;
$$;

create or replace function public.select_concept(concept_uuid uuid)
returns public.projects
language plpgsql security definer set search_path = public
as $$
declare
  project_row public.projects%rowtype;
  concept_row public.concepts%rowtype;
begin
  select * into concept_row from public.concepts where id = concept_uuid;
  if concept_row.id is null or concept_row.user_id <> auth.uid() then
    raise exception 'Concept not found';
  end if;

  select * into project_row
  from public.projects
  where id = concept_row.project_id
  for update;

  if project_row.user_id <> auth.uid() then
    raise exception 'Project not found';
  end if;

  if project_row.credits_charged = 0 then
    raise exception 'This concept has not been delivered';
  end if;

  update public.concepts
  set is_selected = (id = concept_uuid)
  where project_id = project_row.id;

  update public.projects
  set selected_concept_id = concept_uuid,
      status = 'delivered',
      delivered_at = coalesce(delivered_at, now()),
      credits_charged = project_row.credits_charged
  where id = project_row.id
  returning * into project_row;

  return project_row;
end;
$$;

create or replace function public.deliver_project(project_uuid uuid)
returns public.projects
language plpgsql security definer set search_path = public
as $$
declare
  project_row public.projects%rowtype;
  concept_count integer;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  select * into project_row
  from public.projects
  where id = project_uuid
  for update;

  if project_row.id is null then
    raise exception 'Project not found';
  end if;

  select count(*) into concept_count
  from public.concepts
  where project_id = project_row.id;

  if concept_count < project_row.concepts_requested then
    raise exception 'Upload all requested concepts before delivery';
  end if;

  if project_row.credits_charged = 0 then
    perform public.consume_credits(project_row.user_id, project_row.concepts_requested);

    insert into public.credit_transactions (
      user_id, project_id, type, credit_delta, description
    ) values (
      project_row.user_id, project_row.id, 'delivery',
      -project_row.concepts_requested,
      'Thumbnail concepts delivered for review'
    );

    update public.profiles
    set trial_used_at = coalesce(trial_used_at, now())
    where id = project_row.user_id
      and plan = 'free';
  end if;

  update public.projects
  set status = 'review',
      credits_charged = case
        when credits_charged = 0 then concepts_requested
        else credits_charged
      end
  where id = project_row.id
  returning * into project_row;

  insert into public.notifications (user_id, title, body, href)
  values (
    project_row.user_id,
    'Your concepts are ready',
    project_row.title || ' is ready for review.',
    'dashboard.html?view=projects&project=' || project_row.id
  );

  return project_row;
end;
$$;

create or replace function public.request_revision(project_uuid uuid, revision_message text)
returns public.projects
language plpgsql security definer set search_path = public
as $$
declare
  project_row public.projects%rowtype;
begin
  if length(trim(revision_message)) < 3 then
    raise exception 'Please describe the requested change';
  end if;

  select * into project_row
  from public.projects
  where id = project_uuid
  for update;

  if project_row.id is null or project_row.user_id <> auth.uid() then
    raise exception 'Project not found';
  end if;

  if project_row.status not in ('review', 'delivered') then
    raise exception 'This project is not currently open for revision';
  end if;

  insert into public.revisions (project_id, user_id, message)
  values (project_row.id, auth.uid(), trim(revision_message));

  update public.projects
  set status = 'revision_requested'
  where id = project_row.id
  returning * into project_row;

  return project_row;
end;
$$;

create or replace function public.update_profile_preferences(
  new_full_name text,
  new_channel_name text,
  new_timezone text,
  new_visual_style text,
  new_exclusions text,
  new_delivery_alerts boolean,
  new_product_updates boolean
)
returns public.profiles
language plpgsql security definer set search_path = public
as $$
declare
  profile_row public.profiles%rowtype;
begin
  update public.profiles
  set full_name = left(trim(coalesce(new_full_name, '')), 120),
      channel_name = left(trim(coalesce(new_channel_name, '')), 160),
      timezone = left(trim(coalesce(new_timezone, 'UTC')), 120),
      visual_style = left(coalesce(new_visual_style, ''), 2000),
      exclusions = left(coalesce(new_exclusions, ''), 2000),
      delivery_alerts = coalesce(new_delivery_alerts, true),
      product_updates = coalesce(new_product_updates, false)
  where id = auth.uid()
  returning * into profile_row;

  if profile_row.id is null then
    raise exception 'Profile not found';
  end if;

  return profile_row;
end;
$$;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.concepts enable row level security;
alter table public.project_assets enable row level security;
alter table public.revisions enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.notifications enable row level security;
alter table public.contact_requests enable row level security;

create policy "Members read own profile" on public.profiles
for select using (id = auth.uid());
create policy "Admins manage profiles" on public.profiles
for all using (public.is_admin()) with check (public.is_admin());

create policy "Members read own projects" on public.projects
for select using (user_id = auth.uid());
create policy "Members create own projects" on public.projects
for insert with check (
  user_id = auth.uid()
  and status in ('draft', 'submitted')
  and public.available_credits(auth.uid()) >= concepts_requested
);
create policy "Admins manage projects" on public.projects
for all using (public.is_admin()) with check (public.is_admin());

create policy "Members read own concepts" on public.concepts
for select using (user_id = auth.uid());
create policy "Admins manage concepts" on public.concepts
for all using (public.is_admin()) with check (public.is_admin());
create policy "Members read own project assets" on public.project_assets
for select using (user_id = auth.uid());
create policy "Members create own project assets" on public.project_assets
for insert with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.projects
    where projects.id = project_assets.project_id
      and projects.user_id = auth.uid()
  )
);
create policy "Admins manage project assets" on public.project_assets
for all using (public.is_admin()) with check (public.is_admin());
create policy "Members read own revisions" on public.revisions
for select using (user_id = auth.uid());
create policy "Admins manage revisions" on public.revisions
for all using (public.is_admin()) with check (public.is_admin());
create policy "Members read own transactions" on public.credit_transactions
for select using (user_id = auth.uid());
create policy "Admins manage transactions" on public.credit_transactions
for all using (public.is_admin()) with check (public.is_admin());
create policy "Members read own notifications" on public.notifications
for select using (user_id = auth.uid());
create policy "Members update own notifications" on public.notifications
for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Admins manage notifications" on public.notifications
for all using (public.is_admin()) with check (public.is_admin());
create policy "Anyone can submit contact requests" on public.contact_requests
for insert to anon, authenticated with check (true);
create policy "Admins manage contact requests" on public.contact_requests
for all using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('brief-files', 'brief-files', false),
       ('project-assets', 'project-assets', false),
       ('concepts', 'concepts', false)
on conflict (id) do nothing;

create policy "Members upload own brief files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'brief-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "Members read own brief files"
on storage.objects for select to authenticated
using (
  bucket_id = 'brief-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "Members read own concepts"
on storage.objects for select to authenticated
using (
  bucket_id = 'concepts'
  and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "Members upload own project assets"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'project-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "Members read own project assets"
on storage.objects for select to authenticated
using (
  bucket_id = 'project-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "Admins manage brief files"
on storage.objects for all to authenticated
using (bucket_id = 'brief-files' and public.is_admin())
with check (bucket_id = 'brief-files' and public.is_admin());
create policy "Admins manage concept files"
on storage.objects for all to authenticated
using (bucket_id = 'concepts' and public.is_admin())
with check (bucket_id = 'concepts' and public.is_admin());
create policy "Admins manage project asset files"
on storage.objects for all to authenticated
using (bucket_id = 'project-assets' and public.is_admin())
with check (bucket_id = 'project-assets' and public.is_admin());

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles,
  public.projects,
  public.concepts,
  public.project_assets,
  public.revisions,
  public.credit_transactions,
  public.notifications,
  public.contact_requests
to authenticated;
grant insert on public.contact_requests to anon;

revoke all on function public.available_credits(uuid) from public, anon;
revoke all on function public.consume_credits(uuid, integer) from public, anon, authenticated;
revoke all on function public.select_concept(uuid) from public, anon;
revoke all on function public.deliver_project(uuid) from public, anon;
revoke all on function public.request_revision(uuid, text) from public, anon;
revoke all on function public.update_profile_preferences(text, text, text, text, text, boolean, boolean) from public, anon;
revoke all on function public.is_admin() from public, anon;

grant execute on function public.available_credits(uuid) to authenticated;
grant execute on function public.select_concept(uuid) to authenticated;
grant execute on function public.deliver_project(uuid) to authenticated;
grant execute on function public.request_revision(uuid, text) to authenticated;
grant execute on function public.update_profile_preferences(text, text, text, text, text, boolean, boolean) to authenticated;
grant execute on function public.is_admin() to authenticated;
