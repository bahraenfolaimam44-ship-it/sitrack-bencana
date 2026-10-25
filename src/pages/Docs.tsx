import { useCallback, useEffect, useState } from 'react';
import { getLaporan } from '../lib/api';
import FotoImage from '../components/FotoImage';
import DataErrorNotice from '../components/DataErrorNotice';
import type { Laporan } from '../lib/types';

export default function Docs() {
  const [data, setData] = useState<Laporan[]>([]);
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

  return (
    <div className="section">
      <h2>📷 Dokumentasi Foto Kejadian & Penyerahan</h2>
      {loadError != null && <DataErrorNotice title="Gagal memuat dokumentasi." error={loadError} onRetry={load} retrying={loading} />}
      {loading && data.length === 0 && !loadError && (
        <div className="notice" role="status">⏳ Memuat dokumentasi...</div>
      )}
      {data.map((x) => (
        <div key={x.id} className="section">
          <b>{x.nomor} — {x.jenis_bencana}</b>
          <div style={{ marginTop: 8 }}>
            <b>Nama Keluarga Korban:</b>{' '}
            {(x.korban || []).filter((k) => k && k.nama).map((k) => k.nama).join(', ') || <span className="muted">Tidak ada korban</span>}
          </div>
          <div className="photo-grid" style={{ marginTop: 10 }}>
            <div>
              <b>Foto Kejadian</b>
              {(x.foto_kejadian || []).length === 0 && <div className="muted">Belum ada foto</div>}
              {(x.foto_kejadian || []).map((p, i) => <FotoImage key={i} foto={p} alt={`Foto kejadian ${i + 1}`} />)}
            </div>
            <div>
              <b>Foto Penyerahan</b>
              {(x.foto_penyerahan || []).length === 0 && <div className="muted">Belum ada foto</div>}
              {(x.foto_penyerahan || []).map((p, i) => <FotoImage key={i} foto={p} alt={`Foto penyerahan ${i + 1}`} />)}
            </div>
          </div>
        </div>
      ))}
      {data.length === 0 && !loadError && !loading && <div className="empty">Belum ada dokumentasi.</div>}
    </div>
  );
}
