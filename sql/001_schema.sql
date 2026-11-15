-- Execute no Supabase SQL Editor. Nenhuma tabela privada é exposta à API anônima.
create extension if not exists pgcrypto;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null, display_name text not null default 'Jogador',
 banned_until timestamptz, permanent_ban boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists public.generation_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id), prompt text not null,
 severity text not null check(severity in ('leve','medio','perigo')),
 status text not null check(status in ('allowed','pending','blocked','generated','failed')),
 reason text not null, model text not null, input_tokens int not null default 0, output_tokens int not null default 0, total_tokens int not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.games (
 id uuid primary key default gen_random_uuid(), creator_id uuid not null references public.profiles(id),
 creator_name text not null, request_id uuid references public.generation_requests(id),
 spec jsonb not null, published boolean not null default false, likes int not null default 0,
 created_at timestamptz not null default now()
);
create table if not exists public.likes (
 user_id uuid not null references public.profiles(id), game_id uuid not null references public.games(id) on delete cascade,
 primary key(user_id,game_id)
);
create table if not exists public.comments (
 id uuid primary key default gen_random_uuid(), game_id uuid not null references public.games(id) on delete cascade,
 user_id uuid not null references public.profiles(id), author text not null, content text not null,
 created_at timestamptz not null default now()
);
create table if not exists public.moderation_actions (
 id uuid primary key default gen_random_uuid(), actor_id uuid not null references public.profiles(id),
 target_user_id uuid not null references public.profiles(id),action text not null,
 reason text not null,duration_minutes int,created_at timestamptz not null default now()
);
create index if not exists idx_generation_created on public.generation_requests(created_at desc);
create index if not exists idx_generation_severity on public.generation_requests(severity,status);
create index if not exists idx_games_created on public.games(published,created_at desc);
create index if not exists idx_comments_game on public.comments(game_id,created_at desc);
create index if not exists idx_moderation_target on public.moderation_actions(target_user_id,created_at desc);
create or replace function public.count_likes() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if TG_OP = 'INSERT' then update public.games set likes=likes+1 where id=NEW.game_id; return NEW;
 else update public.games set likes=greatest(0,likes-1) where id=OLD.game_id; return OLD;end if;
end $$;
drop trigger if exists count_likes_trigger on public.likes;
create trigger count_likes_trigger after insert or delete on public.likes for each row execute function public.count_likes();
alter table public.profiles enable row level security;
alter table public.generation_requests enable row level security;
alter table public.games enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.moderation_actions enable row level security;
revoke all on public.profiles,public.generation_requests,public.games,public.likes,public.comments,public.moderation_actions from anon,authenticated;
-- O backend acessa essas tabelas exclusivamente com a service_role;
-- a autorização de usuário e de administrador é aplicada no servidor.
