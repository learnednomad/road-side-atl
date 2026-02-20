"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StarRating } from "./star-rating";
import { Loader2 } from "lucide-react";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  customerName: string | null;
}

interface ReviewsListProps {
  providerId: string;
  limit?: number;
}

export function ReviewsList({ providerId, limit = 5 }: ReviewsListProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const fetchReviews = useCallback(async (newOffset = 0) => {
    try {
      const res = await fetch(
        `/api/reviews/provider/${providerId}?limit=${limit}&offset=${newOffset}`
      );
      const data = await res.json();

      if (newOffset === 0) {
        setReviews(data.reviews);
      } else {
        setReviews((prev) => [...prev, ...data.reviews]);
      }
      setTotal(data.total);
      setHasMore(data.hasMore);
      setOffset(newOffset);
    } catch (err) {
      console.error("Failed to fetch reviews:", err);
    } finally {
      setLoading(false);
    }
  }, [providerId, limit]);

  useEffect(() => {
    fetchReviews(0);
  }, [fetchReviews]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No reviews yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{total} reviews</p>
      </div>

      <div className="space-y-3">
        {reviews.map((review) => (
          <Card key={review.id}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between mb-2">
                <StarRating rating={review.rating} size="sm" showValue={false} />
                <span className="text-xs text-muted-foreground">
                  {new Date(review.createdAt).toLocaleDateString()}
                </span>
              </div>
              {review.comment && (
                <p className="text-sm text-muted-foreground">{review.comment}</p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                — {review.customerName || "Anonymous"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {hasMore && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => fetchReviews(offset + limit)}
        >
          Load More Reviews
        </Button>
      )}
    </div>
  );
}
