import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deleteLaporan, getLaporan, updateStatusLaporan } from '../lib/api';
import DataErrorNotice from '../components/DataErrorNotice';
import type { Laporan, TindakLanjut } from '../lib/types';

type Flash = {
  kind: 'success' | 'warning';
  text: string;
  detail?: string;
};

function jumlahFoto(row: Laporan, field: 'foto_kejadian' | 'foto_penyerahan'): number {
  const photos = row[field];
  return Array.isArray(photos) ? photos.length : 0;
}

export default function List({ onEdit }: { onEdit: (id: string) => void }) {
  const [data, setData] = useState<Laporan[]>([]);
  const [q, setQ] = useState('');
  const [statusEditId, setStatusEditId] = useState<string | null>(null);
  const [statusVal, setStatusVal] = useState<TindakLanjut>('Belum Ditangani');
  const [deleteTarget, setDeleteTarget] = useState<Laporan | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<unknown>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    try {
      const rows = await getLaporan();
      if (seq !== loadSeq.current) return;
      setData(rows);
      setLoadError(null);
    } catch (err) {
      if (seq !== loadSeq.current) return;
      setLoadError(err);
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 8000);
    return () => window.clearTimeout(timer);
  }, [flash]);

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

  function openDelete(row: Laporan) {
    setDeleteTarget(row);
    setDeleteError(null);
  }

  function closeDelete() {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteError(null);
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    const target = deleteTarget;
    setDeleting(true);
    setDeleteError(null);

    try {
      const result = await deleteLaporan(target);

      // Update daftar segera, lalu sinkronkan ulang dengan server.
      setData((prev) => prev.filter((row) => row.id !== target.id));
      setDeleteTarget(null);
      setActionError(null);

      if (result.fotoGagal.length > 0) {
        setFlash({
          kind: 'warning',
          text: `Laporan ${target.nomor} berhasil dihapus, tetapi ${result.fotoGagal.length} foto gagal dihapus dari storage.`,
          detail: result.fotoGagal.join('\n'),
        });
      } else {
        setFlash({
          kind: 'success',
          text: `Laporan ${target.nomor} berhasil dihapus${
            result.fotoDihapus > 0 ? ` beserta ${result.fotoDihapus} foto` : ''
          }. Nomor laporan tidak akan dipakai ulang.`,
        });
      }

      void load();
    } catch (err) {
      setDeleteError(err);
    } finally {
      setDeleting(false);
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
      {flash && (
        <div className={`notice flash flash-${flash.kind}`} role="status" style={{ marginTop: 10 }}>
          <div>
            <b>{flash.kind === 'success' ? '✅ Berhasil.' : '⚠️ Perhatian.'}</b> {flash.text}
            {flash.detail && (
              <details>
                <summary>Detail</summary>
                <pre>{flash.detail}</pre>
              </details>
            )}
          </div>
          <button
            type="button"
            className="flash-close"
            aria-label="Tutup pesan"
            onClick={() => setFlash(null)}
          >
            ✕
          </button>
        </div>
      )}
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
                  <div className="row-actions">
                    <button
                      className="btn primary compact icon"
                      type="button"
                      onClick={() => onEdit(x.id)}
                      title="Edit laporan"
                      aria-label={`Edit laporan ${x.nomor}`}
                    >
                      ✏️
                    </button>
                    <button
                      className="btn orange compact icon"
                      type="button"
                      onClick={() => { setStatusEditId(x.id); setStatusVal(x.tindak_lanjut); setActionError(null); }}
                      title="Ubah status"
                      aria-label={`Ubah status laporan ${x.nomor}`}
                    >
                      🔄
                    </button>
                    <button
                      className="btn red compact icon"
                      type="button"
                      onClick={() => openDelete(x)}
                      title="Hapus laporan"
                      aria-label={`Hapus laporan ${x.nomor}`}
                    >
                      🗑️
                    </button>
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

      {deleteTarget && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
          <div className="modal-box">
            <div className="modal-head">
              <h3 id="delete-modal-title">🗑️ Hapus Laporan</h3>
            </div>
            <div className="notice danger-soft">
              <div>
                Yakin ingin menghapus laporan <b>{deleteTarget.nomor}</b>?
              </div>
              <div style={{ marginTop: 6 }}>
                {deleteTarget.jenis_bencana ?? 'Jenis tidak diisi'} — {deleteTarget.kecamatan}
                {deleteTarget.tanggal ? ` · ${new Date(deleteTarget.tanggal).toLocaleString('id-ID')}` : ''}
              </div>
              <div style={{ marginTop: 6 }}>
                {jumlahFoto(deleteTarget, 'foto_kejadian')} foto kejadian dan{' '}
                {jumlahFoto(deleteTarget, 'foto_penyerahan')} foto penyerahan akan ikut dihapus dari storage.
              </div>
              <div style={{ marginTop: 6 }}>
                Tindakan ini permanen dan hanya menghapus satu laporan. Nomor laporan tidak akan dipakai ulang.
              </div>
            </div>
            {deleteError != null && (
              <DataErrorNotice title="Gagal menghapus laporan." error={deleteError} />
            )}
            <div className="toolbar" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
              <button className="btn gray" type="button" onClick={closeDelete} disabled={deleting}>
                Batal
              </button>
              <button className="btn red" type="button" onClick={confirmDelete} disabled={deleting}>
                {deleting ? '⏳ Menghapus...' : '🗑️ Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
