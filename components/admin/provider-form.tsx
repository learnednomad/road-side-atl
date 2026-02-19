"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SERVICE_CATEGORIES } from "@/lib/constants";
import { AddressAutocomplete } from "@/components/maps/address-autocomplete";

const formSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.email("Valid email is required"),
  phone: z.string().min(10, "Phone number is required"),
  commissionType: z.enum(["percentage", "flat_per_job"]),
  commissionRate: z.number().int().min(0).max(10000),
  flatFeeAmount: z.number().int().min(0).optional(),
  specialties: z.array(z.string()).optional(),
  status: z.enum(["active", "inactive", "pending", "resubmission_requested"]),
  address: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface ProviderFormProps {
  defaultValues?: Partial<FormValues>;
  onSubmit: (data: FormValues) => Promise<void>;
  submitLabel?: string;
}

export function ProviderForm({
  defaultValues,
  onSubmit,
  submitLabel = "Save",
}: ProviderFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      commissionType: "percentage",
      commissionRate: 7000,
      flatFeeAmount: 0,
      specialties: [],
      status: "pending",
      address: "",
      ...defaultValues,
    },
  });

  const commissionType = form.watch("commissionType");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Provider name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="email@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input placeholder="(404) 555-0100" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="commissionType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Commission Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="flat_per_job">Flat Per Job</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {commissionType === "percentage" ? (
            <FormField
              control={form.control}
              name="commissionRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Commission Rate (basis points)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="7000 = 70%"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">
                    {field.value ? `${(field.value / 100).toFixed(0)}%` : "0%"}
                  </p>
                </FormItem>
              )}
            />
          ) : (
            <FormField
              control={form.control}
              name="flatFeeAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Flat Fee (cents)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="5000 = $50.00"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">
                    {field.value ? `$${(field.value / 100).toFixed(2)}` : "$0.00"}
                  </p>
                </FormItem>
              )}
            />
          )}
        </div>

        <div>
          <FormLabel>Base Address</FormLabel>
          <AddressAutocomplete
            value={form.watch("address") || ""}
            onChange={(val) => form.setValue("address", val)}
            onPlaceSelected={(place) => {
              form.setValue("address", place.address);
              form.setValue("latitude", place.latitude);
              form.setValue("longitude", place.longitude);
            }}
            placeholder="Provider's base address..."
          />
        </div>

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div>
          <FormLabel>Specialties</FormLabel>
          <div className="mt-2 flex gap-2">
            {SERVICE_CATEGORIES.map((cat) => {
              const selected = form.watch("specialties")?.includes(cat);
              return (
                <Button
                  key={cat}
                  type="button"
                  variant={selected ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    const current = form.getValues("specialties") || [];
                    if (selected) {
                      form.setValue(
                        "specialties",
                        current.filter((s) => s !== cat)
                      );
                    } else {
                      form.setValue("specialties", [...current, cat]);
                    }
                  }}
                >
                  {cat}
                </Button>
              );
            })}
          </div>
        </div>

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </form>
    </Form>
  );
}
