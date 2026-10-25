import { useEffect } from 'react';
import { supabase } from './supabaseClient';

export function useLaporanRealtime(onChange: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel('sitrack_laporan_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sitrack_laporan' },
        () => {
          onChange();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onChange]);
}
