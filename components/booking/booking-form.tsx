"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TOWING_BASE_MILES, TOWING_PRICE_PER_MILE_CENTS, DEFAULT_MULTIPLIER_BP } from "@/lib/constants";
import { AddressAutocomplete } from "@/components/maps/address-autocomplete";
import { Check, ArrowRight, ArrowLeft, Loader2, MapPin } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { PaymentMethodSelector } from "@/components/booking/payment-method-selector";
import { ReferralCreditSelector } from "@/components/booking/referral-credit-selector";
import { useGoogleMaps } from "@/lib/hooks/use-google-maps";

interface Service {
  id: string;
  name: string;
  slug: string;
  description?: string;
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
  const [bookingMode, setBookingMode] = useState<"immediate" | "scheduled">("immediate");
  const [notes, setNotes] = useState("");
  const [pickupCoords, setPickupCoords] = useState<{ latitude: number; longitude: number; placeId: string } | null>(null);
  const [destCoords, setDestCoords] = useState<{ latitude: number; longitude: number; placeId: string } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [referralCreditApplied, setReferralCreditApplied] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stepErrors, setStepErrors] = useState<string[]>([]);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const { isLoaded: mapsLoaded } = useGoogleMaps();

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

  // Server-fetched pricing breakdown
  const [pricingBreakdown, setPricingBreakdown] = useState<{
    basePrice: number;
    multiplier: number;
    blockName: string;
    finalPrice: number;
  } | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);

  useEffect(() => {
    if (!selectedServiceId) {
      setPricingBreakdown(null);
      return;
    }
    const controller = new AbortController();
    setPricingLoading(true);
    const params = new URLSearchParams({ serviceId: selectedServiceId });
    if (bookingMode === "scheduled" && scheduledAt) {
      params.set("scheduledAt", new Date(scheduledAt).toISOString());
    }
    fetch(`/api/pricing-estimate?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setPricingBreakdown(data))
      .catch((err) => {
        if (err.name !== "AbortError") setPricingBreakdown(null);
      })
      .finally(() => setPricingLoading(false));
    return () => controller.abort();
  }, [selectedServiceId, bookingMode, scheduledAt]);

  // Calculate display price from server pricing + client-side towing additive
  let estimatedPrice = pricingBreakdown?.finalPrice ?? selectedService?.basePrice ?? 0;
  if (isTowing && estimatedMiles) {
    const miles = parseFloat(estimatedMiles);
    const extraMiles = Math.max(0, miles - TOWING_BASE_MILES);
    estimatedPrice += extraMiles * TOWING_PRICE_PER_MILE_CENTS;
  }

  async function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser.");
      return;
    }
    setGpsLoading(true);
    setGpsError("");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setPickupCoords({ latitude, longitude, placeId: "" });
        if (mapsLoaded && google?.maps?.Geocoder) {
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
            if (status === "OK" && results && results[0]) {
              setAddress(results[0].formatted_address);
            } else {
              setAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
            }
            setGpsLoading(false);
          });
        } else {
          setAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
          setGpsLoading(false);
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError("Location access denied. Please enter your address manually.");
        } else if (err.code === err.TIMEOUT) {
          setGpsError("Location request timed out. Please enter your address manually.");
        } else {
          setGpsError("Unable to detect your location. Please enter your address manually.");
        }
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // Compute min schedule time in local timezone for datetime-local input
  const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const minScheduleTime = `${twoHoursFromNow.getFullYear()}-${String(twoHoursFromNow.getMonth() + 1).padStart(2, "0")}-${String(twoHoursFromNow.getDate()).padStart(2, "0")}T${String(twoHoursFromNow.getHours()).padStart(2, "0")}:${String(twoHoursFromNow.getMinutes()).padStart(2, "0")}`;

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
      if (bookingMode === "scheduled" && !scheduledAt) {
        errors.push("Please select a date and time for your appointment.");
      }
      if (bookingMode === "scheduled" && scheduledAt && new Date(scheduledAt) <= new Date(Date.now() + 2 * 60 * 60 * 1000)) {
        errors.push("Scheduled time must be at least 2 hours from now.");
      }
    }
    return errors;
  }

  function handleNext() {
    const errors = validateStep(step);
    if (errors.length > 0) {
      setStepErrors(errors);
      // Scroll to validation errors
      document.querySelector("[data-validation-errors]")?.scrollIntoView({ behavior: "smooth", block: "center" });
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
          paymentMethod: paymentMethod || undefined,
          referralCreditApplied: referralCreditApplied > 0 ? referralCreditApplied : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        const detail = data.details?.[0]?.message;
        throw new Error(detail || data.error || "Failed to create booking");
      }

      const booking = await res.json();
      router.push(`/book/confirmation?bookingId=${booking.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create booking";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Step Progress Indicator */}
      <nav aria-label="Booking progress" className="mb-8">
        <ol className="flex items-center justify-between">
          {STEPS.map((s, i) => {
            const stepNum = i + 1;
            const isCompleted = step > stepNum;
            const isCurrent = step === stepNum;
            return (
              <li key={s.label} className="flex flex-1 items-center">
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
        <div data-validation-errors className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <ul className="space-y-1 text-sm text-destructive">
            {stepErrors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Step 1: Service Selection */}
      {step === 1 && (
        <>
          {/* Booking Mode Toggle */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setBookingMode("immediate");
                setScheduledAt("");
              }}
              className={cn(
                "flex-1 rounded-lg border p-4 text-center font-medium transition-colors min-h-[44px] min-w-[44px]",
                bookingMode === "immediate"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:border-muted-foreground/30 hover:bg-muted"
              )}
            >
              Get Help Now
            </button>
            <button
              type="button"
              onClick={() => setBookingMode("scheduled")}
              className={cn(
                "flex-1 rounded-lg border p-4 text-center font-medium transition-colors min-h-[44px] min-w-[44px]",
                bookingMode === "scheduled"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:border-muted-foreground/30 hover:bg-muted"
              )}
            >
              Schedule for Later
            </button>
          </div>

          {/* Emergency Roadside Services */}
          <Card>
            <CardHeader>
              <CardTitle>Emergency Roadside</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {services.filter((s) => s.category === "roadside").map((s) => (
                  <button
                    key={s.id}
                    type="button"
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
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pre-Purchase Inspection Services */}
          <Card>
            <CardHeader>
              <CardTitle>Pre-Purchase Inspection</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {services.filter((s) => s.category === "diagnostics").map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedServiceId(s.id)}
                    className={cn(
                      "flex flex-col rounded-lg border-2 p-4 text-left transition-colors hover:border-primary/50",
                      selectedServiceId === s.id
                        ? "border-primary bg-primary/5"
                        : "border-muted"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{s.name}</span>
                      <span className="text-2xl font-bold">{formatPrice(s.basePrice)}</span>
                    </div>
                    {s.description && (
                      <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>
                    )}
                    <span className="mt-2 text-xs text-muted-foreground">Payment upfront</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Step 2: Location & Vehicle */}
      {step === 2 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Your Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                type="button"
                variant="outline"
                className="w-full min-h-[44px]"
                onClick={handleUseMyLocation}
                disabled={gpsLoading}
              >
                {gpsLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="mr-2 h-4 w-4" />
                )}
                {gpsLoading ? "Detecting location..." : "Use My Current Location"}
              </Button>
              {gpsError && (
                <p className="text-sm text-destructive">{gpsError}</p>
              )}
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

          {bookingMode === "immediate" ? (
            <Card>
              <CardContent className="py-4">
                <p className="text-sm font-medium text-primary">
                  Immediate Service — a provider will be dispatched right away
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Schedule Appointment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Select your preferred date and time (minimum 2 hours from now)
                </p>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  min={minScheduleTime}
                  required
                />
                {scheduledAt && new Date(scheduledAt) <= new Date(Date.now() + 2 * 60 * 60 * 1000) && (
                  <p className="text-sm text-destructive">Must be at least 2 hours from now</p>
                )}
              </CardContent>
            </Card>
          )}

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
                  <p className="text-sm">
                    <span className="text-muted-foreground">Service Mode:</span>{" "}
                    {bookingMode === "immediate"
                      ? "Immediate — dispatching now"
                      : `Scheduled for ${new Date(scheduledAt).toLocaleString()}`}
                  </p>
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

            {/* Referral Credit */}
            {!!userInfo && (
              <ReferralCreditSelector
                bookingPrice={estimatedPrice}
                onCreditChange={setReferralCreditApplied}
              />
            )}

            {/* Payment Method */}
            <div className="rounded-lg border p-4">
              <PaymentMethodSelector
                value={paymentMethod}
                onChange={setPaymentMethod}
                isAuthenticated={!!userInfo}
              />
            </div>

            {/* Pricing Breakdown */}
            <div className="rounded-lg bg-muted p-4 space-y-2">
              {pricingLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <p className="text-sm text-muted-foreground">Calculating price...</p>
                </div>
              ) : (
                <>
                  {pricingBreakdown && pricingBreakdown.multiplier !== DEFAULT_MULTIPLIER_BP && (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">Base Price</p>
                        <p className="text-sm font-medium">{formatPrice(pricingBreakdown.basePrice)}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                          {pricingBreakdown.blockName} {(pricingBreakdown.multiplier / 10000).toFixed(2)}x
                        </span>
                        <p className="text-sm font-medium">{formatPrice(pricingBreakdown.finalPrice)}</p>
                      </div>
                    </>
                  )}
                  {isTowing && estimatedMiles && pricingBreakdown && (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Towing mileage</p>
                      <p className="text-sm font-medium">
                        +{formatPrice(estimatedPrice - pricingBreakdown.finalPrice)}
                      </p>
                    </div>
                  )}
                  {pricingBreakdown && pricingBreakdown.multiplier !== DEFAULT_MULTIPLIER_BP && (
                    <div className="border-t pt-2 mt-2" />
                  )}
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Estimated Total</p>
                    <p className="text-3xl font-bold">{formatPrice(estimatedPrice)}</p>
                  </div>
                </>
              )}
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
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
