import { supabase } from './supabaseClient';
import type { Foto, Laporan, TindakLanjut } from './types';

type FotoBucket = 'sitrack-foto-kejadian' | 'sitrack-foto-penyerahan';

export const MAX_FOTO_SIZE = 10 * 1024 * 1024; // 10 MB per foto
const FOTO_SIGNED_URL_TTL = 60 * 60 * 24 * 365; // 365 hari
const FOTO_REFRESH_MARGIN_MS = 7 * 24 * 60 * 60 * 1000; // refresh jika sisa < 7 hari
const FOTO_REFRESH_BATCH = 50;

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function validateFotoFile(file: File): string | null {
  const isImage = file.type
    ? file.type.startsWith('image/')
    : /\.(jpe?g|png|gif|webp|heic|heif|bmp|avif)$/i.test(file.name);

  if (!isImage) return `File "${file.name}" bukan gambar.`;
  if (file.size === 0) return `File "${file.name}" kosong.`;
  if (file.size > MAX_FOTO_SIZE) {
    return `File "${file.name}" terlalu besar (${formatFileSize(file.size)}). Maksimal ${formatFileSize(MAX_FOTO_SIZE)} per foto.`;
  }
  return null;
}

function describeStorageError(message: string, bucket: FotoBucket): string {
  if (/bucket not found/i.test(message)) {
    return `Bucket penyimpanan "${bucket}" tidak ditemukan. Hubungi admin.`;
  }
  if (/row-level security|permission|not authorized|unauthorized|403/i.test(message)) {
    return `Akses upload ke "${bucket}" ditolak. Pastikan Anda sudah login dan policy storage mengizinkan upload.`;
  }
  if (/too large|maximum|payload|exceeded/i.test(message)) {
    return `Ukuran foto melebihi batas penyimpanan. Maksimal ${formatFileSize(MAX_FOTO_SIZE)} per foto.`;
  }
  if (/failed to fetch|network|load failed|timeout/i.test(message)) {
    return 'Koneksi ke penyimpanan terputus. Periksa jaringan lalu coba lagi.';
  }
  return message;
}

function parseStorageFotoUrl(url: string): { bucket: string; path: string } | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/storage\/v1\/object\/(?:sign|public|authenticated)\/([^/]+)\/(.+)$/);
    if (!match) return null;
    return {
      bucket: decodeURIComponent(match[1]),
      path: decodeURIComponent(match[2]),
    };
  } catch {
    return null;
  }
}

function isFotoUrlFresh(url: string): boolean {
  try {
    const parsed = new URL(url);
    const token = parsed.searchParams.get('token');
    if (!token) {
      // URL publik/authenticated tidak perlu refresh; signed tanpa token berarti rusak.
      return !parsed.pathname.includes('/object/sign/');
    }

    const payloadPart = token.split('.')[1];
    if (!payloadPart) return false;

    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const payload = JSON.parse(atob(padded)) as { exp?: number };

    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now() + FOTO_REFRESH_MARGIN_MS;
  } catch {
    return false;
  }
}

/**
 * Buat ulang satu signed URL dari URL storage yang tersimpan.
 * Dipakai sebagai fallback saat <img> gagal memuat (mis. token kedaluwarsa).
 */
export async function refreshFotoUrl(url: string): Promise<string | null> {
  const parsed = parseStorageFotoUrl(url);
  if (!parsed) return null;
  if (parsed.bucket !== 'sitrack-foto-kejadian' && parsed.bucket !== 'sitrack-foto-penyerahan') return null;

  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, FOTO_SIGNED_URL_TTL);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Regenerasi signed URL yang sudah kedaluwarsa/hampir kedaluwarsa agar foto
 * tetap tampil di Rekap, Dokumentasi, dan form edit. Jika regenerasi gagal,
 * URL lama dipertahankan supaya data laporan tetap bisa dimuat.
 */
