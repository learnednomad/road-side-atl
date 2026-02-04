import Link from "next/link";
import {
  Battery,
  Truck,
  KeyRound,
  CircleDot,
  Fuel,
  Wrench,
} from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const iconMap: Record<string, React.ElementType> = {
  "jump-start": Battery,
  towing: Truck,
  lockout: KeyRound,
  "flat-tire": CircleDot,
  "fuel-delivery": Fuel,
  "car-purchase-diagnostics": Wrench,
};

interface ServiceCardProps {
  name: string;
  slug: string;
  description: string;
  basePrice: number;
  pricePerMile?: number | null;
  category: string;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

export function ServiceCard({
  name,
  slug,
  description,
  basePrice,
  pricePerMile,
  category,
}: ServiceCardProps) {
  const Icon = iconMap[slug] || Wrench;
  const isDiagnostics = category === "diagnostics";

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          {isDiagnostics && (
            <Badge variant="secondary">Payment Upfront</Badge>
          )}
        </div>
        <CardTitle className="text-lg">{name}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <p className="mb-3 text-sm text-muted-foreground">{description}</p>
        <p className="text-2xl font-bold">
          {formatPrice(basePrice)}
          {pricePerMile && (
            <span className="text-sm font-normal text-muted-foreground">
              {" "}
              + {formatPrice(pricePerMile)}/mi beyond 10mi
            </span>
          )}
        </p>
      </CardContent>
      <CardFooter>
        <Link href={`/book?service=${slug}`} className="w-full">
          <Button className="w-full">Book Now</Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
