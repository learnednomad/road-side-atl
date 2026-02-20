"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressAutocomplete } from "@/components/maps/address-autocomplete";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, MapPin, Phone, User, DollarSign, CheckCircle2 } from "lucide-react";

interface ProviderProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  isAvailable: boolean;
  commissionRate: number;
  commissionType: "percentage" | "flat_per_job";
  flatFeeAmount: number | null;
  specialties: string[];
  status: string;
}

export default function ProviderSettingsPage() {
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await fetch("/api/provider/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setName(data.name);
        setPhone(data.phone);
        setAddress(data.address || "");
        if (data.latitude && data.longitude) {
          setCoordinates({ latitude: data.latitude, longitude: data.longitude });
        }
      }
    } catch {
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  async function toggleAvailability() {
    if (!profile) return;
    setSaving(true);
    try {
      const res = await fetch("/api/provider/availability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: !profile.isAvailable }),
      });
      if (res.ok) {
        setProfile({ ...profile, isAvailable: !profile.isAvailable });
        toast.success(profile.isAvailable ? "You are now offline" : "You are now available");
      } else {
        toast.error("Failed to update availability");
      }
    } finally {
      setSaving(false);
    }
  }

  async function updateProfile() {
    setSaving(true);
    try {
      const res = await fetch("/api/provider/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          address,
          ...(coordinates || {}),
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProfile((prev) => (prev ? { ...prev, ...updated } : null));
        toast.success("Profile updated successfully");
      } else {
        toast.error("Failed to update profile");
      }
    } finally {
      setSaving(false);
    }
  }

  // Unsaved changes warning
  const isDirty =
    profile !== null &&
    (name !== profile.name || phone !== profile.phone || address !== (profile.address || ""));

  useEffect(() => {
    if (!isDirty) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /><span className="sr-only">Loading...</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Failed to load profile</p>
      </div>
    );
  }

  const commissionDisplay =
    profile.commissionType === "percentage"
      ? `${(profile.commissionRate / 100).toFixed(0)}% of job total`
      : `$${((profile.flatFeeAmount || 0) / 100).toFixed(2)} per job`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Settings</h1>
        <Badge variant={profile.status === "active" ? "default" : "secondary"}>
          {profile.status}
        </Badge>
      </div>

      {/* Availability Card */}
      <Card>
        <CardHeader>
          <CardTitle>Availability</CardTitle>
          <CardDescription>Control whether you receive new job assignments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div aria-hidden="true"
                className={`w-3 h-3 rounded-full ${profile.isAvailable ? "bg-green-500" : "bg-gray-400"}`}
              />
              <span className="font-medium">
                {profile.isAvailable ? "Available for jobs" : "Offline"}
              </span>
            </div>
            <Button
              variant={profile.isAvailable ? "outline" : "default"}
              onClick={toggleAvailability}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {profile.isAvailable ? "Go Offline" : "Go Available"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Profile Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your contact details and base location</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">
                <User className="inline h-4 w-4 mr-1" />
                Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">
                <Phone className="inline h-4 w-4 mr-1" />
                Phone
              </Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(404) 555-0100"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              <MapPin className="inline h-4 w-4 mr-1" />
              Base Address
            </Label>
            <AddressAutocomplete
              value={address}
              onChange={setAddress}
              onPlaceSelected={(place) => {
                setAddress(place.address);
                setCoordinates({ latitude: place.latitude, longitude: place.longitude });
              }}
              placeholder="Enter your base address for dispatch calculations..."
            />
            {coordinates && (
              <p className="text-xs text-muted-foreground">
                Coordinates: {coordinates.latitude.toFixed(4)}, {coordinates.longitude.toFixed(4)}
              </p>
            )}
          </div>

          <div className="pt-2">
            <Button onClick={updateProfile} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Commission Structure Card */}
      <Card>
        <CardHeader>
          <CardTitle>
            <DollarSign className="inline h-5 w-5 mr-1" />
            Commission Structure
          </CardTitle>
          <CardDescription>Your earnings structure for completed jobs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="font-semibold text-lg">{commissionDisplay}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {profile.commissionType === "percentage"
                ? "You earn a percentage of each completed job's total price."
                : "You earn a flat fee for each completed job, regardless of job total."}
            </p>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Commission rates are set by the administrator. Contact support to request changes.
          </p>
        </CardContent>
      </Card>

      {/* Specialties Card */}
      <Card>
        <CardHeader>
          <CardTitle>Service Specialties</CardTitle>
          <CardDescription>Types of services you're qualified to provide</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {profile.specialties && profile.specialties.length > 0 ? (
              profile.specialties.map((s) => (
                <Badge key={s} variant="secondary" className="capitalize">
                  {s}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">No specialties assigned</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Specialties are assigned by the administrator based on your qualifications.
          </p>
        </CardContent>
      </Card>

      {/* Account Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span>{profile.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Provider ID</span>
            <span className="font-mono text-xs">{profile.id}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
