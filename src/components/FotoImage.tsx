import { useEffect, useState } from 'react';
import { refreshFotoUrl } from '../lib/api';
import type { Foto } from '../lib/types';

interface Props {
  foto: Foto;
  alt: string;
  title?: string;
}

/**
 * <img> dengan fallback: jika signed URL kedaluwarsa/rusak, coba buat
 * signed URL baru satu kali.
 */
export default function FotoImage({ foto, alt, title }: Props) {
  const [src, setSrc] = useState(foto.url);
  const [retried, setRetried] = useState(false);

  useEffect(() => {
    setSrc(foto.url);
    setRetried(false);
  }, [foto.url]);

  async function handleError() {
    if (retried) return;
    setRetried(true);
    try {
      const fresh = await refreshFotoUrl(foto.url);
      if (fresh) setSrc(fresh);
    } catch {
      // Biarkan gambar gagal; data laporan tetap tampil.
    }
  }

  return <img src={src} alt={alt} title={title} onError={handleError} />;
}
