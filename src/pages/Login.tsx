import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';

interface Props {
  onLogin: () => void;
}

function friendlyLoginError(err: unknown): string {
  const code = err && typeof err === 'object' && 'code' in err
    ? String((err as { code?: unknown }).code ?? '')
    : '';
  const message = err && typeof err === 'object' && 'message' in err
    ? String((err as { message?: unknown }).message ?? '')
    : String(err ?? '');
  const text = `${code} ${message}`.toLowerCase();

  if (text.includes('invalid login credentials') || text.includes('invalid_credentials')) {
    return 'Email atau kata sandi salah.';
  }
  if (text.includes('email not confirmed') || text.includes('email_not_confirmed')) {
    return 'Email belum dikonfirmasi. Periksa kotak masuk Anda lalu konfirmasi email.';
  }
  if (text.includes('too many requests') || text.includes('too_many_requests') || text.includes('rate limit')) {
    return 'Terlalu banyak percobaan login. Coba lagi beberapa saat lagi.';
  }
  if (text.includes('user not found') || text.includes('user_not_found')) {
    return 'Akun tidak ditemukan.';
  }
  if (text.includes('invalid email') || text.includes('invalid_email')) {
    return 'Format email tidak valid.';
  }
  if (text.includes('failed to fetch') || text.includes('load failed') || text.includes('network')) {
    return 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
  }
  if (text.includes('invalid api key') || text.includes('supabaseurl') || text.includes('invalid url')) {
    return 'Konfigurasi server tidak valid. Hubungi admin.';
  }

  return 'Login gagal. Silakan coba lagi.';
}

export default function Login({ onLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        throw signInError;
      }

      onLogin();
    } catch (err) {
      console.error('Login error:', err);
      setError(friendlyLoginError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <svg className="login-logo" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="48" fill="#d92727" />
            <circle cx="50" cy="50" r="39" fill="#f47c20" stroke="#fff" strokeWidth="2" />
            <path d="M50 18 80 70H20Z" fill="#0755a0" stroke="#fff" strokeWidth="3" />
            <text x="50" y="87" textAnchor="middle" fill="#fff" fontFamily="Arial" fontSize="13" fontWeight="800">BPBD</text>
          </svg>
          <div className="login-brand">
            <div className="login-brand-top">SI-TRACK</div>
            <div className="login-brand-mid">BENCANA</div>
            <div className="login-brand-sub">BPBD KOTA AMBON</div>
          </div>
        </div>
        <div className="login-title">
          <h1>Masuk ke Sistem</h1>
          <p>Silakan gunakan akun terdaftar untuk mengakses aplikasi SI-TRACK BENCANA.</p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="nama@bpbd.ambon.go.id"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="login-field">
            <label htmlFor="login-password">Kata Sandi</label>
            <div className="login-password-wrap">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Masukkan kata sandi"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="login-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          {error && <div className="login-error" role="alert">{error}</div>}
          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>
        <div className="login-footer">
          <span>© {new Date().getFullYear()} BPBD Kota Ambon</span>
          <span>SI-TRACK BENCANA</span>
        </div>
      </div>
    </div>
  );
}
