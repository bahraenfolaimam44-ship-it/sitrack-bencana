import { useEffect, useState } from 'react';
import { supabaseAnonKey, supabaseUrl } from './env';

export type ConnectionStatus = 'checking' | 'online' | 'offline';

export function useConnectionStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('checking');

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | undefined;

    async function check() {
      if (!navigator.onLine) {
        if (!cancelled) setStatus('offline');
        return;
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 5000);

      try {
        const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
          method: 'GET',
          cache: 'no-store',
          headers: { apikey: supabaseAnonKey },
          signal: controller.signal,
        });
        if (!cancelled) setStatus(res.ok ? 'online' : 'offline');
      } catch {
        if (!cancelled) setStatus('offline');
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    function startCheck() {
      if (!cancelled) setStatus('checking');
      void check();
    }

    function handleOnline() {
      startCheck();
    }

    function handleOffline() {
      if (!cancelled) setStatus('offline');
    }

    startCheck();
    intervalId = window.setInterval(() => { void check(); }, 60000);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return status;
}
