import { useEffect, useState } from 'react';
import Dashboard from './pages/Dashboard';
import List from './pages/List';
import Input from './pages/Input';
import Monitoring from './pages/Monitoring';
import Rekap from './pages/Rekap';
import Docs from './pages/Docs';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { supabase } from './lib/supabaseClient';
import { useConnectionStatus } from './lib/useConnectionStatus';

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [clock, setClock] = useState('');
  const [navOpen, setNavOpen] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const connection = useConnectionStatus();

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session ?? null);
        setAuthReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        setSession(null);
        setAuthReady(true);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!mounted) return;
      setSession(currentSession ?? null);
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      subscription?.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!navOpen) return;

    const media = window.matchMedia('(max-width: 920px)');
    const previousOverflow = document.body.style.overflow;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false);
    };
    const handleViewportChange = () => {
      if (!media.matches) setNavOpen(false);
    };

    if (media.matches) document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    media.addEventListener('change', handleViewportChange);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      media.removeEventListener('change', handleViewportChange);
    };
  }, [navOpen]);

  const handleEdit = (id: string) => {
    setEditingId(id);
    setPage('input');
  };

  const handleSaved = () => {
    setEditingId(null);
    setPage('list');
  };

  const handleExport = async ({ bulan, kecamatan }: { bulan: number | null; kecamatan: string | null }) => {
    const accessToken = session?.access_token;
    if (!accessToken) {
      throw new Error('Sesi berakhir, silakan login kembali.');
    }

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-rekap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ bulan, kecamatan }),
    });

    if (!res.ok) {
      const raw = await res.text();
      let detail = raw;
      try {
        detail = JSON.parse(raw)?.error ?? raw;
      } catch {
        // biarkan pesan mentah
      }
      if (res.status === 401 || res.status === 403) {
        throw new Error('Akses export ditolak. Silakan login ulang lalu coba lagi.');
      }
      throw new Error(detail || `Gagal export Excel (HTTP ${res.status})`);
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('spreadsheetml.sheet')) {
      const raw = await res.text();
      let detail = raw;
      try {
        detail = JSON.parse(raw)?.error ?? raw;
      } catch {
        // biarkan pesan mentah
      }
      throw new Error(detail || 'Server tidak mengembalikan file Excel yang valid.');
    }

    const blob = await res.blob();
    if (!blob.size) throw new Error('File Excel yang diterima kosong.');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Rekap_SI-TRACK_BENCANA.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Beri waktu browser memulai download sebelum blob URL dicabut.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } catch {
      // biarkan session beres dari onAuthStateChange
    }
    setPage('dashboard');
    setEditingId(null);
    setNavOpen(false);
  }

  const navItems = [
    { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
    { id: 'input', icon: '✏️', label: 'Input Laporan' },
    { id: 'list', icon: '🗂️', label: 'Daftar Laporan' },
    { id: 'monitor', icon: '⏱️', label: 'Monitoring' },
    { id: 'recap', icon: '📊', label: 'Rekap Laporan' },
    { id: 'docs', icon: '📷', label: 'Dokumentasi' },
    { id: 'settings', icon: '⚙️', label: 'Pengaturan' },
  ];

  const content = (() => {
    switch (page) {
      case 'input':
        return <Input editingId={editingId} onSaved={handleSaved} />;
      case 'list':
        return <List onEdit={handleEdit} />;
      case 'monitor':
        return <Monitoring />;
      case 'recap':
        return <Rekap onExport={handleExport} />;
      case 'docs':
        return <Docs />;
      case 'settings':
        return <Settings />;
      case 'dashboard':
      default:
        return <Dashboard />;
    }
  })();

  const pageId = ['dashboard', 'input', 'list', 'monitor', 'recap', 'docs', 'settings'].includes(page)
    ? page
    : 'dashboard';

  if (!authReady) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-card">
          <span className="auth-loading-dot" />
          <span>Memuat sesi...</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Login onLogin={() => setSession((prev: any) => prev)} />;
  }

  const userEmail = session?.user?.email || '';
  const userName = userEmail.split('@')[0] || 'Admin BPBD';

  return (
    <div className="app">
      <button
        type="button"
        className={`nav-toggle${navOpen ? ' open' : ''}`}
        aria-label={navOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
        aria-expanded={navOpen}
        aria-controls="main-nav"
        onClick={() => setNavOpen((open) => !open)}
      >
        {navOpen ? '✕' : '☰'}
      </button>
      {navOpen && (
        <button
          type="button"
          className="nav-overlay"
          aria-label="Tutup menu navigasi"
          onClick={() => setNavOpen(false)}
        />
      )}
      <aside className={`side${navOpen ? ' open' : ''}`}>
        <div className="brand">
          <svg className="brand-logo" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="48" fill="#d92727" />
            <circle cx="50" cy="50" r="39" fill="#f47c20" stroke="#fff" strokeWidth="2" />
            <path d="M50 18 80 70H20Z" fill="#0755a0" stroke="#fff" strokeWidth="3" />
            <text x="50" y="87" textAnchor="middle" fill="#fff" fontFamily="Arial" fontSize="13" fontWeight="800">BPBD</text>
          </svg>
          <div className="brand-copy">
            SI-TRACK<br />
            <span>BENCANA</span>
            <small>BPBD KOTA AMBON</small>
          </div>
        </div>
        <nav className="nav" id="main-nav" aria-label="Menu SI-TRACK">
          {navItems.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              data-page={n.id}
              className={page === n.id ? 'active' : ''}
              aria-current={page === n.id ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                if (n.id === 'input') setEditingId(null);
                setPage(n.id);
                setNavOpen(false);
              }}
            >
              <span className="nav-icon" aria-hidden="true">{n.icon}</span>
              <span>{n.label}</span>
            </a>
          ))}
        </nav>
        <div className="side-footer">
          <div
            className={`online online-${connection}`}
            id="connection"
            role="status"
            aria-live="polite"
            title={
              connection === 'online'
                ? 'Koneksi ke server Supabase aktif'
                : connection === 'offline'
                  ? 'Tidak dapat terhubung ke server Supabase'
                  : 'Memeriksa koneksi ke server Supabase'
            }
          >
            {connection === 'checking'
              ? '🟡 Memeriksa koneksi...'
              : connection === 'online'
                ? '🟢 Terhubung'
                : '🔴 Tidak terhubung'}
          </div>
          <div className="user">
            <div>👤 <b>{userName}</b></div>
            <div className="user-meta">{userEmail}</div>
            <button type="button" className="logout-btn" onClick={handleLogout}>Keluar</button>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="top">
          <div className="top-copy">
            <h1 id="title">SI-TRACK BENCANA</h1>
            <p className="top-sub">Sistem Informasi Pelaporan Kejadian Bencana — BPBD Kota Ambon</p>
          </div>
          <small id="clock">{clock}</small>
        </div>
        <section id={pageId} className="page active">
          {content}
        </section>
      </main>
    </div>
  );
}
