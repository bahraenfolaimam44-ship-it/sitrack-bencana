import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { missingSupabaseEnv, supabaseConfigError } from './lib/env';

const root = ReactDOM.createRoot(document.getElementById('root')!);

function ConfigErrorScreen() {
  return (
    <div className="config-error">
      <div className="config-error-card" role="alert">
        <div className="config-error-icon" aria-hidden="true">⚠️</div>
        <h1>Konfigurasi Supabase belum lengkap</h1>
        <p>
          Aplikasi tidak dapat terhubung ke database karena variabel lingkungan berikut tidak di-set saat build:
        </p>
        <ul>
          {missingSupabaseEnv.map((name) => (
            <li key={name}><code>{name}</code></li>
          ))}
        </ul>
        <p><strong>Langkah perbaikan:</strong></p>
        <ol>
          <li>Tambahkan variabel di atas ke file <code>.env</code> (lokal) atau <strong>Environment Variables</strong> di hosting.</li>
          <li>Jalankan <code>npm run build</code> ulang, lalu deploy ulang folder <code>dist</code>.</li>
          <li>Lakukan hard refresh browser (<code>Ctrl+Shift+R</code>).</li>
        </ol>
        <p className="config-error-note">
          <strong>Penting:</strong> Vite menyisipkan env saat build. Mengubah env setelah build tidak akan memperbaiki aplikasi yang sudah terlanjur di-build.
        </p>
        {supabaseConfigError && (
          <details>
            <summary>Detail teknis</summary>
            <pre>{supabaseConfigError}</pre>
          </details>
        )}
      </div>
    </div>
  );
}

function FatalErrorScreen({ error }: { error: unknown }) {
  const detail = error instanceof Error ? error.message : String(error);
  return (
    <div className="config-error">
      <div className="config-error-card" role="alert">
        <div className="config-error-icon" aria-hidden="true">⚠️</div>
        <h1>Aplikasi gagal dimuat</h1>
        <p>Terjadi kesalahan saat memuat aplikasi. Silakan muat ulang halaman.</p>
        <details>
          <summary>Detail teknis</summary>
          <pre>{detail}</pre>
        </details>
      </div>
    </div>
  );
}

async function bootstrap() {
  if (supabaseConfigError) {
    root.render(
      <React.StrictMode>
        <ConfigErrorScreen />
      </React.StrictMode>
    );
    return;
  }

  const { default: App } = await import('./App');
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

void bootstrap().catch((error) => {
  console.error(error);
  root.render(
    <React.StrictMode>
      <FatalErrorScreen error={error} />
    </React.StrictMode>
  );
});
