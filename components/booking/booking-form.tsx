"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TOWING_BASE_MILES, TOWING_PRICE_PER_MILE_CENTS } from "@/lib/constants";

interface Service {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  pricePerMile: number | null;
  category: string;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function BookingForm({ services }: { services: Service[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedSlug = searchParams.get("service");

  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [address, setAddress] = useState("");
  const [locationNotes, setLocationNotes] = useState("");
  const [destination, setDestination] = useState("");
  const [estimatedMiles, setEstimatedMiles] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Pre-select service from query param
  useEffect(() => {
    if (preselectedSlug) {
      const match = services.find((s) => s.slug === preselectedSlug);
      if (match) setSelectedServiceId(match.id);
    }
  }, [preselectedSlug, services]);

  const selectedService = services.find((s) => s.id === selectedServiceId);
  const isTowing = selectedService?.slug === "towing";

  // Calculate price estimate
  let estimatedPrice = selectedService?.basePrice || 0;
  if (isTowing && estimatedMiles) {
    const miles = parseFloat(estimatedMiles);
    const extraMiles = Math.max(0, miles - TOWING_BASE_MILES);
    estimatedPrice += extraMiles * TOWING_PRICE_PER_MILE_CENTS;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: selectedServiceId,
          vehicleInfo: {
            year: vehicleYear,
            make: vehicleMake,
            model: vehicleModel,
            color: vehicleColor,
          },
          location: {
            address,
            notes: locationNotes || undefined,
            destination: destination || undefined,
            estimatedMiles: estimatedMiles ? parseFloat(estimatedMiles) : undefined,
          },
          contactName,
          contactPhone,
          contactEmail,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
          notes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create booking");
      }

      const booking = await res.json();
      router.push(`/book/confirmation?bookingId=${booking.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Service Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Service</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a service..." />
            </SelectTrigger>
            <SelectContent>
              {services.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} — {formatPrice(s.basePrice)}
                  {s.pricePerMile ? `+` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Vehicle Info */}
      <Card>
        <CardHeader>
          <CardTitle>Vehicle Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="year">Year</Label>
            <Input
              id="year"
              placeholder="2020"
              value={vehicleYear}
              onChange={(e) => setVehicleYear(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="make">Make</Label>
            <Input
              id="make"
              placeholder="Honda"
              value={vehicleMake}
              onChange={(e) => setVehicleMake(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="model">Model</Label>
            <Input
              id="model"
              placeholder="Civic"
              value={vehicleModel}
              onChange={(e) => setVehicleModel(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="color">Color</Label>
            <Input
              id="color"
              placeholder="Silver"
              value={vehicleColor}
              onChange={(e) => setVehicleColor(e.target.value)}
              required
            />
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="address">Your Address / Location</Label>
            <Input
              id="address"
              placeholder="123 Peachtree St, Atlanta, GA"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="locationNotes">Location Notes (optional)</Label>
            <Textarea
              id="locationNotes"
              placeholder="Near the gas station on the corner..."
              value={locationNotes}
              onChange={(e) => setLocationNotes(e.target.value)}
            />
          </div>
          {isTowing && (
            <>
              <div>
                <Label htmlFor="destination">Tow Destination</Label>
                <Input
                  id="destination"
                  placeholder="456 Main St, Atlanta, GA"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="miles">Estimated Distance (miles)</Label>
                <Input
                  id="miles"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="15"
                  value={estimatedMiles}
                  onChange={(e) => setEstimatedMiles(e.target.value)}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Contact Info */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              placeholder="John Doe"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(404) 555-0100"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="john@example.com"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              required
            />
          </div>
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Schedule (Optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Leave blank for ASAP service, or pick a date and time.
          </p>
          <Input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Anything else we should know..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Price Estimate + Submit */}
      <Card>
        <CardContent className="pt-6">
          {selectedService && (
            <div className="mb-4 rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">Estimated Total</p>
              <p className="text-3xl font-bold">{formatPrice(estimatedPrice)}</p>
              {isTowing && estimatedMiles && (
                <p className="text-sm text-muted-foreground">
                  Base: {formatPrice(selectedService.basePrice)} + mileage
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="mb-4 text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={loading || !selectedServiceId}>
            {loading ? "Submitting..." : "Book Service"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
