import { useEffect, useState, type FormEvent } from 'react';
import { getLaporanById, insertLaporan, uploadFoto, formatFileSize, MAX_FOTO_SIZE, validateFotoFile } from '../lib/api';
import { isoToWitaInput, witaInputToIso } from '../lib/date';
import type { Foto, Korban, Kebutuhan, TindakLanjut } from '../lib/types';
import CoordinateMap from '../components/CoordinateMap';

const EMPTY_COORD_STATUS = 'Belum ada koordinat yang ditampilkan.';

function parseCoordinate(latText: string, lngText: string) {
  const latValue = Number(latText);
  const lngValue = Number(lngText);
  const latFilled = latText.trim() !== '';
  const lngFilled = lngText.trim() !== '';
  const latValid = latFilled && Number.isFinite(latValue) && latValue >= -90 && latValue <= 90;
  const lngValid = lngFilled && Number.isFinite(lngValue) && lngValue >= -180 && lngValue <= 180;
  return { latValue, lngValue, latFilled, lngFilled, valid: latValid && lngValid };
}

const AMBON_WILAYAH: Record<string, string[]> = {
  Baguala: ['Desa Waiheru', 'Desa Nania', 'Desa Negeri Lama', 'Negeri Passo', 'Kelurahan Lateri', 'Desa Latta', 'Negeri Halong'],
  'Leitimur Selatan': ['Negeri Hatalai', 'Negeri Naku', 'Negeri Kilang', 'Negeri Ema', 'Negeri Hukurila', 'Negeri Hutumuri', 'Negeri Rutong', 'Negeri Leahari'],
  Nusaniwe: ['Kelurahan Silale', 'Kelurahan Urimessing', 'Kelurahan Benteng', 'Kelurahan Wainitu', 'Kelurahan Kudamati', 'Kelurahan Waihaong', 'Kelurahan Mangga Dua', 'Kelurahan Nusaniwe', 'Negeri Amahusu', 'Negeri Nusaniwe', 'Negeri Urimessing', 'Negeri Latuhalat', 'Negeri Seilale'],
  Sirimau: ['Kelurahan Waihoka', 'Kelurahan Amantelu', 'Kelurahan Rijali', 'Kelurahan Karang Panjang', 'Kelurahan Batu Meja', 'Kelurahan Batu Gajah', 'Kelurahan Ahusen', 'Kelurahan Honipopu', 'Kelurahan Uritetu', 'Kelurahan Pandan Kasturi', 'Desa Galala', 'Negeri Hative Kecil', 'Negeri Batu Merah', 'Negeri Soya'],
  'Teluk Ambon': ['Negeri Laha', 'Negeri Tawiri', 'Negeri Hative Besar', 'Desa Wayame', 'Negeri Rumah Tiga', 'Kelurahan Tihu', 'Desa Poka', 'Desa Hunuth/Durian Patah'],
};

const TYPES: Record<string, string[]> = {
  'Bencana Geologis / Aktivitas Bumi': ['Gempa Bumi', 'Tsunami', 'Letusan Gunung Api', 'Tanah Longsor'],
  'Bencana Hidrometeorologi / Cuaca dan Iklim': ['Banjir', 'Cuaca Ekstrem', 'Gelombang Ekstrem / Gelombang Pasang dan Abrasi', 'Kekeringan', 'Kebakaran Hutan dan Lahan'],
};

const CUACA_OPTIONS = ['Angin Kencang', 'Hujan Lebat', 'Petir / Petir disertai angin', 'Gelombang Tinggi', 'Pohon Tumbang', 'Lainnya'];

const KEBUTUHAN_LIST = ['Terpal 3×4', 'Terpal 4×6', 'Terpal 5×7', 'Terpal 6×8', 'Terpal 8×10', 'Gerobak', 'Sekop', 'Karung', 'Garu-garu', 'Cangkul', 'Linggis', 'Tikar', 'Karpet Alas', 'Lainnya'];

interface Props {
  editingId: string | null;
  onSaved: () => void;
}

