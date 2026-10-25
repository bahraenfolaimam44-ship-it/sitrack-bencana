import { useCallback, useEffect, useMemo, useState } from 'react';
import { getLaporan } from '../lib/api';
import { useLaporanRealtime } from '../lib/useLaporanRealtime';
import DataErrorNotice from '../components/DataErrorNotice';
import type { Laporan } from '../lib/types';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const COLORS = ['#1465d8', '#df3029', '#159447', '#f59e0b', '#7b61ff', '#00a6a6', '#c06c00', '#64748b'];
const STATUS_LIST = ['Belum Ditangani', 'Dalam Penanganan', 'Selesai Ditangani'];

function PieChart({ items }: { items: Array<[string, number]> }) {
  const total = items.reduce((a, [, v]) => a + v, 0);
  if (!total) return <div className="empty">Belum ada data</div>;
  let a = -Math.PI / 2;
  const paths = items.map(([k, v], i) => {
    const aa = a + (v / total) * Math.PI * 2;
    const large = aa - a > Math.PI ? 1 : 0;
    const x1 = 95 + 80 * Math.cos(a);
    const y1 = 95 + 80 * Math.sin(a);
    const x2 = 95 + 80 * Math.cos(aa);
    const y2 = 95 + 80 * Math.sin(aa);
    const d = `M95 95 L${x1} ${y1} A80 80 0 ${large} 1 ${x2} ${y2} Z`;
    const el = <path key={k} d={d} fill={COLORS[i % COLORS.length]} stroke="#fff" strokeWidth={1} />;
    a = aa;
    return el;
  });
  return (
    <div className="pie-wrap">
      <svg className="pie-svg" viewBox="0 0 190 190">{paths}</svg>
      <div className="pie-legend">
        {items.map(([k, v], i) => (
          <div key={k}>
            <span className="legend-dot" style={{ background: COLORS[i % COLORS.length] }} />
            {k}: <b>{v}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineChart({ items }: { items: Array<[string, number]> }) {
  const w = 650, h = 250, p = 35;
  const max = Math.max(...items.map((x) => x[1]), 1);
  const step = (w - 2 * p) / Math.max(items.length - 1, 1);
  const pts = items.map((x, i) => [p + i * step, 205 - (x[1] / max) * 155] as const);
  const polyline = pts.map((pt) => pt.join(',')).join(' ');
  return (
    <svg className="chart-svg" viewBox={`0 0 ${w} ${h}`}>
      <polyline fill="none" stroke="#1465d8" strokeWidth="3" points={polyline} />
      {pts.map((pt, i) => (
        <g key={i}>
          <circle cx={pt[0]} cy={pt[1]} r="4" fill="#1465d8" />
          <text x={pt[0]} y={225} textAnchor="middle" fontSize="9">{MONTHS[i].slice(0, 3)}</text>
          <text x={pt[0]} y={pt[1] - 8} textAnchor="middle" fontSize="10" fontWeight={700}>{items[i][1]}</text>
        </g>
      ))}
    </svg>
  );
}

function BarChart({ items }: { items: Array<[string, number]> }) {
  const w = 700, h = 300, p = 55;
  const max = Math.max(...items.map((x) => x[1]), 1);
  const slot = (w - 2 * p) / Math.max(items.length, 1);
  const bw = Math.min(70, slot - 15);
  const bars = items.map(([k, v], i) => {
    const x = p + i * slot + (slot - bw) / 2;
    const y = 240 - (v / max) * 180;
    return (
      <g key={k}>
        <rect x={x} y={y} width={bw} height={240 - y} fill="#1465d8" />
        <text x={x + bw / 2} y={258} textAnchor="middle" fontSize="10">{k}</text>
        <text x={x + bw / 2} y={y - 6} textAnchor="middle" fontSize="11" fontWeight={700}>{v}</text>
      </g>
    );
  });
  return (
    <svg className="chart-svg" viewBox={`0 0 ${w} ${h}`}>
      {bars}
    </svg>
  );
}

export default function Dashboard() {
  const [laporan, setLaporan] = useState<Laporan[]>([]);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await getLaporan();
      setLaporan(rows);
      setLoadError(null);
    } catch (err) {
      setLoadError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useLaporanRealtime(refresh);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const stats = useMemo(() => {
    const total = laporan.length;
    const byStatus = STATUS_LIST.map((s) => ({ status: s, jumlah: laporan.filter((x) => x.tindak_lanjut === s).length }));
    const byJenisMap = new Map<string, number>();
    laporan.forEach((x) => {
      const k = x.jenis_bencana || 'Tidak diisi';
      byJenisMap.set(k, (byJenisMap.get(k) ?? 0) + 1);
    });
    const byJenis = Array.from(byJenisMap.entries()).map(([jenis_bencana, jumlah]) => [jenis_bencana, jumlah] as [string, number]);
    const byKecamatanMap = new Map<string, number>();
    laporan.forEach((x) => {
      const k = x.kecamatan || 'Tidak diisi';
      byKecamatanMap.set(k, (byKecamatanMap.get(k) ?? 0) + 1);
    });
    const byKecamatan = Array.from(byKecamatanMap.entries()).map(([kecamatan, jumlah]) => [kecamatan, jumlah] as [string, number]);
    const byBulanMap = new Map<string, number>();
    laporan.forEach((x) => {
      if (!x.tanggal) return;
      const m = new Date(x.tanggal).getMonth();
      const label = MONTHS[m];
      byBulanMap.set(label, (byBulanMap.get(label) ?? 0) + 1);
    });
    const bulan = MONTHS.map((m) => [m, byBulanMap.get(m) ?? 0] as [string, number]);
    return { total, byStatus, byJenis, byKecamatan, bulan };
  }, [laporan]);

  const today = new Date().toLocaleDateString('en-CA');
  const rowsToday = laporan.filter((x) => x.tanggal && new Date(x.tanggal).toLocaleDateString('en-CA') === today);
  const topMap = new Map<string, number>();
  rowsToday.forEach((x) => {
    const k = x.jenis_bencana || 'Tidak diisi';
    topMap.set(k, (topMap.get(k) ?? 0) + 1);
  });
  const top = Array.from(topMap.entries()).sort((a, b) => b[1] - a[1]);
  const topTypes = top.length > 0 && top[0][1] > 0 ? top.filter((x) => x[1] === top[0][1]).map((x) => x[0]) : top.slice(0, 3).map((x) => x[0]);
  const himbauan = top.length
    ? `Masyarakat Kota Ambon diimbau untuk tetap waspada dan meningkatkan kesiapsiagaan. Kejadian paling banyak hari ini: ${topTypes.join(', ')}.`
    : 'Belum ada laporan kejadian bencana hari ini.';

  const statusClass = (s: string) => (s === 'Belum Ditangani' ? 'belum' : s === 'Dalam Penanganan' ? 'proses' : 'selesai');

  const showContent = laporan.length > 0 || (!loadError && !loading);

  return (
    <div>
      {loadError != null && <DataErrorNotice title="Gagal memuat data dashboard." error={loadError} onRetry={refresh} retrying={loading} />}
      {loading && laporan.length === 0 && !loadError && (
        <div className="notice" role="status">⏳ Memuat data dashboard...</div>
      )}
      {showContent && (
        <>
      <div className="cards">
        <div className="card"><b>📋 Total Laporan</b><div className="metric">{stats.total}</div></div>
        {stats.byStatus.map((s) => (
          <div key={s.status} className={`card status-card status-${statusClass(s.status)}`}>
            <b>{s.status === 'Belum Ditangani' ? '🔴' : s.status === 'Dalam Penanganan' ? '🟠' : '🟢'} {s.status}</b>
            <div className="metric">{s.jumlah}</div>
          </div>
        ))}
      </div>
      <div className="notice" style={{ marginTop: 10 }}><b>Keterangan warna status laporan:</b> 🔴 Belum Ditangani | 🟠 Dalam Proses Penanganan | 🟢 Selesai Ditangani</div>
      <div className="grid2">
        <div className="section"><h2>⭕ Diagram Lingkar – Jenis Bencana</h2><div className="chartbox"><PieChart items={stats.byJenis} /></div></div>
        <div className="section"><h2>📈 Grafik Rekap Bulanan</h2><div className="chartbox"><LineChart items={stats.bulan} /></div></div>
      </div>
      <div className="section"><h2>📊 Diagram Batang – Rekap Kecamatan</h2><div className="chartbox"><BarChart items={stats.byKecamatan} /></div></div>
      <div className="section"><h2>📢 Himbauan Kebencanaan Hari Ini</h2><div className="himbauan">{himbauan}</div></div>
        </>
      )}
    </div>
  );
}
