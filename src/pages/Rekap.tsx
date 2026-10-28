import { useCallback, useEffect, useMemo, useState } from 'react';
import { getLaporan } from '../lib/api';
import FotoImage from '../components/FotoImage';
import DataErrorNotice from '../components/DataErrorNotice';
import { witaYear } from '../lib/date';
import type { Foto, Laporan } from '../lib/types';

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const NEEDS = ['Terpal 3×4','Terpal 4×6','Terpal 5×7','Terpal 6×8','Terpal 8×10','Gerobak','Sekop','Karung','Garu-garu','Cangkul','Linggis','Tikar','Karpet Alas','Lainnya'];

const STATUS_BADGE_CLASS: Record<string, string> = {
  'Belum Ditangani': 'b-belum',
  'Dalam Penanganan': 'b-proses',
  'Selesai Ditangani': 'b-selesai',
};

function StatusBadge({ s }: { s: string }) {
  return <span className={`badge ${STATUS_BADGE_CLASS[s] ?? 'b-belum'}`}>{s}</span>;
}

function photoThumbs(a: Foto[] | undefined, label: string) {
  const photos = a || [];
  if (!photos.length) return <span className="muted">Tidak ada</span>;
  return (
    <div className="recap-photos">
      {photos.map((p, i) => (
        <FotoImage key={i} foto={p} alt={`${label} ${i + 1}`} title={`${label} ${i + 1}`} />
      ))}
    </div>
  );
}

function stock(x: Laporan, name: string) {
  return x.kebutuhan?.find((n) => n.nama === name)?.jumlah || 0;
}