async function refreshLaporanFotos(rows: Laporan[]): Promise<Laporan[]> {
  type Slot = {
    rowIndex: number;
    field: 'foto_kejadian' | 'foto_penyerahan';
    index: number;
    photo: Foto;
    bucket: string;
    path: string;
  };

  const slots: Slot[] = [];

  rows.forEach((row, rowIndex) => {
    (['foto_kejadian', 'foto_penyerahan'] as const).forEach((field) => {
      const photos = Array.isArray(row[field]) ? row[field] : [];
      photos.forEach((photo, index) => {
        if (!photo?.url || isFotoUrlFresh(photo.url)) return;
        const parsed = parseStorageFotoUrl(photo.url);
        if (!parsed) return;
        if (parsed.bucket !== 'sitrack-foto-kejadian' && parsed.bucket !== 'sitrack-foto-penyerahan') return;
        slots.push({ rowIndex, field, index, photo, ...parsed });
      });
    });
  });

  if (!slots.length) return rows;

  const result = rows.map((row) => ({
    ...row,
    foto_kejadian: Array.isArray(row.foto_kejadian) ? [...row.foto_kejadian] : [],
    foto_penyerahan: Array.isArray(row.foto_penyerahan) ? [...row.foto_penyerahan] : [],
  }));

  const byBucket = new Map<string, Slot[]>();
  for (const slot of slots) {
    const list = byBucket.get(slot.bucket) ?? [];
    list.push(slot);
    byBucket.set(slot.bucket, list);
  }

  await Promise.all(
    [...byBucket.entries()].map(async ([bucket, bucketSlots]) => {
      for (let start = 0; start < bucketSlots.length; start += FOTO_REFRESH_BATCH) {
        const batch = bucketSlots.slice(start, start + FOTO_REFRESH_BATCH);
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrls(batch.map((slot) => slot.path), FOTO_SIGNED_URL_TTL);

        if (error || !data) continue;

        data.forEach((item, index) => {
          const slot = batch[index];
          if (!slot || !item?.signedUrl) return;
          result[slot.rowIndex][slot.field][slot.index] = { ...slot.photo, url: item.signedUrl };
        });
      }
    })
  );

  return result;
}

export async function getLaporan(): Promise<Laporan[]> {
  const { data, error } = await supabase
    .from('sitrack_laporan')
    .select('*')
    .order('tanggal', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return refreshLaporanFotos((data ?? []) as Laporan[]);
}

export async function getLaporanByNomor(nomor: string): Promise<Laporan | null> {
  const { data, error } = await supabase
    .from('sitrack_laporan')
    .select('*')
    .eq('nomor', nomor)
    .single();
  if (error) throw error;
  if (!data) return null;
  const [row] = await refreshLaporanFotos([data as Laporan]);
  return row ?? null;
}

export async function getLaporanById(id: string): Promise<Laporan | null> {
  const { data, error } = await supabase
    .from('sitrack_laporan')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  if (!data) return null;
  const [row] = await refreshLaporanFotos([data as Laporan]);
  return row ?? null;
}

export async function insertLaporan(input: {
  laporan: Partial<Laporan>;
  fotoKejadian?: Foto[];
  fotoPenyerahan?: Foto[];
  fotoKejadianDihapus?: string[];
  fotoPenyerahanDihapus?: string[];
}): Promise<{ mode: 'created' | 'updated'; nomor: string; status: TindakLanjut }> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error(`Gagal membaca sesi login: ${sessionError.message}`);
  }

  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error('Sesi login tidak ditemukan. Silakan login ulang sebelum menyimpan laporan.');
  }

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-laporan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      laporan: input.laporan,
      fotoKejadian: input.fotoKejadian,
      fotoPenyerahan: input.fotoPenyerahan,
      fotoKejadianDihapus: input.fotoKejadianDihapus,
      fotoPenyerahanDihapus: input.fotoPenyerahanDihapus,
    }),
  });

  const raw = await res.text();
  let json: any = {};
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    json = { error: raw.slice(0, 300) || `Respons tidak valid (HTTP ${res.status})` };
  }
  if (!res.ok) throw new Error(json.error ?? `Gagal menyimpan laporan (HTTP ${res.status})`);
  return json as { mode: 'created' | 'updated'; nomor: string; status: TindakLanjut };
}

