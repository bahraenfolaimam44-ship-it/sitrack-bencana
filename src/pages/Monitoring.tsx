import { useCallback, useEffect, useState } from 'react';
import { getLaporan, updateStatusLaporan } from '../lib/api';
import DataErrorNotice from '../components/DataErrorNotice';
import type { Laporan, TindakLanjut } from '../lib/types';

export default function Monitoring() {
  const [data, setData] = useState<Laporan[]>([]);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<unknown>(null);
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

  async function changeFollow(id: string, val: TindakLanjut) {
    const x = data.find((r) => r.id === id);
    if (!x) return;
    try {
      await updateStatusLaporan(id, val);
      setActionError(null);
      await load();
    } catch (err) {
      setActionError(err);
    }
  }

  return (
    <div className="section">
      <h2>⏱️ Monitoring Tindak Lanjut</h2>
      {loadError != null && <DataErrorNotice title="Gagal memuat data monitoring." error={loadError} onRetry={load} retrying={loading} />}
      {actionError != null && (
        <DataErrorNotice title="Gagal mengubah status laporan." error={actionError} />
      )}
      {loading && data.length === 0 && !loadError && (
        <div className="notice" role="status">⏳ Memuat data monitoring...</div>
      )}
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>ID Laporan</th>
              <th>Tanggal</th>
              <th>Jenis</th>
              <th>Kecamatan</th>
              <th>Tindak Lanjut</th>
              <th>Ubah</th>
            </tr>
          </thead>
          <tbody>
            {data.map((x, i) => (
              <tr key={x.id}>
                <td>{i + 1}</td>
                <td>{x.nomor}</td>
                <td>{x.tanggal ? new Date(x.tanggal).toLocaleString('id-ID') : '-'}</td>
                <td>{x.jenis_bencana}</td>
                <td>{x.kecamatan}</td>
                <td>{x.tindak_lanjut}</td>
                <td>
                  <select value={x.tindak_lanjut} onChange={(e) => changeFollow(x.id, e.target.value as TindakLanjut)}>
                    <option value="Belum Ditangani">Belum Ditangani</option>
                    <option value="Dalam Penanganan">Dalam Penanganan</option>
                    <option value="Selesai Ditangani">Selesai Ditangani</option>
                  </select>
                </td>
              </tr>
            ))}
            {data.length === 0 && !loadError && !loading && (
              <tr><td colSpan={7} className="empty">Belum ada data.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
