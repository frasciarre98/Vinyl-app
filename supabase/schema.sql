-- 1. Reset (Opzionale, pulisce tutto)
drop table if exists vinyls;

-- 2. Ricrea tabella vinyls con il nuovo campo "group_members"
create table vinyls (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  image_url text,
  artist text,
  title text,
  genre text,
  year text,
  condition text,
  tracks text,
  notes text,
  group_members text, -- Nuovo campo richiesto
  original_filename text, -- Per evitare duplicati
  format text default 'Vinyl' -- Supporto (Vinyl, CD)
);

-- 3. Abilita RLS
alter table vinyls enable row level security;

-- 4. Rimuovi vecchie policy per evitare errori di conflitti
drop policy if exists "Public view" on vinyls;
drop policy if exists "Public insert" on vinyls;
drop policy if exists "Public update" on vinyls;
drop policy if exists "Public delete" on vinyls;

-- 5. Crea nuove policy pubbliche
create policy "Public view" on vinyls for select using (true);
create policy "Public insert" on vinyls for insert with check (true);
create policy "Public update" on vinyls for update using (true);
create policy "Public delete" on vinyls for delete using (true);

-- 6. Configura Storage Bucket
insert into storage.buckets (id, name, public) 
values ('covers', 'covers', true)
on conflict (id) do update set public = true;

-- 7. Rimuovi vecchie policy storage
drop policy if exists "Cover images are publicly accessible" on storage.objects;
drop policy if exists "Anyone can upload cover images" on storage.objects;

-- 8. Crea nuove policy storage pubbliche
create policy "Cover images are publicly accessible" on storage.objects
  for select using (bucket_id = 'covers');

create policy "Anyone can upload cover images" on storage.objects
  for insert with check (bucket_id = 'covers');
