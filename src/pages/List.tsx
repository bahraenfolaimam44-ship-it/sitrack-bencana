import { useCallback, useEffect, useMemo, useState } from 'react';
import { getLaporan, updateStatusLaporan } from '../lib/api';
import DataErrorNotice from '../components/DataErrorNotice';
import type { Laporan, TindakLanjut } from '../lib/types';

export default function List({ onEdit }: { onEdit: (id: string) => void }) {
  const [data, setData] = useState<Laporan[]>([]);
  const [q, setQ] = useState('');
  const [statusEditId, setStatusEditId] = useState<string | null>(null);
  const [statusVal, setStatusVal] = useState<TindakLanjut>('Belum Ditangani');
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

  const rows = useMemo(() => {
    const query = (q || '').toLowerCase();
    if (!query) return data;
    return data.filter((x) => JSON.stringify(x).toLowerCase().includes(query));
  }, [data, q]);

  async function saveStatus() {
    if (!statusEditId) return;
    const x = data.find((r) => r.id === statusEditId);
    if (!x) return;
    try {
      await updateStatusLaporan(statusEditId, statusVal);
      setStatusEditId(null);
      setActionError(null);
      await load();
    } catch (err) {
      setActionError(err);
    }
  }

  return (
    <div className="section">
      <h2>🗂️ Daftar Laporan</h2>
      <input
        id="search"
        placeholder="Cari nomor, jenis, kecamatan, lokasi..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ width: '100%', padding: 10, border: '1px solid #cbd5e1', borderRadius: 8 }}
      />
      {loadError != null && <DataErrorNotice title="Gagal memuat daftar laporan." error={loadError} onRetry={load} retrying={loading} />}
      {loading && data.length === 0 && !loadError && (
        <div className="notice" role="status">⏳ Memuat data laporan...</div>
      )}
      <div className="tablewrap" style={{ marginTop: 10 }}>
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>ID Laporan</th>
              <th>Tanggal</th>
              <th>Status Bencana</th>
              <th>Jenis</th>
              <th>Kecamatan</th>
              <th>Desa/Negeri/Kelurahan</th>
              <th>Tindak Lanjut</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x, i) => (
              <tr key={x.id}>
                <td>{i + 1}</td>
                <td>{x.nomor}</td>
                <td>{x.tanggal ? new Date(x.tanggal).toLocaleString('id-ID') : '-'}</td>
                <td>{x.status_bencana}</td>
                <td>{x.jenis_bencana}{x.kejadian_cuaca ? ` — ${x.kejadian_cuaca}` : ''}</td>
                <td>{x.kecamatan}</td>
                <td>{x.kelurahan}</td>
                <td>{x.tindak_lanjut}</td>
                <td>
                  <div className="toolbar" style={{ margin: 0 }}>
                    <button className="btn primary" type="button" onClick={() => onEdit(x.id)}>✏️ Edit Laporan</button>
                    <button className="btn orange" type="button" onClick={() => { setStatusEditId(x.id); setStatusVal(x.tindak_lanjut); setActionError(null); }}>🔄 Ubah Status</button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loadError && !loading && (
              <tr><td colSpan={9} className="empty">Belum ada data.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {statusEditId && (
        <div className="modal">
          <div className="modal-box">
            <div className="modal-head">
              <h3>🔄 Ubah Status Laporan</h3>
            </div>
            <div className="notice">
              <b>{data.find((x) => x.id === statusEditId)?.nomor}</b>
              <br />
              Status saat ini: {data.find((x) => x.id === statusEditId)?.tindak_lanjut}
            </div>
            <label>Status Laporan</label>
            <select value={statusVal} onChange={(e) => setStatusVal(e.target.value as TindakLanjut)}>
              <option value="Belum Ditangani">🔴 Belum Ditangani</option>
              <option value="Dalam Penanganan">🟠 Dalam Proses Penanganan</option>
              <option value="Selesai Ditangani">🟢 Selesai Ditangani</option>
            </select>
            {actionError != null && (
              <DataErrorNotice title="Gagal mengubah status laporan." error={actionError} />
            )}
            <div className="toolbar" style={{ marginTop: 14 }}>
              <button className="btn" type="button" onClick={() => setStatusEditId(null)}>Batal</button>
              <button className="btn orange" type="button" onClick={saveStatus}>💾 Simpan Perubahan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