export default function Rekap({ onExport }: { onExport: (params: { bulan: number | null; kecamatan: string | null }) => Promise<void> }) {
  const [data, setData] = useState<Laporan[]>([]);
  const [bulan, setBulan] = useState<number | null>(null);
  const [kecamatan, setKecamatan] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState('');
  const [exportError, setExportError] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await getLaporan();
      setData(rows);
      setLoadError(null);
    } catch (err) {
      setLoadError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDownload() {
    if (exporting) return;
    setExporting(true);
    setExportMsg('');
    setExportError(false);
    try {
      await onExport({ bulan, kecamatan });
      setExportMsg('File Excel berhasil diunduh, termasuk foto kejadian dan foto penyerahan.');
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setExportError(true);
      setExportMsg(`Gagal download Excel: ${detail}`);
    } finally {
      setExporting(false);
    }
  }

  const rows = useMemo(() => {
    return data.filter((x) => {
      const okBulan =
        bulan === null ||
        (x.tanggal != null && x.tanggal !== '' && new Date(x.tanggal).getMonth() === Number(bulan));
      const okKec = kecamatan === null || x.kecamatan === kecamatan;
      return okBulan && okKec;
    });
  }, [data, bulan, kecamatan]);

  const tahunList = useMemo(() => {
    const years = new Set<number>();
    rows.forEach((x) => {
      const year = witaYear(x.tanggal);
      if (year !== null) years.add(year);
    });
    return [...years].sort((a, b) => a - b);
  }, [rows]);

  const tahunLabel = tahunList.length === 0
    ? String(witaYear(new Date().toISOString()) ?? new Date().getFullYear())
    : tahunList.length === 1
      ? String(tahunList[0])
      : `${tahunList[0]}–${tahunList[tahunList.length - 1]}`;

  const rekapTitle = (
    <div className="rekap-title" id="rekapTitle">
      <div>PEMERINTAH KOTA AMBON</div>
      <div>BADAN PENANGGULANGAN BENCANA DAERAH</div>
      <div>Jl. Upua Baguala, Negeri Passo, Kec. Baguala, Kota Ambon, Maluku 97242</div>
      <div>DATA KEJADIAN BENCANA TAHUN {tahunLabel}</div>
      <div>{'BULAN ' + (bulan === null ? 'SEMUA BULAN' : MONTHS[Number(bulan)]).toUpperCase()}</div>
    </div>
  );

  return (
    <div className="section" id="recap">
      <h2>📊 Rekap Laporan</h2>
      {loadError != null && <DataErrorNotice title="Gagal memuat data rekap." error={loadError} onRetry={load} retrying={loading} />}
      {loading && data.length === 0 && !loadError && (
        <div className="notice" role="status">⏳ Memuat data rekap...</div>
      )}
      <div className="monthbar">
        <div>
          <label>Bulan</label>
          <select value={bulan === null ? '' : String(bulan)} onChange={(e) => setBulan(e.target.value === '' ? null : Number(e.target.value))}>
            <option value="">Semua Bulan</option>
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
        </div>
        <div>
          <label>Kecamatan</label>
          <select value={kecamatan ?? ''} onChange={(e) => setKecamatan(e.target.value === '' ? null : e.target.value)}>
            <option value="">Semua Kecamatan</option>
            {['Baguala', 'Leitimur Selatan', 'Nusaniwe', 'Sirimau', 'Teluk Ambon'].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <button className="btn green" type="button" onClick={handleDownload} disabled={exporting}>
            {exporting ? '⏳ Menyiapkan Excel...' : '⬇️ Download Excel'}
          </button>
        </div>
      </div>
      {exportMsg && (
        <div
          className="notice"
          role={exportError ? 'alert' : 'status'}
          style={exportError ? { borderColor: '#fca5a5', background: '#fef2f2', color: '#991b1b' } : undefined}
        >
          {exportMsg}
        </div>
      )}
      <div className="notice">Rekap disusun mengikuti format rekapitulasi kejadian bencana. Foto kejadian dan foto penyerahan ditampilkan pada tabel dan ikut disertakan saat Download Excel.</div>
      {rekapTitle}
      <div className="tablewrap" style={{ marginTop: 10 }}>
        <table id="recapTable">
          <thead>
            <tr className="recap-head">
              <th rowSpan={2}>NO</th>
              <th rowSpan={2}>TANGGAL KEJADIAN</th>
              <th rowSpan={2}>KEJADIAN / ANCAMAN</th>
              <th rowSpan={2}>JENIS BENCANA</th>
              <th colSpan={2}>KORBAN</th>
              <th colSpan={4}>LOKASI KEJADIAN</th>
              <th rowSpan={2}>DAMPAK</th>
              <th rowSpan={2}>KETERANGAN</th>
              <th colSpan={2}>DOKUMENTASI</th>
              <th rowSpan={2}>TITIK KOORDINAT</th>
              <th colSpan={13}>STOK KELUAR</th>
              <th rowSpan={2}>TINDAK LANJUT</th>
            </tr>
            <tr className="subhead">
              <th>KK</th>
              <th>JIWA</th>
              <th>KECAMATAN</th>
              <th>DESA / KELURAHAN / NEGERI</th>
              <th>RT</th>
              <th>RW</th>
              <th>FOTO KEJADIAN</th>
              <th>FOTO PENYERAHAN</th>
              {NEEDS.slice(0, -1).map((n) => (
                <th key={n}>{n}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((x, i) => {
              const rt = x.rt ?? (String(x.rt_rw || '').split('/')[0] || '-');
              const rw = x.rw ?? (String(x.rt_rw || '').split('/')[1] || '-');
              return (
                <tr key={x.id}>
                  <td>{i + 1}</td>
                  <td>{x.tanggal ? new Date(x.tanggal).toLocaleDateString('id-ID') : '-'}</td>
                  <td>{x.status_bencana}</td>
                  <td>{x.jenis_bencana}{x.kejadian_cuaca ? ` — ${x.kejadian_cuaca}` : ''}</td>
                  <td>{x.total_kk}</td>
                  <td>{x.total_jiwa}</td>
                  <td>{x.kecamatan}</td>
                  <td>{x.kelurahan}</td>
                  <td>{rt}</td>
                  <td>{rw}</td>
                  <td>{x.dampak_kategori}{x.tingkat_kerusakan ? ` — ${x.tingkat_kerusakan}` : ''}</td>
                  <td>{x.dampak_keterangan || '-'}</td>
                  <td>{photoThumbs(x.foto_kejadian, 'Foto Kejadian')}</td>
                  <td>{photoThumbs(x.foto_penyerahan, 'Foto Penyerahan')}</td>
                  <td>{x.lat != null && x.lng != null ? `${Number(x.lat).toFixed(6)}, ${Number(x.lng).toFixed(6)}` : '-'}</td>
                  {NEEDS.slice(0, -1).map((n) => (
                    <td key={n}>{stock(x, n)}</td>
                  ))}
                  <td><StatusBadge s={x.tindak_lanjut} /></td>
                </tr>
              );
            })}
            {rows.length === 0 && !loadError && !loading && (
              <tr><td colSpan={30} className="empty">Belum ada data.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
