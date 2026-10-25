export type StatusBencana = 'Kejadian Bencana' | 'Ancaman/Antisipasi Bencana';
export type KategoriBencana =
  | 'Bencana Geologis / Aktivitas Bumi'
  | 'Bencana Hidrometeorologi / Cuaca dan Iklim';
export type JenisBencana =
  | 'Gempa Bumi'
  | 'Tsunami'
  | 'Letusan Gunung Api'
  | 'Tanah Longsor'
  | 'Banjir'
  | 'Cuaca Ekstrem'
  | 'Gelombang Ekstrem / Gelombang Pasang dan Abrasi'
  | 'Kekeringan'
  | 'Kebakaran Hutan dan Lahan';
export type KejadianCuaca =
  | 'Angin Kencang'
  | 'Hujan Lebat'
  | 'Petir / Petir disertai angin'
  | 'Gelombang Tinggi'
  | 'Pohon Tumbang'
  | 'Lainnya';
export type DampakKategori =
  | 'Rumah Rusak'
  | 'Fasilitas Umum'
  | 'Infrastruktur Transportasi'
  | 'Tidak Ada Dampak';
export type TingkatKerusakan = 'Rusak Ringan' | 'Rusak Sedang' | 'Rusak Berat';
export type TindakLanjut = 'Belum Ditangani' | 'Dalam Penanganan' | 'Selesai Ditangani';
export type KondisiKorban =
  | 'Meninggal Dunia'
  | 'Luka-luka'
  | 'Hilang'
  | 'Mengungsi'
  | 'Tidak Ada Korban';

export interface Korban {
  nama: string;
  jiwa: number;
  kondisi: KondisiKorban;
  keterangan: string;
}

export interface Kebutuhan {
  nama: string;
  jumlah: number;
  keterangan: string;
}

export interface Foto {
  name: string;
  url: string;
}

export interface Laporan {
  id: string;
  nomor: string;
  status_bencana: StatusBencana;
  kategori_bencana: KategoriBencana;
  jenis_bencana: JenisBencana | null;
  kejadian_cuaca: KejadianCuaca | null;
  tanggal: string | null;
  kecamatan: string;
  kelurahan: string | null;
  lokasi: string;
  keterangan_kejadian: string | null;
  rt: string | null;
  rw: string | null;
  rt_rw: string | null;
  lat: number | null;
  lng: number | null;
  korban: Korban[];
  total_kk: number;
  total_jiwa: number;
  total_meninggal: number;
  total_luka: number;
  total_hilang: number;
  total_mengungsi: number;
  dampak_kategori: DampakKategori | null;
  tingkat_kerusakan: TingkatKerusakan | null;
  dampak_keterangan: string | null;
  kebutuhan: Kebutuhan[];
  tindak_lanjut: TindakLanjut;
  pelapor: string;
  petugas: string;
  foto_kejadian: Foto[];
  foto_penyerahan: Foto[];
  created_at: string;
  updated_at: string;
}
