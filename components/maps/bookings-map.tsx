"use client";

import { useRef, useEffect, useState } from "react";
import { useGoogleMaps } from "@/lib/hooks/use-google-maps";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BookingMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  status: string;
}

interface ProviderMarker {
  id: string;
  lat: number;
  lng: number;
  name: string;
  isAvailable: boolean;
}

interface BookingsMapProps {
  bookings?: BookingMarker[];
  providers?: ProviderMarker[];
  className?: string;
}

export function BookingsMap({ bookings = [], providers = [], className }: BookingsMapProps) {
  const { isLoaded, error } = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [infoWindow, setInfoWindow] = useState<google.maps.InfoWindow | null>(null);

  useEffect(() => {
    if (!isLoaded || !mapRef.current || mapInstanceRef.current) return;

    const map = new google.maps.Map(mapRef.current, {
      center: { lat: 33.749, lng: -84.388 },
      zoom: 10,
      mapId: "bookings-map",
    });

    mapInstanceRef.current = map;
    setInfoWindow(new google.maps.InfoWindow());
  }, [isLoaded]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !infoWindow) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    let hasMarkers = false;

    // Booking markers (blue)
    bookings.forEach((b) => {
      const marker = new google.maps.Marker({
        position: { lat: b.lat, lng: b.lng },
        map,
        title: b.label,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: "#3b82f6",
          fillOpacity: 1,
          strokeColor: "#1d4ed8",
          strokeWeight: 2,
          scale: 8,
        },
      });

      marker.addListener("click", () => {
        infoWindow.setContent(
          `<div style="padding:4px"><strong>${b.label}</strong><br/>Status: ${b.status}</div>`
        );
        infoWindow.open(map, marker);
      });

      markersRef.current.push(marker);
      bounds.extend({ lat: b.lat, lng: b.lng });
      hasMarkers = true;
    });

    // Provider markers (green)
    providers.forEach((p) => {
      const marker = new google.maps.Marker({
        position: { lat: p.lat, lng: p.lng },
        map,
        title: p.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: p.isAvailable ? "#22c55e" : "#6b7280",
          fillOpacity: 1,
          strokeColor: p.isAvailable ? "#15803d" : "#4b5563",
          strokeWeight: 2,
          scale: 8,
        },
      });

      marker.addListener("click", () => {
        infoWindow.setContent(
          `<div style="padding:4px"><strong>${p.name}</strong><br/>${p.isAvailable ? "Available" : "Unavailable"}</div>`
        );
        infoWindow.open(map, marker);
      });

      markersRef.current.push(marker);
      bounds.extend({ lat: p.lat, lng: p.lng });
      hasMarkers = true;
    });

    if (hasMarkers) {
      map.fitBounds(bounds);
      const listener = google.maps.event.addListener(map, "idle", () => {
        if (map.getZoom()! > 15) map.setZoom(15);
        google.maps.event.removeListener(listener);
      });
    }
  }, [bookings, providers, infoWindow]);

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Map</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Map unavailable: {error}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Map</CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={mapRef} className="h-[400px] w-full rounded-md" />
      </CardContent>
    </Card>
  );
}
