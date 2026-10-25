const WIT_OFFSET = '+09:00';
const WIT_OFFSET_MS = 9 * 60 * 60 * 1000;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

// Tampilkan timestamp UTC sebagai waktu dinding WIT (UTC+9), tanpa
// bergantung pada timezone perangkat pengguna.
export function isoToWitaInput(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const wita = new Date(date.getTime() + WIT_OFFSET_MS);
  return `${wita.getUTCFullYear()}-${pad2(wita.getUTCMonth() + 1)}-${pad2(wita.getUTCDate())}T${pad2(wita.getUTCHours())}:${pad2(wita.getUTCMinutes())}`;
}

// Nilai datetime-local dianggap waktu WIT, lalu disimpan sebagai UTC.
export function witaInputToIso(value: string): string | null {
  if (!value) return null;

  const withSeconds = value.length === 16 ? `${value}:00` : value;
  const date = new Date(`${withSeconds}${WIT_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function witaYear(value: string | null): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + WIT_OFFSET_MS).getUTCFullYear();
}
