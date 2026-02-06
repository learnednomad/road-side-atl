"use client";

import { useEffect, useRef, useState } from "react";
import { useGoogleMaps } from "@/lib/hooks/use-google-maps";

interface Location {
  lat: number;
  lng: number;
}

interface LiveTrackingMapProps {
  pickupLocation: Location;
  destinationLocation?: Location;
  providerLocation?: Location | null;
  providerName?: string;
  className?: string;
}

export function LiveTrackingMap({
  pickupLocation,
  destinationLocation,
  providerLocation,
  providerName,
  className = "h-[400px] w-full rounded-lg",
}: LiveTrackingMapProps) {
  const { isLoaded, error } = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const pickupMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const destMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const providerMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const [mapId] = useState(() => `map-${Math.random().toString(36).slice(2)}`);

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapRef.current || mapInstanceRef.current) return;

    const map = new google.maps.Map(mapRef.current, {
      center: pickupLocation,
      zoom: 14,
      mapId: "roadside_tracking_map",
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });

    mapInstanceRef.current = map;

    // Create pickup marker (blue)
    const pickupPin = document.createElement("div");
    pickupPin.innerHTML = `
      <div style="background: #3b82f6; border: 3px solid white; border-radius: 50%; width: 24px; height: 24px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
        <div style="background: white; border-radius: 50%; width: 8px; height: 8px;"></div>
      </div>
    `;
    pickupMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
      map,
      position: pickupLocation,
      title: "Pickup Location",
      content: pickupPin,
    });

    // Create destination marker (green) if provided
    if (destinationLocation) {
      const destPin = document.createElement("div");
      destPin.innerHTML = `
        <div style="background: #22c55e; border: 3px solid white; border-radius: 50%; width: 24px; height: 24px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
          <div style="background: white; border-radius: 50%; width: 8px; height: 8px;"></div>
        </div>
      `;
      destMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: destinationLocation,
        title: "Destination",
        content: destPin,
      });
    }

    // Fit bounds to show all markers
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(pickupLocation);
    if (destinationLocation) bounds.extend(destinationLocation);
    if (providerLocation) bounds.extend(providerLocation);
    map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });

    return () => {
      mapInstanceRef.current = null;
    };
  }, [isLoaded, pickupLocation, destinationLocation]);

  // Update provider marker position
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current) return;

    if (providerLocation) {
      if (!providerMarkerRef.current) {
        // Create provider marker (orange truck icon)
        const providerPin = document.createElement("div");
        providerPin.innerHTML = `
          <div style="background: #f97316; border: 3px solid white; border-radius: 8px; padding: 6px 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 4px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
              <path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
            <span style="color: white; font-size: 11px; font-weight: 600;">${providerName || "Provider"}</span>
          </div>
        `;
        providerMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
          map: mapInstanceRef.current,
          position: providerLocation,
          title: providerName || "Provider",
          content: providerPin,
        });
      } else {
        providerMarkerRef.current.position = providerLocation;
      }

      // Refit bounds
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(pickupLocation);
      if (destinationLocation) bounds.extend(destinationLocation);
      bounds.extend(providerLocation);
      mapInstanceRef.current.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
    }
  }, [isLoaded, providerLocation, providerName, pickupLocation, destinationLocation]);

  if (error) {
    return (
      <div className={`${className} bg-muted flex items-center justify-center`}>
        <p className="text-muted-foreground text-sm">Map unavailable</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`${className} bg-muted animate-pulse flex items-center justify-center`}>
        <p className="text-muted-foreground text-sm">Loading map...</p>
      </div>
    );
  }

  return <div ref={mapRef} className={className} />;
}
