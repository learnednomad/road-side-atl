"use client";

import { useRef, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { useGoogleMaps } from "@/lib/hooks/use-google-maps";

interface PlaceResult {
  address: string;
  latitude: number;
  longitude: number;
  placeId: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected?: (place: PlaceResult) => void;
  placeholder?: string;
  id?: string;
  required?: boolean;
}

export function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  placeholder = "Enter address...",
  id,
  required,
}: AddressAutocompleteProps) {
  const { isLoaded, error } = useGoogleMaps();
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!isLoaded || !inputRef.current || initialized) return;

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      types: ["address"],
      componentRestrictions: { country: "us" },
      fields: ["formatted_address", "geometry", "place_id"],
    });

    // Bias to Atlanta metro
    const atlantaCenter = new google.maps.LatLng(33.749, -84.388);
    const circle = new google.maps.Circle({ center: atlantaCenter, radius: 50000 });
    autocomplete.setBounds(circle.getBounds()!);

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (place.formatted_address) {
        onChange(place.formatted_address);
        if (onPlaceSelected && place.geometry?.location) {
          onPlaceSelected({
            address: place.formatted_address,
            latitude: place.geometry.location.lat(),
            longitude: place.geometry.location.lng(),
            placeId: place.place_id || "",
          });
        }
      }
    });

    autocompleteRef.current = autocomplete;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- map initialization state
    setInitialized(true);
  }, [isLoaded, initialized, onChange, onPlaceSelected]);

  if (error) {
    return (
      <Input
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    );
  }

  return (
    <Input
      ref={inputRef}
      id={id}
      placeholder={isLoaded ? placeholder : "Loading maps..."}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
    />
  );
}
