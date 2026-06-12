import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";

const scenarios = [
  {
    label: "Light visit",
    includes: "Oil change, basic inspection, OBD2 scan",
    range: "$75–$230",
  },
  {
    label: "Routine reconditioning",
    includes: "Oil + diagnostic + 1-axle brakes + short tow + express detail",
    range: "$550–$1,050",
  },
  {
    label: "Moderate catch-up",
    includes: "Above + battery + alignment + full interior/exterior detail",
    range: "$1,000–$1,900",
  },
  {
    label: "Heavy retail repair",
    includes: "Alternator or A/C + suspension + tow + detail",
    range: "$1,400–$3,000+",
  },
  {
    label: "Dealer-path repair",
    includes: "Dealer-rate labor + tow + premium detail",
    range: "$2,000–$4,000+",
  },
];

export function CostExpectations() {
  return (
    <Card className="mb-8 rounded-2xl border-neutral-200 bg-white">
      <Accordion type="single" collapsible>
        <AccordionItem value="cost" className="border-0">
          <AccordionTrigger className="px-6 py-4 text-left hover:no-underline">
            <div>
              <div className="text-base font-semibold tracking-tight text-neutral-950">
                What does a typical Atlanta visit cost?
              </div>
              <div className="mt-1 text-sm font-normal text-neutral-600">
                Atlanta independent shops run $120–$159/hr; dealers $160–$350/hr.
                Tap to see realistic scenario budgets.
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left">
                    <th className="py-2 pr-4 font-mono text-xs font-medium uppercase tracking-[0.15em] text-neutral-500">Scenario</th>
                    <th className="py-2 pr-4 font-mono text-xs font-medium uppercase tracking-[0.15em] text-neutral-500">Typically includes</th>
                    <th className="py-2 text-right font-mono text-xs font-medium uppercase tracking-[0.15em] text-neutral-500">Budget</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map((s) => (
                    <tr key={s.label} className="border-b border-neutral-200 last:border-0">
                      <td className="py-3 pr-4 font-medium text-neutral-950">{s.label}</td>
                      <td className="py-3 pr-4 text-neutral-600">
                        {s.includes}
                      </td>
                      <td className="py-3 text-right font-mono font-semibold text-neutral-950">
                        {s.range}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-neutral-500">
              Final price is set by your mechanic after on-site assessment.
              Towing adds a base fee ($50–$80) plus mileage. After-hours and
              flatbed service carry surcharges.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}
