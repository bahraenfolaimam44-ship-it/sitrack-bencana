import { useState } from 'react';
import { getLaporan } from '../lib/api';
import type { Laporan } from '../lib/types';

export default function Settings() {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  function backupData() {
    if (busy) return;
    setBusy(true);
    setMsg('Menyiapkan backup...');
    getLaporan()
      .then((rows: Laporan[]) => {
        const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Backup_SI-TRACK_BENCANA.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setMsg(`Backup berhasil: ${rows.length} laporan diunduh.`);
      })
      .catch(() => setMsg('Gagal backup data.'))
      .finally(() => setBusy(false));
  }

  return (
    <div className="section">
      <h2>💾 Backup Data</h2>
      <div className="notice">
        <b>Data tersimpan di database Supabase (cloud).</b>
        <br />
        SI-TRACK tidak memakai penyimpanan lokal browser. Semua laporan dapat diakses dari perangkat mana pun setelah login.
      </div>
      <div className="toolbar" style={{ marginTop: 12 }}>
        <button className="btn green" id="backupData" type="button" onClick={backupData} disabled={busy}>
          {busy ? '⏳ Menyiapkan...' : '⬇️ Backup Data (JSON)'}
        </button>
      </div>
      <div className="notice" style={{ background: '#eef7ff', borderColor: '#b9ddff' }}>
        <b>Catatan:</b> Backup mengunduh salinan data dari database ke file JSON. Penghapusan data tidak tersedia dari aplikasi; jika benar-benar diperlukan, lakukan melalui dashboard Supabase dengan akses admin.
      </div>
      {msg && <div className="notice" style={{ marginTop: 10 }}>{msg}</div>}
    </div>
  );
}
