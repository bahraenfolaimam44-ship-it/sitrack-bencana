interface Props {
  error: unknown;
  title?: string;
  onRetry?: () => void;
  retrying?: boolean;
}

function errorDetail(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;

  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    return [e.message, e.details, e.hint, e.code ? `Kode: ${String(e.code)}` : '']
      .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
      .join(' — ');
  }

  return '';
}

export default function DataErrorNotice({ error, title = 'Gagal memuat data.', onRetry, retrying }: Props) {
  const detail = errorDetail(error);

  return (
    <div className="notice data-error" role="alert">
      <div>
        <b>{title}</b>{' '}
        Terjadi kesalahan saat memproses permintaan. Periksa koneksi internet atau hubungi admin jika masalah berlanjut.
        {detail && (
          <details>
            <summary>Detail teknis</summary>
            <pre>{detail}</pre>
          </details>
        )}
      </div>
      {onRetry && (
        <button className="btn gray" type="button" onClick={onRetry} disabled={retrying}>
          {retrying ? '⏳ Mencoba...' : '🔄 Coba lagi'}
        </button>
      )}
    </div>
  );
}
