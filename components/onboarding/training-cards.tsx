"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Check,
  BookOpen,
  Shield,
  Briefcase,
  FileText,
  DollarSign,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { TRAINING_CATEGORIES } from "@/lib/training-content";

interface TrainingCardData {
  id: string;
  title: string;
  category: string;
  content: string;
  keyPoints: string[];
  acknowledged: boolean;
}

interface TrainingData {
  stepId: string;
  status: string;
  totalCards: number;
  acknowledgedCount: number;
  acknowledgedCards: string[];
  cards: TrainingCardData[];
}

const CATEGORY_ICONS: Record<string, typeof Shield> = {
  safety: Shield,
  service: Briefcase,
  policy: FileText,
  payment: DollarSign,
};

export function TrainingModule({ onBack }: { onBack?: () => void }) {
  const [data, setData] = useState<TrainingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  const fetchTraining = useCallback(async () => {
    const res = await fetch("/api/hono/onboarding/training");
    if (res.ok) {
      setData(await res.json());
    } else {
      toast.error("Failed to load training content");
    }
    setIsLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
  useState(() => { void fetchTraining(); });

  const handleAcknowledge = async (cardId: string) => {
    setAcknowledging(cardId);
    try {
      const res = await fetch(`/api/hono/onboarding/training/acknowledge/${cardId}`, {
        method: "POST",
      });
      if (res.ok) {
        const result = await res.json();
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            status: result.status,
            acknowledgedCount: result.acknowledgedCount,
            acknowledgedCards: [...prev.acknowledgedCards, cardId],
            cards: prev.cards.map((c) =>
              c.id === cardId ? { ...c, acknowledged: true } : c,
            ),
          };
        });
        if (result.isComplete) {
          toast.success("Training complete! All policies acknowledged.");
        }
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to acknowledge");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setAcknowledging(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const progressPercent = Math.round((data.acknowledgedCount / data.totalCards) * 100);
  const isComplete = data.status === "complete";

  // Group cards by category
  const grouped = TRAINING_CATEGORIES.map((cat) => ({
    ...cat,
    cards: data.cards.filter((c) => c.category === cat.id),
    completedCount: data.cards.filter((c) => c.category === cat.id && c.acknowledged).length,
  }));

  return (
    <div className="space-y-6">
      {onBack && (
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to Onboarding
        </Button>
      )}

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          Provider Training
        </h2>
        <p className="text-muted-foreground mt-1">
          Read each policy card and acknowledge that you understand the content.
        </p>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {data.acknowledgedCount} of {data.totalCards} cards acknowledged
            </p>
            <Badge variant={isComplete ? "default" : "secondary"}>
              {isComplete ? "Complete" : `${progressPercent}%`}
            </Badge>
          </div>
          <Progress value={progressPercent} />
        </CardContent>
      </Card>

      {/* Category sections */}
      {grouped.map((category) => {
        const CatIcon = CATEGORY_ICONS[category.id] || BookOpen;
        const catComplete = category.completedCount === category.cards.length;

        return (
          <Card key={category.id}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${category.color}`}>
                  <CatIcon className="h-4 w-4" />
                </span>
                {category.label}
                <Badge variant={catComplete ? "default" : "outline"} className="ml-auto">
                  {category.completedCount}/{category.cards.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Accordion type="multiple" className="space-y-2">
                {category.cards.map((card) => (
                  <AccordionItem
                    key={card.id}
                    value={card.id}
                    className="rounded-lg border px-4"
                  >
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center gap-3 text-left">
                        {card.acknowledged ? (
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <Check className="h-3.5 w-3.5" />
                          </div>
                        ) : (
                          <div className="h-6 w-6 shrink-0 rounded-full border-2 border-muted-foreground/30" />
                        )}
                        <span className={`font-medium text-sm ${card.acknowledged ? "text-muted-foreground" : ""}`}>
                          {card.title}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <div className="space-y-4 pl-9">
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {card.content}
                        </p>

                        {card.keyPoints.length > 0 && (
                          <div className="rounded-md bg-muted/50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                              Key Points
                            </p>
                            <ul className="space-y-1.5">
                              {card.keyPoints.map((point, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                                  {point}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {!card.acknowledged && (
                          <Button
                            size="sm"
                            onClick={() => handleAcknowledge(card.id)}
                            disabled={acknowledging === card.id}
                          >
                            {acknowledging === card.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="mr-2 h-4 w-4" />
                            )}
                            I understand and acknowledge
                          </Button>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
