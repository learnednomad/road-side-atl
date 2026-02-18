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
import { formatPrice } from "@/lib/utils";

const iconMap: Record<string, React.ElementType> = {
  "jump-start": Battery,
  towing: Truck,
  lockout: KeyRound,
  "flat-tire": CircleDot,
  "fuel-delivery": Fuel,
  "basic-inspection": Wrench,
  "standard-inspection": Wrench,
  "premium-inspection": Wrench,
};

interface ServiceCardProps {
  name: string;
  slug: string;
  description: string;
  basePrice: number;
  pricePerMile?: number | null;
  category: string;
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
    <Card className="flex flex-col" id={slug}>
      <CardHeader>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          {isDiagnostics && (
            <Badge variant="secondary">Payment Upfront</Badge>
          )}
        </div>
        <CardTitle className="text-lg">
          <span>{name}</span>
          <span className="sr-only"> in Atlanta</span>
        </CardTitle>
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
        <Button asChild className="w-full">
          <Link
            href={`/book?service=${slug}`}
            aria-label={`Book ${name} service in Atlanta`}
          >
            Book Now
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