export async function updateStatusLaporan(id: string, tindakLanjut: TindakLanjut): Promise<void> {
  const { error } = await supabase
    .from('sitrack_laporan')
    .update({ tindak_lanjut: tindakLanjut, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

const FOTO_BUCKETS: FotoBucket[] = ['sitrack-foto-kejadian', 'sitrack-foto-penyerahan'];

function describeDeleteError(message: string): string {
  if (/permission denied|row-level security|not authorized|unauthorized|42501|401|403/i.test(message)) {
    return 'Penghapusan ditolak server. Pastikan Anda sudah login dan policy DELETE untuk role authenticated sudah dijalankan di Supabase.';
  }
  if (/failed to fetch|network|load failed|timeout/i.test(message)) {
    return 'Koneksi ke server terputus. Periksa jaringan lalu coba lagi.';
  }
  return message;
}

export interface DeleteLaporanResult {
  /** Jumlah file foto yang berhasil dihapus dari storage. */
  fotoDihapus: number;
  /** Daftar foto yang gagal dihapus beserta alasannya. */
  fotoGagal: string[];
}

/**
 * Hapus SATU laporan (berdasarkan id) beserta foto kejadian & penyerahannya.
 * - Hanya menghapus satu baris, tidak ada operasi hapus massal.
 * - sitrack_counters sengaja tidak disentuh, sehingga nomor laporan yang
 *   sudah dihapus tidak akan dipakai ulang.
 */
export async function deleteLaporan(
  laporan: Pick<Laporan, 'id' | 'nomor' | 'foto_kejadian' | 'foto_penyerahan'>
): Promise<DeleteLaporanResult> {
  // Kumpulkan path storage (bukan URL) supaya file benar-benar terhapus.
  const byBucket = new Map<FotoBucket, Set<string>>();
  for (const field of ['foto_kejadian', 'foto_penyerahan'] as const) {
    const photos = Array.isArray(laporan[field]) ? laporan[field] : [];
    for (const photo of photos) {
      if (!photo?.url) continue;
      const parsed = parseStorageFotoUrl(photo.url);
      if (!parsed) continue;
      const bucket = FOTO_BUCKETS.find((item) => item === parsed.bucket);
      if (!bucket) continue;

      const paths = byBucket.get(bucket) ?? new Set<string>();
      paths.add(parsed.path);
      byBucket.set(bucket, paths);
    }
  }

  // Hapus baris laporan lebih dulu agar data tidak menunjuk ke foto yang
  // sudah hilang jika ternyata penghapusan baris ditolak server.
  const { data, error } = await supabase
    .from('sitrack_laporan')
    .delete()
    .eq('id', laporan.id)
    .select('id');

  if (error) throw new Error(describeDeleteError(error.message));
  if (!data || data.length === 0) {
    throw new Error(`Laporan ${laporan.nomor} tidak ditemukan atau tidak dapat dihapus (akses ditolak).`);
  }

  // Baris sudah terhapus. Bersihkan foto; kegagalan storage dilaporkan
  // sebagai peringatan agar pengguna tahu ada file yang perlu dibersihkan.
  let fotoDihapus = 0;
  const fotoGagal: string[] = [];

  for (const [bucket, paths] of byBucket) {
    const list = [...paths];
    if (!list.length) continue;

    try {
      const { error: storageError } = await supabase.storage.from(bucket).remove(list);
      if (storageError) {
        const reason = describeStorageError(storageError.message, bucket);
        for (const path of list) fotoGagal.push(`${bucket}/${path} — ${reason}`);
        continue;
      }
      fotoDihapus += list.length;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      for (const path of list) fotoGagal.push(`${bucket}/${path} — ${reason}`);
    }
  }

  return { fotoDihapus, fotoGagal };
}

export async function uploadFoto(params: {
  file: File;
  bucket: FotoBucket;
  folder?: string;
}): Promise<Foto> {
  const validation = validateFotoFile(params.file);
  if (validation) throw new Error(validation);

  const safeName = params.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${params.folder ?? 'umum'}/${Date.now()}-${safeName}`;
  const storage = supabase.storage.from(params.bucket);

  const { data, error } = await storage.upload(path, params.file, {
    contentType: params.file.type || undefined,
    upsert: false,
  });
  if (error) throw new Error(describeStorageError(error.message, params.bucket));
  if (!data?.path) throw new Error('Upload selesai, tetapi path file tidak diterima.');

  const { data: signed, error: signError } = await storage.createSignedUrl(data.path, FOTO_SIGNED_URL_TTL);
  if (signError || !signed?.signedUrl) {
    // Jangan tinggalkan file yatim jika URL akses gagal dibuat.
    await storage.remove([data.path]);
    const detail = signError?.message ? `: ${describeStorageError(signError.message, params.bucket)}` : '.';
    throw new Error(`Foto berhasil diunggah, tetapi URL akses gagal dibuat${detail}`);
  }

  return { name: params.file.name, url: signed.signedUrl };
}

export async function getCounter(tahun: number): Promise<number> {
  const { data } = await supabase
    .from('sitrack_counters')
    .select('value')
    .eq('key', `sitrack_counter_local_${tahun}`)
    .single();
  return data?.value ?? 0;
}

export async function incrementCounter(tahun: number): Promise<number> {
  const current = await getCounter(tahun);
  const next = current + 1;
  const { error } = await supabase
    .from('sitrack_counters')
    .upsert({ key: `sitrack_counter_local_${tahun}`, value: next });
  if (error) throw error;
  return next;
}

// ---------- RINGKASAN DASHBOARD (via SQL View) ----------
export async function getDashboardSummary() {
  const { data: statusData } = await supabase.from('v_sitrack_status').select('tindak_lanjut, jumlah');
  const { data: jenisData } = await supabase.from('v_sitrack_jenis_bencana').select('jenis_bencana, jumlah');
  const { data: kecamatanData } = await supabase.from('v_sitrack_kecamatan').select('kecamatan, jumlah');
  const { data: bulanData } = await supabase.from('v_sitrack_bulanan').select('bulan, jumlah');
  return {
    status: (statusData ?? []) as Array<{ tindak_lanjut: string; jumlah: number }>,
    jenis: (jenisData ?? []) as Array<{ jenis_bencana: string; jumlah: number }>,
    kecamatan: (kecamatanData ?? []) as Array<{ kecamatan: string; jumlah: number }>,
    bulan: (bulanData ?? []) as Array<{ bulan: string; jumlah: number }>,
  };
}
