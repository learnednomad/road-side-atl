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
    <Card className="mb-8 border-red-200 bg-red-50/40">
      <Accordion type="single" collapsible>
        <AccordionItem value="cost" className="border-0">
          <AccordionTrigger className="px-6 py-4 text-left hover:no-underline">
            <div>
              <div className="text-base font-semibold">
                What does a typical Atlanta visit cost?
              </div>
              <div className="mt-1 text-sm font-normal text-muted-foreground">
                Atlanta independent shops run $120–$159/hr; dealers $160–$350/hr.
                Tap to see realistic scenario budgets.
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Scenario</th>
                    <th className="py-2 pr-4 font-medium">Typically includes</th>
                    <th className="py-2 text-right font-medium">Budget</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map((s) => (
                    <tr key={s.label} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">{s.label}</td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {s.includes}
                      </td>
                      <td className="py-3 text-right font-semibold tabular-nums">
                        {s.range}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
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
