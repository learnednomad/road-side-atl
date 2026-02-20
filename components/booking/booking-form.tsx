"use client";

import { useState, useEffect, useRef } from "react";
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
import { AddressAutocomplete } from "@/components/maps/address-autocomplete";
import { Check, ArrowRight, ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";

interface Service {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  pricePerMile: number | null;
  category: string;
}

const STEPS = [
  { label: "Service", shortLabel: "Service" },
  { label: "Location & Vehicle", shortLabel: "Details" },
  { label: "Contact & Schedule", shortLabel: "Contact" },
  { label: "Review & Book", shortLabel: "Review" },
];

export function BookingForm({ services, userInfo }: { services: Service[]; userInfo?: { name: string; email: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedSlug = searchParams.get("service");

  const [step, setStep] = useState(1);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [address, setAddress] = useState("");
  const [locationNotes, setLocationNotes] = useState("");
  const [destination, setDestination] = useState("");
  const [estimatedMiles, setEstimatedMiles] = useState("");
  const [contactName, setContactName] = useState(userInfo?.name || "");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState(userInfo?.email || "");
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [pickupCoords, setPickupCoords] = useState<{ latitude: number; longitude: number; placeId: string } | null>(null);
  const [destCoords, setDestCoords] = useState<{ latitude: number; longitude: number; placeId: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stepErrors, setStepErrors] = useState<string[]>([]);
  const errorsRef = useRef<HTMLDivElement>(null);

  // Pre-select service from query param
  useEffect(() => {
    if (preselectedSlug) {
      const match = services.find((s) => s.slug === preselectedSlug);
      if (match) {
        setSelectedServiceId(match.id);
        setStep(2); // Skip to step 2 if service is pre-selected
      }
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

  function validateStep(s: number): string[] {
    const errors: string[] = [];
    if (s === 1) {
      if (!selectedServiceId) errors.push("Please select a service.");
    }
    if (s === 2) {
      if (!address) errors.push("Address is required.");
      if (!vehicleYear) {
        errors.push("Vehicle year is required.");
      } else {
        const yearNum = parseInt(vehicleYear, 10);
        if (isNaN(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear() + 2) {
          errors.push("Please enter a valid vehicle year.");
        }
      }
      if (!vehicleMake) errors.push("Vehicle make is required.");
      if (!vehicleModel) errors.push("Vehicle model is required.");
      if (!vehicleColor) errors.push("Vehicle color is required.");
    }
    if (s === 3) {
      if (!contactName) errors.push("Full name is required.");
      if (!contactPhone) {
        errors.push("Phone number is required.");
      } else {
        const phoneDigits = contactPhone.replace(/\D/g, "");
        if (phoneDigits.length < 10) {
          errors.push("Please enter a valid phone number (at least 10 digits).");
        }
      }
      if (!contactEmail) {
        errors.push("Email is required.");
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
        errors.push("Please enter a valid email address.");
      }
    }
    return errors;
  }

  function handleNext() {
    const errors = validateStep(step);
    if (errors.length > 0) {
      setStepErrors(errors);
      requestAnimationFrame(() => {
        errorsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        errorsRef.current?.focus();
      });
      return;
    }
    setStepErrors([]);
    setStep((s) => Math.min(s + 1, 4));
  }

  function handleBack() {
    setStepErrors([]);
    setStep((s) => Math.max(s - 1, 1));
  }

  async function handleSubmit() {
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
            latitude: pickupCoords?.latitude,
            longitude: pickupCoords?.longitude,
            placeId: pickupCoords?.placeId,
            notes: locationNotes || undefined,
            destination: destination || undefined,
            destinationLatitude: destCoords?.latitude,
            destinationLongitude: destCoords?.longitude,
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
    <div className="space-y-8">
      {/* Safety Notice */}
      <div className="flex items-start gap-3 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm" role="alert">
        <AlertTriangle aria-hidden="true" className="h-5 w-5 shrink-0 text-yellow-600 mt-0.5" />
        <div>
          <p className="font-medium text-yellow-800">If you are in immediate danger, call 911</p>
          <p className="text-yellow-700 mt-0.5">
            This service is for non-emergency roadside assistance.{" "}
            <a href="tel:911" className="font-medium underline">Call 911</a> for emergencies.
          </p>
        </div>
      </div>

      {/* Step Progress Indicator */}
      <nav aria-label="Booking progress" className="mb-8">
        <ol className="flex items-center justify-between">
          {STEPS.map((s, i) => {
            const stepNum = i + 1;
            const isCompleted = step > stepNum;
            const isCurrent = step === stepNum;
            return (
              <li key={s.label} className="flex flex-1 items-center" aria-current={isCurrent ? "step" : undefined}>
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                      isCompleted
                        ? "border-primary bg-primary text-primary-foreground"
                        : isCurrent
                          ? "border-primary bg-background text-primary"
                          : "border-muted-foreground/30 bg-background text-muted-foreground/50"
                    )}
                  >
                    {isCompleted ? <Check className="h-4 w-4" /> : stepNum}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isCurrent ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground/50"
                    )}
                  >
                    <span className="hidden sm:inline">{s.label}</span>
                    <span className="sm:hidden">{s.shortLabel}</span>
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "mx-2 h-0.5 flex-1",
                      step > stepNum ? "bg-primary" : "bg-muted-foreground/20"
                    )}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Validation Errors */}
      {stepErrors.length > 0 && (
        <div ref={errorsRef} tabIndex={-1} role="alert" aria-live="assertive" className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 outline-none">
          <ul className="space-y-1 text-sm text-destructive">
            {stepErrors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Step 1: Service Selection */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Your Service</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Select a service">
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={selectedServiceId === s.id}
                  onClick={() => setSelectedServiceId(s.id)}
                  className={cn(
                    "flex flex-col rounded-lg border-2 p-4 text-left transition-colors hover:border-primary/50",
                    selectedServiceId === s.id
                      ? "border-primary bg-primary/5"
                      : "border-muted"
                  )}
                >
                  <span className="font-semibold">{s.name}</span>
                  <span className="mt-1 text-2xl font-bold">
                    {formatPrice(s.basePrice)}
                    {s.pricePerMile && (
                      <span className="text-sm font-normal text-muted-foreground">+</span>
                    )}
                  </span>
                  {s.category === "diagnostics" && (
                    <span className="mt-1 text-xs text-muted-foreground">Payment upfront</span>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Location & Vehicle */}
      {step === 2 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Your Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="address">Address / Location <span className="text-destructive">*</span></Label>
                <AddressAutocomplete
                  id="address"
                  placeholder="123 Peachtree St, Atlanta, GA"
                  value={address}
                  onChange={setAddress}
                  onPlaceSelected={(place) => {
                    setAddress(place.address);
                    setPickupCoords({ latitude: place.latitude, longitude: place.longitude, placeId: place.placeId });
                  }}
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
                    <AddressAutocomplete
                      id="destination"
                      placeholder="456 Main St, Atlanta, GA"
                      value={destination}
                      onChange={setDestination}
                      onPlaceSelected={(place) => {
                        setDestination(place.address);
                        setDestCoords({ latitude: place.latitude, longitude: place.longitude, placeId: place.placeId });
                      }}
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

          <Card>
            <CardHeader>
              <CardTitle>Vehicle Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="year">Year <span className="text-destructive">*</span></Label>
                <Input
                  id="year"
                  placeholder="2020"
                  value={vehicleYear}
                  onChange={(e) => setVehicleYear(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="make">Make <span className="text-destructive">*</span></Label>
                <Input
                  id="make"
                  placeholder="Honda"
                  value={vehicleMake}
                  onChange={(e) => setVehicleMake(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="model">Model <span className="text-destructive">*</span></Label>
                <Input
                  id="model"
                  placeholder="Civic"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="color">Color <span className="text-destructive">*</span></Label>
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
        </>
      )}

      {/* Step 3: Contact & Schedule */}
      {step === 3 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="name">Full Name <span className="text-destructive">*</span></Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number <span className="text-destructive">*</span></Label>
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
                <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
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

          <Card>
            <CardHeader>
              <CardTitle>Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Label htmlFor="scheduledAt">Preferred Date & Time</Label>
              <p id="schedule-hint" className="text-sm text-muted-foreground">
                Leave blank for ASAP service, or pick a date and time.
              </p>
              <Input
                id="scheduledAt"
                type="datetime-local"
                aria-describedby="schedule-hint"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Additional Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="booking-notes" className="sr-only">Additional Notes</Label>
              <Textarea
                id="booking-notes"
                placeholder="Anything else we should know..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </CardContent>
          </Card>
        </>
      )}

      {/* Step 4: Review & Submit */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Review Your Booking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Service */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Service</p>
                  <p className="font-semibold">{selectedService?.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-sm text-primary hover:underline"
                >
                  Edit
                </button>
              </div>
            </div>

            {/* Location & Vehicle */}
            <div className="rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="font-medium">{address}</p>
                    {isTowing && destination && (
                      <p className="text-sm text-muted-foreground">To: {destination}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Vehicle</p>
                    <p className="font-medium">
                      {vehicleYear} {vehicleMake} {vehicleModel} ({vehicleColor})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-sm text-primary hover:underline"
                >
                  Edit
                </button>
              </div>
            </div>

            {/* Contact */}
            <div className="rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Contact</p>
                  <p className="font-medium">{contactName}</p>
                  <p className="text-sm text-muted-foreground">{contactPhone}</p>
                  <p className="text-sm text-muted-foreground">{contactEmail}</p>
                  {scheduledAt && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Scheduled:</span>{" "}
                      {new Date(scheduledAt).toLocaleString()}
                    </p>
                  )}
                  {!scheduledAt && (
                    <p className="text-sm font-medium text-primary">ASAP Service</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="text-sm text-primary hover:underline"
                >
                  Edit
                </button>
              </div>
            </div>

            {notes && (
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Notes</p>
                <p className="text-sm">{notes}</p>
              </div>
            )}

            {/* Price */}
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">Estimated Total</p>
              <p className="text-3xl font-bold">{formatPrice(estimatedPrice)}</p>
              {isTowing && estimatedMiles && selectedService && (
                <p className="text-sm text-muted-foreground">
                  Base: {formatPrice(selectedService.basePrice)} + mileage
                </p>
              )}
            </div>

            {error && (
              <p role="alert" aria-live="assertive" className="text-sm text-destructive">{error}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between gap-4">
        {step > 1 ? (
          <Button type="button" variant="outline" size="lg" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        ) : (
          <div />
        )}

        {step < 4 ? (
          <Button type="button" size="lg" onClick={handleNext}>
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            onClick={handleSubmit}
            disabled={loading}
            className="min-w-[200px]"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Submitting..." : "Confirm Booking"}
          </Button>
        )}
      </div>
    </div>
  );
}