export default function Input({ editingId, onSaved }: Props) {
  const [statusBencana, setStatusBencana] = useState('');
  const [kategoriBencana, setKategoriBencana] = useState('');
  const [jenis, setJenis] = useState('');
  const [kejadianCuaca, setKejadianCuaca] = useState('');
  const [tanggal, setTanggal] = useState('');
  const [kecamatan, setKecamatan] = useState('');
  const [kelurahan, setKelurahan] = useState('');
  const [lokasi, setLokasi] = useState('');
  const [keteranganKejadian, setKeteranganKejadian] = useState('');
  const [rt, setRt] = useState('');
  const [rw, setRw] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [dampakKategori, setDampakKategori] = useState('');
  const [tingkatKerusakan, setTingkatKerusakan] = useState('');
  const [dampakKeterangan, setDampakKeterangan] = useState('');
  const [pelapor, setPelapor] = useState('');
  const [petugas, setPetugas] = useState('Admin BPBD');
  const [statusLaporan, setStatusLaporan] = useState<TindakLanjut>('Belum Ditangani');
  const [korban, setKorban] = useState<Korban[]>([{ nama: '', jiwa: 0, kondisi: 'Tidak Ada Korban', keterangan: '' }]);
  const [kebutuhan, setKebutuhan] = useState<Kebutuhan[]>([{ nama: 'Terpal 3×4', jumlah: 0, keterangan: '' }]);
  const [fotoKejadian, setFotoKejadian] = useState<Foto[]>([]);
  const [fotoPenyerahan, setFotoPenyerahan] = useState<Foto[]>([]);
  const [fotoKejadianDihapus, setFotoKejadianDihapus] = useState<string[]>([]);
  const [fotoPenyerahanDihapus, setFotoPenyerahanDihapus] = useState<string[]>([]);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingJenis, setUploadingJenis] = useState<'kejadian' | 'penyerahan' | null>(null);
  const [uploadProgress, setUploadProgress] = useState('');
  const [editingNomor, setEditingNomor] = useState('');
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [editReady, setEditReady] = useState(false);
  const [coordStatus, setCoordStatus] = useState(EMPTY_COORD_STATUS);
  const [showMap, setShowMap] = useState(false);
  const [mapLat, setMapLat] = useState<number | null>(null);
  const [mapLng, setMapLng] = useState<number | null>(null);

  useEffect(() => {
    if (!editingId) {
      resetFormState();
      return;
    }

    let cancelled = false;
    resetFormState();
    setLoadingEdit(true);
    setMsg('Memuat data laporan...');

    getLaporanById(editingId)
      .then((x) => {
        if (cancelled) return;
        if (!x) {
          setMsg('Data laporan yang akan diedit tidak ditemukan.');
          return;
        }
        setEditingNomor(x.nomor);
        setStatusBencana(x.status_bencana);
        setKategoriBencana(x.kategori_bencana);
        setJenis(x.jenis_bencana || '');
        setKejadianCuaca(x.kejadian_cuaca || '');
        setTanggal(isoToWitaInput(x.tanggal));
        setKecamatan(x.kecamatan);
        setKelurahan(x.kelurahan || '');
        setLokasi(x.lokasi || '');
        setKeteranganKejadian(x.keterangan_kejadian || '');
        setRt(x.rt || '');
        setRw(x.rw || '');
        setLat(x.lat != null ? String(x.lat) : '');
        setLng(x.lng != null ? String(x.lng) : '');
        setDampakKategori(x.dampak_kategori || '');
        setTingkatKerusakan(x.tingkat_kerusakan || '');
        setDampakKeterangan(x.dampak_keterangan || '');
        setPelapor(x.pelapor || '');
        setPetugas(x.petugas || 'Admin BPBD');
        setStatusLaporan(x.tindak_lanjut);
        setKorban(x.korban?.length ? x.korban : [{ nama: '', jiwa: 0, kondisi: 'Tidak Ada Korban', keterangan: '' }]);
        setKebutuhan(x.kebutuhan?.length ? x.kebutuhan : [{ nama: 'Terpal 3×4', jumlah: 0, keterangan: '' }]);
        setFotoKejadian(Array.isArray(x.foto_kejadian) ? x.foto_kejadian : []);
        setFotoPenyerahan(Array.isArray(x.foto_penyerahan) ? x.foto_penyerahan : []);
        setFotoKejadianDihapus([]);
        setFotoPenyerahanDihapus([]);
        setMsg('');
        setEditReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setEditReady(false);
          setMsg('Gagal memuat data laporan untuk diedit.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingEdit(false);
      });

    return () => {
      cancelled = true;
    };
  }, [editingId]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [editingId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const parsed = parseCoordinate(lat, lng);
      if (!parsed.latFilled && !parsed.lngFilled) {
        setShowMap(false);
        setMapLat(null);
        setMapLng(null);
        setCoordStatus(EMPTY_COORD_STATUS);
        return;
      }
      if (!parsed.valid) {
        setShowMap(false);
        setMapLat(null);
        setMapLng(null);
        setCoordStatus(
          !parsed.latFilled || !parsed.lngFilled
            ? 'Lengkapi Latitude dan Longitude agar lokasi dapat ditampilkan.'
            : 'Koordinat belum valid. Latitude harus -90 s/d 90 dan Longitude -180 s/d 180.'
        );
        return;
      }
      setMapLat(parsed.latValue);
      setMapLng(parsed.lngValue);
      setShowMap(true);
      setCoordStatus(`Lokasi ditampilkan: ${parsed.latValue.toFixed(7)}, ${parsed.lngValue.toFixed(7)}`);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [lat, lng]);

  function onKategoriChange(k: string) {
    setKategoriBencana(k);
    setJenis('');
    setKejadianCuaca('');
  }

  function onJenisChange(j: string) {
    setJenis(j);
    setKejadianCuaca('');
  }

  function onDampakChange(d: string) {
    setDampakKategori(d);
    if (d === 'Tidak Ada Dampak') {
      setTingkatKerusakan('');
      setDampakKeterangan('');
    }
  }

  function updateVictim(i: number, patch: Partial<Korban>) {
    setKorban((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }

  function removeVictim(i: number) {
    setKorban((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateNeed(i: number, patch: Partial<Kebutuhan>) {
    setKebutuhan((prev) => prev.map((n, idx) => (idx === i ? { ...n, ...patch } : n)));
  }

  function removeNeed(i: number) {
    setKebutuhan((prev) => prev.filter((_, idx) => idx !== i));
  }

  function removeFotoKejadian(i: number) {
    const removed = fotoKejadian[i];
    setFotoKejadian((prev) => prev.filter((_, idx) => idx !== i));
    if (removed?.url) {
      setFotoKejadianDihapus((prev) => (prev.includes(removed.url) ? prev : [...prev, removed.url]));
    }
  }

  function removeFotoPenyerahan(i: number) {
    const removed = fotoPenyerahan[i];
    setFotoPenyerahan((prev) => prev.filter((_, idx) => idx !== i));
    if (removed?.url) {
      setFotoPenyerahanDihapus((prev) => (prev.includes(removed.url) ? prev : [...prev, removed.url]));
    }
  }

  function describeUploadError(err: unknown): string {
    const message = err instanceof Error ? err.message : String(err);
    if (/failed to fetch|network|load failed|timeout/i.test(message)) {
      return 'Koneksi terputus. Periksa jaringan lalu coba lagi.';
    }
    return message;
  }

  function validateFotoFiles(files: File[]): { valid: File[]; errors: string[] } {
    const valid: File[] = [];
    const errors: string[] = [];
    for (const file of files) {
      const error = validateFotoFile(file);
      if (error) errors.push(error);
      else valid.push(file);
    }
    return { valid, errors };
  }

  async function uploadFotoFiles(
    files: File[],
    bucket: 'sitrack-foto-kejadian' | 'sitrack-foto-penyerahan',
    label: string
  ): Promise<{ berhasil: Foto[]; errors: string[] }> {
    const berhasil: Foto[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(`Mengunggah ${label.toLowerCase()} ${i + 1}/${files.length}...`);
      try {
        const foto = await uploadFoto({
          file,
          bucket,
          folder: editingId ? `edit/${editingId}` : 'baru',
        });
        berhasil.push(foto);
      } catch (err) {
        errors.push(`${file.name}: ${describeUploadError(err)}`);
      }
    }

    return { berhasil, errors };
  }

  async function handleFotoUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    jenis: 'kejadian' | 'penyerahan',
    bucket: 'sitrack-foto-kejadian' | 'sitrack-foto-penyerahan'
  ) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length || uploadingJenis) return;

    const { valid, errors: validationErrors } = validateFotoFiles(files);
    if (!valid.length) {
      setMsg(validationErrors.join(' '));
      return;
    }

    const label = jenis === 'kejadian' ? 'Foto kejadian' : 'Foto penyerahan';
    setUploadingJenis(jenis);
    try {
      const { berhasil, errors } = await uploadFotoFiles(valid, bucket, label);

      if (berhasil.length) {
        if (jenis === 'kejadian') setFotoKejadian((prev) => [...prev, ...berhasil]);
        else setFotoPenyerahan((prev) => [...prev, ...berhasil]);
      }

      const allErrors = [...validationErrors, ...errors];
      if (allErrors.length) {
        setMsg(`${label}: ${berhasil.length} berhasil, ${allErrors.length} gagal. ${allErrors.join(' | ')}`);
      } else {
        setMsg(`${label}: ${berhasil.length} berhasil diunggah.`);
      }
    } catch (err) {
      setMsg(`${label}: gagal mengunggah. ${describeUploadError(err)}`);
    } finally {
      setUploadingJenis(null);
      setUploadProgress('');
    }
  }

  async function onFotoKejadianChange(e: React.ChangeEvent<HTMLInputElement>) {
    await handleFotoUpload(e, 'kejadian', 'sitrack-foto-kejadian');
  }

  async function onFotoPenyerahanChange(e: React.ChangeEvent<HTMLInputElement>) {
    await handleFotoUpload(e, 'penyerahan', 'sitrack-foto-penyerahan');
  }

  function showCoordinate() {
    const parsed = parseCoordinate(lat, lng);
    if (!parsed.latFilled || !parsed.lngFilled) {
      setShowMap(false);
      setCoordStatus('Lengkapi Latitude dan Longitude agar lokasi dapat ditampilkan.');
      return;
    }
    if (!parsed.valid) {
      setShowMap(false);
      setCoordStatus('Koordinat tidak valid.');
      return;
    }
    setMapLat(parsed.latValue);
    setMapLng(parsed.lngValue);
    setShowMap(true);
    setCoordStatus(`Lokasi ditampilkan: ${parsed.latValue.toFixed(7)}, ${parsed.lngValue.toFixed(7)}`);
  }

  function pickCoordinate(newLat: number, newLng: number) {
    setLat(String(newLat));
    setLng(String(newLng));
    setMapLat(newLat);
    setMapLng(newLng);
    setShowMap(true);
    setCoordStatus(`Lokasi ditampilkan: ${newLat.toFixed(7)}, ${newLng.toFixed(7)}`);
  }

  function resetCoordinate() {
    setLat('');
    setLng('');
    setCoordStatus(EMPTY_COORD_STATUS);
    setShowMap(false);
    setMapLat(null);
    setMapLng(null);
  }

  function resetFormState() {
    setStatusBencana('');
    setKategoriBencana('');
    setJenis('');
    setKejadianCuaca('');
    setTanggal('');
    setKecamatan('');
    setKelurahan('');
    setLokasi('');
    setKeteranganKejadian('');
    setRt('');
    setRw('');
    setLat('');
    setLng('');
    setCoordStatus(EMPTY_COORD_STATUS);
    setShowMap(false);
    setMapLat(null);
    setMapLng(null);
    setDampakKategori('');
    setTingkatKerusakan('');
    setDampakKeterangan('');
    setPelapor('');
    setPetugas('Admin BPBD');
    setStatusLaporan('Belum Ditangani');
    setKorban([{ nama: '', jiwa: 0, kondisi: 'Tidak Ada Korban', keterangan: '' }]);
    setKebutuhan([{ nama: 'Terpal 3×4', jumlah: 0, keterangan: '' }]);
    setFotoKejadian([]);
    setFotoPenyerahan([]);
    setFotoKejadianDihapus([]);
    setFotoPenyerahanDihapus([]);
    setEditingNomor('');
    setMsg('');
    setSaving(false);
    setLoadingEdit(false);
    setEditReady(false);
    setUploadingJenis(null);
    setUploadProgress('');
  }

  function onCancel() {
    resetFormState();
    onSaved();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (editingId && (!editReady || loadingEdit)) {
      setMsg('Tunggu sampai data laporan selesai dimuat sebelum menyimpan perubahan.');
      return;
    }

    const missing = [
      !statusBencana && 'Status Bencana',
      !kategoriBencana && 'Kategori Bencana',
      !jenis && 'Jenis Bencana',
      !tanggal && 'Tanggal & Waktu (WIT)',
      !kecamatan && 'Kecamatan',
      !lokasi.trim() && 'Lokasi Kejadian',
      !dampakKategori && 'Kategori Dampak',
      !pelapor.trim() && 'Nama Pelapor',
      !petugas.trim() && 'Petugas Input',
    ].filter(Boolean);

    if (missing.length) {
      setMsg(`Lengkapi field wajib berikut: ${missing.join(', ')}.`);
      return;
    }

    const tanggalIso = witaInputToIso(tanggal);
    if (tanggal && !tanggalIso) {
      setMsg('Tanggal & Waktu tidak valid. Periksa kembali.');
      return;
    }

    setSaving(true);
    setMsg('Menyimpan laporan...');

    try {
      const t = korban.reduce(
        (acc, k) => ({
          kk: acc.kk + 1,
          jiwa: acc.jiwa + Number(k.jiwa || 0),
          meninggal: acc.meninggal + (k.kondisi === 'Meninggal Dunia' ? Number(k.jiwa || 0) : 0),
          luka: acc.luka + (k.kondisi === 'Luka-luka' ? Number(k.jiwa || 0) : 0),
          hilang: acc.hilang + (k.kondisi === 'Hilang' ? Number(k.jiwa || 0) : 0),
          mengungsi: acc.mengungsi + (k.kondisi === 'Mengungsi' ? Number(k.jiwa || 0) : 0),
        }),
        { kk: 0, jiwa: 0, meninggal: 0, luka: 0, hilang: 0, mengungsi: 0 }
      );
      const laporan: any = {
        ...(editingId ? { id: editingId, ...(editingNomor ? { nomor: editingNomor } : {}) } : {}),
        status_bencana: statusBencana,
        kategori_bencana: kategoriBencana,
        jenis_bencana: jenis || null,
        kejadian_cuaca: kejadianCuaca || null,
        tanggal: tanggalIso,
        kecamatan,
        kelurahan,
        lokasi,
        keterangan_kejadian: keteranganKejadian || null,
        rt,
        rw,
        rt_rw: rt && rw ? `${rt}/${rw}` : null,
        lat: lat ? Number(lat) : null,
        lng: lng ? Number(lng) : null,
        korban,
        kebutuhan,
        total_kk: t.kk,
        total_jiwa: t.jiwa,
        total_meninggal: t.meninggal,
        total_luka: t.luka,
        total_hilang: t.hilang,
        total_mengungsi: t.mengungsi,
        dampak_kategori: dampakKategori || null,
        tingkat_kerusakan: dampakKategori === 'Tidak Ada Dampak' ? null : tingkatKerusakan || null,
        dampak_keterangan: dampakKategori === 'Tidak Ada Dampak' ? null : dampakKeterangan || null,
        tindak_lanjut: statusLaporan,
        pelapor,
        petugas,
      };
      const { mode, nomor } = await insertLaporan({
        laporan,
        fotoKejadian,
        fotoPenyerahan,
        fotoKejadianDihapus,
        fotoPenyerahanDihapus,
      });
      setMsg(`Laporan ${nomor} berhasil ${mode === 'updated' ? 'diperbarui' : 'disimpan'}.`);
      onSaved();
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setMsg(`Gagal menyimpan laporan: ${detail}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="section">
      <h2>{editingId ? '✏️ Edit Laporan Kejadian' : '➕ Input Laporan Kejadian'}</h2>
      {editingId && (
        <div className="notice">
          {loadingEdit ? (
            <>⏳ Memuat seluruh data laporan <b>{editingNomor || editingId}</b>...</>
          ) : (
            <>
              Mode edit laporan <b>{editingNomor || editingId}</b>. Semua data yang pernah diinput sudah dimuat dan bisa diubah.
              Klik <b>Batal Edit</b> jika tidak ingin menyimpan perubahan.
            </>
          )}
          <div className="toolbar" style={{ marginTop: 10 }}>
            <button
              className="btn gray"
              type="button"
              onClick={onCancel}
              disabled={saving || uploadingJenis !== null}
              title="Batalkan perubahan dan kembali ke daftar"
              aria-label="Batalkan perubahan dan kembali ke daftar"
            >
              ✖ Batal Edit
            </button>
          </div>
        </div>
      )}
      <form id="form" onSubmit={onSubmit} noValidate>
        <div className="formgrid">
          <div>
            <label>Status Bencana *</label>
            <select id="statusBencana" value={statusBencana} onChange={(e) => setStatusBencana(e.target.value)}>
              <option value="">Pilih status</option>
              <option>Kejadian Bencana</option>
              <option>Ancaman/Antisipasi Bencana</option>
            </select>
          </div>
          <div>
            <label>Kategori Bencana *</label>
            <select id="kategoriBencana" value={kategoriBencana} onChange={(e) => onKategoriChange(e.target.value)}>
              <option value="">Pilih kategori</option>
              <option>Bencana Geologis / Aktivitas Bumi</option>
              <option>Bencana Hidrometeorologi / Cuaca dan Iklim</option>
            </select>
          </div>
          <div>
            <label>Jenis Bencana *</label>
            <select id="jenis" value={jenis} onChange={(e) => onJenisChange(e.target.value)} disabled={!TYPES[kategoriBencana]?.length}>
              <option value="">{TYPES[kategoriBencana]?.length ? 'Pilih jenis' : 'Pilih kategori terlebih dahulu'}</option>
              {TYPES[kategoriBencana]?.map((x) => <option key={x}>{x}</option>)}
            </select>
          </div>
          <div className={jenis === 'Cuaca Ekstrem' ? 'full' : 'full hidden'}>
            <label>Kejadian/Dampak Cuaca Ekstrem</label>
            <select id="kejadianCuaca" value={kejadianCuaca} onChange={(e) => setKejadianCuaca(e.target.value)}>
              <option value="">Tidak ada</option>
              {CUACA_OPTIONS.map((x) => <option key={x}>{x}</option>)}
            </select>
          </div>
          <div>
            <label>Tanggal & Waktu (WIT) *</label>
            <input id="tanggal" type="datetime-local" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
          </div>
          <div>
            <label>Kecamatan *</label>
            <select id="kecamatan" value={kecamatan} onChange={(e) => { setKecamatan(e.target.value); setKelurahan(''); }}>
              <option value="">Pilih Kecamatan</option>
              {Object.keys(AMBON_WILAYAH).map((k) => <option key={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label>Desa/Negeri/Kelurahan</label>
            <select id="kelurahan" value={kelurahan} onChange={(e) => setKelurahan(e.target.value)} disabled={!AMBON_WILAYAH[kecamatan]?.length}>
              <option value="">{AMBON_WILAYAH[kecamatan]?.length ? 'Pilih Desa/Negeri/Kelurahan' : 'Pilih Kecamatan terlebih dahulu'}</option>
              {AMBON_WILAYAH[kecamatan]?.map((x) => <option key={x}>{x}</option>)}
            </select>
          </div>
          <div className="full">
            <label>Lokasi Kejadian *</label>
            <input id="lokasi" value={lokasi} onChange={(e) => setLokasi(e.target.value)} placeholder="Detail lokasi kejadian, seperti nama jalan, gang, atau bangunan" />
          </div>
          <div className="full">
            <label>Keterangan Kejadian</label>
            <textarea id="keteranganKejadian" value={keteranganKejadian} onChange={(e) => setKeteranganKejadian(e.target.value)} placeholder="Tuliskan kronologi kejadian secara ringkas dan jelas" />
          </div>
          <div>
            <label>RT</label>
            <input id="rt" inputMode="numeric" value={rt} onChange={(e) => setRt(e.target.value)} placeholder="Contoh: 01" />
          </div>
          <div>
            <label>RW</label>
            <input id="rw" inputMode="numeric" value={rw} onChange={(e) => setRw(e.target.value)} placeholder="Contoh: 02" />
          </div>
          <div className="full">
            <div className="section" style={{ marginTop: 0 }}>
              <h3>📍 Titik Koordinat Kejadian</h3>
              <div className="notice">Masukkan koordinat lokasi kejadian secara manual. SI-TRACK tidak mengambil lokasi perangkat/GPS. Peta akan otomatis mengikuti koordinat yang valid, dan Anda juga bisa mengklik peta atau menggeser penanda untuk menyesuaikan titik.</div>
              <div className="formgrid">
                <div>
                  <label>Latitude</label>
                  <input id="lat" type="number" step="any" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="Contoh: -3.695000" />
                </div>
                <div>
                  <label>Longitude</label>
                  <input id="lng" type="number" step="any" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="Contoh: 128.181000" />
                </div>
                <div className="full">
                  <div className="toolbar">
                    <button type="button" className="btn primary" id="showCoord" onClick={showCoordinate}>🔎 Tampilkan Lokasi</button>
                    <button type="button" className="btn gray" id="resetCoord" onClick={resetCoordinate}>↺ Reset Koordinat</button>
                  </div>
                  <div id="coordStatus" className="notice" style={{ margin: 0 }}>{coordStatus}</div>
                  <div id="inputMap" className="smallmap">
                    {showMap && mapLat != null && mapLng != null ? (
                      <CoordinateMap lat={mapLat} lng={mapLng} onPick={pickCoordinate} />
                    ) : (
                      <div className="map-placeholder">Masukkan Latitude dan Longitude yang valid, lalu peta lokasi akan tampil di sini.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="full">
            <div className="section" style={{ marginTop: 0 }}>
              <h3>👥 Data Korban</h3>
              {korban.map((k, i) => (
                <div key={i} className="formgrid" style={{ marginBottom: 'var(--space-4)' }}>
                  <div className="full">
                    <label>Nama Kepala Keluarga</label>
                    <input placeholder="Nama kepala keluarga/korban" value={k.nama} onChange={(e) => updateVictim(i, { nama: e.target.value })} />
                  </div>
                  <div>
                    <label>Jumlah Jiwa dalam KK</label>
                    <input type="number" min={0} inputMode="numeric" placeholder="Contoh: 4" value={k.jiwa || ''} onChange={(e) => updateVictim(i, { jiwa: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label>Kondisi</label>
                    <select value={k.kondisi} onChange={(e) => updateVictim(i, { kondisi: e.target.value as Korban['kondisi'] })}>
                      <option>Meninggal Dunia</option>
                      <option>Luka-luka</option>
                      <option>Hilang</option>
                      <option>Mengungsi</option>
                      <option>Tidak Ada Korban</option>
                    </select>
                  </div>
                  <div className="full">
                    <label>Keterangan Korban</label>
                    <input placeholder="Keterangan tambahan jika diperlukan" value={k.keterangan} onChange={(e) => updateVictim(i, { keterangan: e.target.value })} />
                  </div>
                  <div className="full">
                    <button type="button" className="btn red" onClick={() => removeVictim(i)}>✖ Hapus Baris Korban</button>
                  </div>
                </div>
              ))}
              <div className="toolbar">
                <button type="button" className="btn green" onClick={() => setKorban((p) => [...p, { nama: '', jiwa: 0, kondisi: 'Tidak Ada Korban', keterangan: '' }])}>＋ Tambah Data Korban</button>
              </div>
            </div>
          </div>
          <div className="full">
            <div className="section" style={{ marginTop: 0 }}>
              <h3>🏚️ Dampak/Kerusakan</h3>
              <div className="formgrid">
                <div>
                  <label>Kategori Dampak *</label>
                  <select value={dampakKategori} onChange={(e) => onDampakChange(e.target.value)}>
                    <option value="">Pilih kategori</option>
                    <option>Rumah Rusak</option>
                    <option>Fasilitas Umum</option>
                    <option>Infrastruktur Transportasi</option>
                    <option>Tidak Ada Dampak</option>
                  </select>
                </div>
                <div className={dampakKategori && dampakKategori !== 'Tidak Ada Dampak' ? '' : 'hidden'}>
                  <label>Tingkat Kerusakan *</label>
                  <select value={tingkatKerusakan} onChange={(e) => setTingkatKerusakan(e.target.value)}>
                    <option value="">Pilih tingkat</option>
                    <option>Rusak Ringan</option>
                    <option>Rusak Sedang</option>
                    <option>Rusak Berat</option>
                  </select>
                </div>
                <div className={dampakKategori && dampakKategori !== 'Tidak Ada Dampak' ? 'full' : 'full hidden'}>
                  <label>Keterangan Dampak</label>
                  <textarea value={dampakKeterangan} onChange={(e) => setDampakKeterangan(e.target.value)} placeholder="Jelaskan dampak atau kerusakan yang terjadi" />
                </div>
              </div>
            </div>
          </div>
          <div className="full">
            <div className="section" style={{ marginTop: 0 }}>
              <h3>🎒 Kebutuhan Mendesak</h3>
              {kebutuhan.map((n, i) => (
                <div key={i} className="formgrid" style={{ marginBottom: 'var(--space-4)', alignItems: 'end' }}>
                  <div>
                    <label>Jenis Kebutuhan</label>
                    <select value={n.nama} onChange={(e) => updateNeed(i, { nama: e.target.value })}>
                      {KEBUTUHAN_LIST.map((x) => <option key={x}>{x}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>Jumlah</label>
                    <input type="number" min={0} inputMode="numeric" placeholder="Jumlah" value={n.jumlah || ''} onChange={(e) => updateNeed(i, { jumlah: Number(e.target.value) })} />
                  </div>
                  <div className="full">
                    <label>Keterangan</label>
                    <input placeholder="Sebutkan kebutuhan lainnya atau keterangan" value={n.keterangan} onChange={(e) => updateNeed(i, { keterangan: e.target.value })} />
                  </div>
                  <div className="full">
                    <button type="button" className="btn red" onClick={() => removeNeed(i)}>✖ Hapus Baris Kebutuhan</button>
                  </div>
                </div>
              ))}
              <div className="toolbar">
                <button type="button" className="btn green" onClick={() => setKebutuhan((p) => [...p, { nama: 'Lainnya', jumlah: 0, keterangan: '' }])}>＋ Tambah Kebutuhan Mendesak</button>
              </div>
            </div>
          </div>
          <div className="full">
            <div className="section" style={{ marginTop: 0 }}>
              <h3>👤 Data Pelapor & Petugas</h3>
              <div className="formgrid">
                <div>
                  <label>Nama Pelapor *</label>
                  <input id="pelapor" value={pelapor} onChange={(e) => setPelapor(e.target.value)} placeholder="Nama petugas/masyarakat pelapor" />
                </div>
                <div>
                  <label>Petugas Input *</label>
                  <input id="petugas" value={petugas} onChange={(e) => setPetugas(e.target.value)} placeholder="Nama petugas BPBD yang menginput" />
                </div>
              </div>
            </div>
          </div>
          <div className="full">
            <div className="section" style={{ marginTop: 0 }}>
              <h3>📷 Dokumentasi & Status Laporan</h3>
              <div className="formgrid">
                <div>
                  <label>Status Laporan *</label>
                  <select id="statusLaporan" value={statusLaporan} onChange={(e) => setStatusLaporan(e.target.value as TindakLanjut)}>
                    <option value="Belum Ditangani">🔴 Belum Ditangani</option>
                    <option value="Dalam Penanganan">🟠 Dalam Penanganan</option>
                    <option value="Selesai Ditangani">🟢 Selesai Ditangani</option>
                  </select>
                </div>
                <div>
                  <label>Foto Kejadian <span className="muted">(maks. {formatFileSize(MAX_FOTO_SIZE)}/foto)</span></label>
                  <input id="fotoKejadian" type="file" multiple accept="image/*" onChange={onFotoKejadianChange} disabled={uploadingJenis !== null || saving} />
                </div>
                <div>
                  <label>Foto Penyerahan <span className="muted">(maks. {formatFileSize(MAX_FOTO_SIZE)}/foto)</span></label>
                  <input id="fotoPenyerahan" type="file" multiple accept="image/*" onChange={onFotoPenyerahanChange} disabled={uploadingJenis !== null || saving} />
                </div>
                {uploadingJenis && (
                  <div className="full">
                    <div className="notice" role="status" style={{ margin: 0 }}>
                      ⏳ {uploadProgress || 'Mengunggah foto...'}
                    </div>
                  </div>
                )}
                {(fotoKejadian.length > 0 || fotoPenyerahan.length > 0) && (
                  <div className="full">
                    <div className="edit-photo-cols">
                      <div>
                        <label>Foto Kejadian Tersimpan ({fotoKejadian.length})</label>
                        {fotoKejadian.length === 0 ? (
                          <div className="muted">Belum ada foto kejadian.</div>
                        ) : (
                          <div className="edit-photo-grid">
                            {fotoKejadian.map((p, i) => (
                              <div key={`${p.url}-${i}`} className="edit-photo-item">
                                <a href={p.url} target="_blank" rel="noreferrer">
                                  <img src={p.url} alt={p.name || `Foto kejadian ${i + 1}`} />
                                </a>
                                <button type="button" className="btn red" onClick={() => removeFotoKejadian(i)} disabled={uploadingJenis !== null}>
                                  ✖ Hapus
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <label>Foto Penyerahan Tersimpan ({fotoPenyerahan.length})</label>
                        {fotoPenyerahan.length === 0 ? (
                          <div className="muted">Belum ada foto penyerahan.</div>
                        ) : (
                          <div className="edit-photo-grid">
                            {fotoPenyerahan.map((p, i) => (
                              <div key={`${p.url}-${i}`} className="edit-photo-item">
                                <a href={p.url} target="_blank" rel="noreferrer">
                                  <img src={p.url} alt={p.name || `Foto penyerahan ${i + 1}`} />
                                </a>
                                <button type="button" className="btn red" onClick={() => removeFotoPenyerahan(i)} disabled={uploadingJenis !== null}>
                                  ✖ Hapus
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {msg && <div className="notice">{msg}</div>}
        <div className="toolbar" style={{ marginTop: 'var(--space-5)' }}>
          <button className="btn orange" type="submit" disabled={saving || uploadingJenis !== null || (!!editingId && !editReady)}>
            {saving ? '⏳ Menyimpan...' : editingId ? '💾 Simpan Perubahan' : '💾 Simpan Laporan'}
          </button>
          {editingId && (
            <button className="btn gray" type="button" id="cancelEditBtn" onClick={onCancel} disabled={saving || uploadingJenis !== null} title="Batalkan perubahan dan kembali ke daftar" aria-label="Batalkan perubahan dan kembali ke daftar">
              ✖ Batal Edit
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
