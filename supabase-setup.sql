-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  image_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text not null,
  user_avatar text,
  content text not null,
  created_at timestamptz not null default now()
);

create index comments_image_id_idx on public.comments (image_id);

-- Enable Row Level Security so people can only act on their own comments
alter table public.comments enable row level security;

-- Anyone (including logged-out visitors) can read comments
create policy "Comments are viewable by everyone"
on public.comments for select
using (true);

-- Only a logged-in user can insert a comment, and only as themselves
create policy "Users can insert their own comments"
on public.comments for insert
to authenticated
with check (auth.uid() = user_id);

-- Only the comment's author can delete it
create policy "Users can delete their own comments"
on public.comments for delete
to authenticated
using (auth.uid() = user_id);

-- ---------------------------------------------------
-- Likes
-- ---------------------------------------------------

create table public.likes (
  id uuid primary key default gen_random_uuid(),
  image_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (image_id, user_id)
);

create index likes_image_id_idx on public.likes (image_id);

alter table public.likes enable row level security;

-- Anyone can see like counts
create policy "Likes are viewable by everyone"
on public.likes for select
using (true);

-- A user can only like as themselves
create policy "Users can like as themselves"
on public.likes for insert
to authenticated
with check (auth.uid() = user_id);

-- A user can only unlike their own like
create policy "Users can remove their own like"
on public.likes for delete
to authenticated
using (auth.uid() = user_id);

-- ---------------------------------------------------
-- Gallery images (owner-managed uploads)
-- ---------------------------------------------------
-- IMPORTANT: replace the email below with the site owner's real Google
-- account email BEFORE running this section. This is what restricts
-- uploading/deleting photos to her account only.

create table public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  storage_path text not null,
  caption text,
  created_at timestamptz not null default now()
);

alter table public.gallery_images enable row level security;

create policy "Gallery images are viewable by everyone"
on public.gallery_images for select
using (true);

create policy "Only the owner can add gallery images"
on public.gallery_images for insert
to authenticated
with check (auth.jwt() ->> 'email' = 'mphtech20@gmail.com');

create policy "Only the owner can delete gallery images"
on public.gallery_images for delete
to authenticated
using (auth.jwt() ->> 'email' = 'mphtech20@gmail.com');

-- Storage bucket policies.
-- Before running this part: go to Supabase Dashboard -> Storage -> New bucket
-- -> name it exactly "gallery" -> toggle "Public bucket" ON -> Create.
-- Then run the policies below (with your email swapped in again).

create policy "Owner can upload to gallery bucket"
on storage.objects for insert
to authenticated
with check (bucket_id = 'gallery' and auth.jwt() ->> 'email' = 'mphtech20@gmail.com');

create policy "Owner can delete from gallery bucket"
on storage.objects for delete
to authenticated
using (bucket_id = 'gallery' and auth.jwt() ->> 'email' = 'mphtech20@gmail.com');

create policy "Anyone can view gallery bucket files"
on storage.objects for select
using (bucket_id = 'gallery');

-- ---------------------------------------------------
-- Manual ordering + caption editing for gallery images
-- ---------------------------------------------------

alter table public.gallery_images add column sort_order integer;

-- Give existing rows an initial order based on when they were added
with ordered as (
  select id, row_number() over (order by created_at asc) as rn
  from public.gallery_images
)
update public.gallery_images g
set sort_order = ordered.rn
from ordered
where g.id = ordered.id;

-- Owner can edit captions and reorder (update sort_order)
create policy "Only the owner can update gallery images"
on public.gallery_images for update
to authenticated
using (auth.jwt() ->> 'email' = 'mphtech20@gmail.com')
with check (auth.jwt() ->> 'email' = 'mphtech20@gmail.com');

-- ---------------------------------------------------
-- Add a second trusted admin email
-- ---------------------------------------------------
-- This replaces the single-email checks above with a check against
-- either account. Run this whole section as-is (it drops and recreates
-- the relevant policies, so it's safe to run even though the old ones
-- already exist).

drop policy if exists "Only the owner can add gallery images" on public.gallery_images;
drop policy if exists "Only the owner can delete gallery images" on public.gallery_images;
drop policy if exists "Only the owner can update gallery images" on public.gallery_images;
drop policy if exists "Owner can upload to gallery bucket" on storage.objects;
drop policy if exists "Owner can delete from gallery bucket" on storage.objects;

create policy "Only the owner can add gallery images"
on public.gallery_images for insert
to authenticated
with check (auth.jwt() ->> 'email' in ('mphtech20@gmail.com', 'lesedimonareng32@gmail.com'));

create policy "Only the owner can delete gallery images"
on public.gallery_images for delete
to authenticated
using (auth.jwt() ->> 'email' in ('mphtech20@gmail.com', 'lesedimonareng32@gmail.com'));

create policy "Only the owner can update gallery images"
on public.gallery_images for update
to authenticated
using (auth.jwt() ->> 'email' in ('mphtech20@gmail.com', 'lesedimonareng32@gmail.com'))
with check (auth.jwt() ->> 'email' in ('mphtech20@gmail.com', 'lesedimonareng32@gmail.com'));

create policy "Owner can upload to gallery bucket"
on storage.objects for insert
to authenticated
with check (bucket_id = 'gallery' and auth.jwt() ->> 'email' in ('mphtech20@gmail.com', 'lesedimonareng32@gmail.com'));

create policy "Owner can delete from gallery bucket"
on storage.objects for delete
to authenticated
using (bucket_id = 'gallery' and auth.jwt() ->> 'email' in ('mphtech20@gmail.com', 'lesedimonareng32@gmail.com'));
