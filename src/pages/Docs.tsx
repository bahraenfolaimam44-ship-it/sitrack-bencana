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
    <div className="section docs-section">
      <h2>📷 Dokumentasi Foto Kejadian & Penyerahan</h2>
      {loadError != null && <DataErrorNotice title="Gagal memuat dokumentasi." error={loadError} onRetry={load} retrying={loading} />}
      {loading && data.length === 0 && !loadError && (
        <div className="notice" role="status">⏳ Memuat dokumentasi...</div>
      )}
      <div className="docs-grid">
        {data.map((x) => (
          <article key={x.id} className="doc-card">
            <div className="doc-card-head">
              <b>{x.nomor}</b>
              <span className="doc-jenis">{x.jenis_bencana}</span>
            </div>
            <div className="doc-meta">
              <span className="doc-label">Nama Keluarga Korban:</span>{' '}
              {(x.korban || []).filter((k) => k && k.nama).map((k) => k.nama).join(', ') || <span className="muted">Tidak ada korban</span>}
            </div>
            <div className="doc-photos">
              <div className="doc-photo-col">
                <span className="doc-photo-label">Foto Kejadian</span>
                {(x.foto_kejadian || []).length === 0 ? (
                  <div className="doc-photo-empty">Belum ada foto</div>
                ) : (
                  <div className="doc-photo-list">
                    {(x.foto_kejadian || []).map((p, i) => (
                      <FotoImage key={i} foto={p} alt={`Foto kejadian ${i + 1}`} title={`Foto kejadian ${i + 1}`} />
                    ))}
                  </div>
                )}
              </div>
              <div className="doc-photo-col">
                <span className="doc-photo-label">Foto Penyerahan</span>
                {(x.foto_penyerahan || []).length === 0 ? (
                  <div className="doc-photo-empty">Belum ada foto</div>
                ) : (
                  <div className="doc-photo-list">
                    {(x.foto_penyerahan || []).map((p, i) => (
                      <FotoImage key={i} foto={p} alt={`Foto penyerahan ${i + 1}`} title={`Foto penyerahan ${i + 1}`} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {data.length === 0 && !loadError && !loading && <div className="empty">Belum ada dokumentasi.</div>}
    </div>
  );
}
