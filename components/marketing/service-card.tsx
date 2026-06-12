import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatPrice } from "@/lib/utils";

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
  const isDiagnostics = category === "diagnostics";

  return (
    <Link
      href={`/book?service=${slug}`}
      aria-label={`Book ${name} service in Atlanta`}
      id={slug}
      className="group flex flex-col rounded-2xl border border-neutral-200 bg-white/40 p-6 transition-colors hover:border-neutral-400"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-semibold tracking-tight text-neutral-950">
          {name}
          <span className="sr-only"> in Atlanta</span>
        </h3>
        <p className="shrink-0 font-mono text-lg font-semibold text-neutral-950">
          {formatPrice(basePrice)}
        </p>
      </div>
      {pricePerMile ? (
        <p className="font-mono text-xs text-neutral-500">
          + {formatPrice(pricePerMile)}/mi beyond 10mi
        </p>
      ) : null}
      <p className="mt-3 flex-1 text-sm leading-relaxed text-neutral-600">{description}</p>
      <div className="mt-5 flex items-center justify-between border-t border-neutral-200/80 pt-4">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-950">
          Book now
          <ArrowRight
            aria-hidden
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          />
        </span>
        {isDiagnostics && (
          <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-neutral-500">
            Payment upfront
          </span>
        )}
      </div>
    </Link>
  );
}
