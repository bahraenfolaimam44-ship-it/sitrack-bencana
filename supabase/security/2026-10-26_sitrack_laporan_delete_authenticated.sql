-- =====================================================================
-- SI-TRACK BENCANA — Izin hapus SATU laporan untuk role authenticated
-- File: 2026-10-26_sitrack_laporan_delete_authenticated.sql
-- BPBD Kota Ambon
--
-- LATAR BELAKANG
--   Migrasi pengamanan sebelumnya (sitrack-rls-blokir-delete-anon.sql /
--   2026-10-25_harden_sitrack_laporan_delete.sql) sudah men-drop policy
--   DELETE dan mencabut privilege DELETE dari anon + authenticated.
--   Pemeriksaan langsung ke project Supabase menunjukkan DELETE oleh anon
--   ditolak dengan kode 42501 "permission denied for table sitrack_laporan".
--   Karena itu tombol "Hapus" di frontend perlu izin baru yang terbatas.
--
-- FILE INI
--   1. Menghapus SEMUA policy DELETE lama pada public.sitrack_laporan.
--   2. Memberi privilege DELETE HANYA kepada role authenticated.
--   3. Membuat policy DELETE hanya untuk role authenticated (anon tetap
--      tidak memiliki akses DELETE).
--   4. Menolak hapus massal: satu perintah DELETE maksimal 1 baris.
--   5. Memastikan role authenticated boleh menghapus objek foto pada dua
--      bucket agar foto kejadian & penyerahan ikut terhapus.
--
-- CATATAN NOMOR LAPORAN
--   File ini TIDAK menyentuh public.sitrack_counters. Nomor laporan yang
--   sudah dihapus tidak akan dipakai ulang karena next_sitrack_nomor()
--   memakai counter yang tidak diturunkan dan menghitung
--   greatest(counter + 1, nomor tertinggi yang masih ada + 1).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Pastikan RLS tetap aktif
-- ---------------------------------------------------------------------
alter table public.sitrack_laporan enable row level security;

-- ---------------------------------------------------------------------
-- 2. Hapus semua policy DELETE yang ada (termasuk policy anon lama)
-- ---------------------------------------------------------------------
do $$
declare
  v_policy record;
begin
  for v_policy in
    select polname
    from pg_policy
    where polrelid = 'public.sitrack_laporan'::regclass
      and polcmd = 'd'
  loop
    execute format('drop policy %I on public.sitrack_laporan', v_policy.polname);
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- 3. Privilege: anon ditolak, authenticated diizinkan
-- ---------------------------------------------------------------------
revoke delete, truncate on public.sitrack_laporan from anon;
revoke delete, truncate on public.sitrack_laporan from public;
grant delete on public.sitrack_laporan to authenticated;

-- ---------------------------------------------------------------------
-- 4. Policy DELETE: hanya role authenticated dan hanya user yang login
-- ---------------------------------------------------------------------
create policy "sitrack_laporan_delete_authenticated"
  on public.sitrack_laporan
  for delete
  to authenticated
  using (auth.role() = 'authenticated' and auth.uid() is not null);

-- ---------------------------------------------------------------------
-- 5. Pengaman hapus massal: satu statement DELETE maksimal 1 baris.
--    service_role/postgres (Edge Function/admin) dikecualikan untuk
--    kebutuhan pemeliharaan.
-- ---------------------------------------------------------------------
create or replace function public.sitrack_laporan_single_delete_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_jumlah bigint;
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return null;
  end if;

  select count(*) into v_jumlah from old_rows;

  if v_jumlah > 1 then
    raise exception 'Hapus satu laporan per permintaan. Penghapusan massal tidak diizinkan.'
      using errcode = 'P0001';
  end if;

  return null;
end;
$$;

revoke all on function public.sitrack_laporan_single_delete_guard() from public;
revoke all on function public.sitrack_laporan_single_delete_guard() from anon, authenticated;

drop trigger if exists trg_sitrack_laporan_single_delete on public.sitrack_laporan;
create trigger trg_sitrack_laporan_single_delete
  after delete on public.sitrack_laporan
  referencing old table as old_rows
  for each statement
  execute function public.sitrack_laporan_single_delete_guard();

-- ---------------------------------------------------------------------
-- 6. Storage: foto kejadian & penyerahan boleh dihapus oleh authenticated
--    agar file di bucket ikut bersih saat laporan dihapus.
-- ---------------------------------------------------------------------
drop policy if exists "sitrack_foto_delete_authenticated" on storage.objects;
create policy "sitrack_foto_delete_authenticated"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id in ('sitrack-foto-kejadian', 'sitrack-foto-penyerahan'));

-- =====================================================================
-- VERIFIKASI (opsional, jalankan manual setelah migrasi)
--
--   -- Harus ada tepat 1 policy DELETE untuk role authenticated.
--   select polname, polcmd, polroles::regrole[]
--   from pg_policy
--   where polrelid = 'public.sitrack_laporan'::regclass
--     and polcmd = 'd';
--
--   -- Harus GAGAL / 0 baris: anon tidak punya privilege DELETE.
--   set role anon;
--   delete from public.sitrack_laporan where id = '00000000-0000-4000-8000-000000000000';
--   reset role;
-- =====================================================================
