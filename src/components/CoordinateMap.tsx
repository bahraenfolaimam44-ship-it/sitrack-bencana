import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const PIN_ICON = L.divIcon({
  className: 'coordinate-pin',
  html: `
    <svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M15 0C6.7 0 0 6.7 0 15c0 11.2 15 27 15 27s15-15.8 15-27C30 6.7 23.3 0 15 0Z" fill="#df3029" stroke="#ffffff" stroke-width="2"/>
      <circle cx="15" cy="15" r="5.5" fill="#ffffff"/>
    </svg>
  `,
  iconSize: [30, 42],
  iconAnchor: [15, 42],
});

interface CoordinateMapProps {
  lat: number;
  lng: number;
  zoom?: number;
  /** Jika diisi, peta bisa diklik dan penanda bisa digeser untuk mengubah koordinat. */
  onPick?: (lat: number, lng: number) => void;
}

function roundCoord(value: number) {
  return Number(value.toFixed(7));
}

export default function CoordinateMap({ lat, lng, zoom = 17, onPick }: CoordinateMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  // Inisialisasi peta sekali saat komponen dipasang.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = L.map(container, {
      center: [lat, lng],
      zoom,
      zoomControl: true,
      attributionControl: true,
    });
    mapRef.current = map;

    const streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    });
    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles &copy; Esri', maxZoom: 19 }
    );

    streets.addTo(map);
    L.control
      .layers({ 'Peta Jalan': streets, 'Citra Satelit': satellite }, undefined, { position: 'topright' })
      .addTo(map);

    const marker = L.marker([lat, lng], { icon: PIN_ICON, draggable: true })
      .addTo(map)
      .bindTooltip('Titik koordinat kejadian', { direction: 'top', offset: [0, -34] });
    markerRef.current = marker;

    marker.on('dragend', () => {
      const position = marker.getLatLng();
      onPickRef.current?.(roundCoord(position.lat), roundCoord(position.lng));
    });

    map.on('click', (event: L.LeafletMouseEvent) => {
      onPickRef.current?.(roundCoord(event.latlng.lat), roundCoord(event.latlng.lng));
    });

    // Peta baru dirender di dalam panel yang sebelumnya tersembunyi, jadi ukurannya
    // perlu dihitung ulang setelah browser selesai melakukan layout.
    const resizeTimer = window.setTimeout(() => map.invalidateSize(), 150);
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);

    return () => {
      window.clearTimeout(resizeTimer);
      observer.disconnect();
      map.off();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Sengaja hanya sekali; perubahan koordinat ditangani efek di bawah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ikuti perubahan koordinat dari input.
  const pickEnabled = Boolean(onPick);
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;

    const target = L.latLng(lat, lng);
    if (!map.getCenter().equals(target)) {
      map.setView(target, Math.max(map.getZoom(), zoom), { animate: true });
    }
    marker.setLatLng(target);
    if (pickEnabled) {
      marker.dragging?.enable();
    } else {
      marker.dragging?.disable();
    }
  }, [lat, lng, zoom, pickEnabled]);

  return (
    <div
      ref={containerRef}
      className={onPick ? 'coordinate-map pickable' : 'coordinate-map'}
      role="application"
      aria-label={`Peta lokasi kejadian pada koordinat ${lat}, ${lng}`}
    />
  );
}
