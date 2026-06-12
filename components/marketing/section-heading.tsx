interface SectionHeadingProps {
  kicker: string;
  title: string;
  id?: string;
}

// Editorial section header: mono uppercase kicker with a red tick, then a
// large tracking-tight title. Left-aligned like the rest of the page.
export function SectionHeading({ kicker, title, id }: SectionHeadingProps) {
  return (
    <div className="mb-12">
      <p className="flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-[0.15em] text-neutral-500">
        <span aria-hidden className="h-3 w-0.5 bg-red-600" />
        {kicker}
      </p>
      <h2 id={id} className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-neutral-950 md:text-4xl">
        {title}
      </h2>
    </div>
  );
}
