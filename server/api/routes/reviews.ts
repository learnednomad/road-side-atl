import { Hono } from "hono";
import { db } from "@/db";
import { reviews, providers, bookings, users } from "@/db/schema";
import { eq, desc, avg, count } from "drizzle-orm";
import { z } from "zod/v4";
import { requireAuth } from "../middleware/auth";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

const app = new Hono<AuthEnv>();

const createReviewSchema = z.object({
  bookingId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

// Get reviews for a provider
app.get("/provider/:providerId", async (c) => {
  const providerId = c.req.param("providerId");
  const limit = parseInt(c.req.query("limit") || "10");
  const offset = parseInt(c.req.query("offset") || "0");

  const providerReviews = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
      customerName: users.name,
    })
    .from(reviews)
    .leftJoin(users, eq(reviews.customerId, users.id))
    .where(eq(reviews.providerId, providerId))
    .orderBy(desc(reviews.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count: totalCount }] = await db
    .select({ count: count() })
    .from(reviews)
    .where(eq(reviews.providerId, providerId));

  return c.json({
    reviews: providerReviews,
    total: totalCount,
    hasMore: offset + limit < totalCount,
  });
});

// Create a review (authenticated customers only)
app.post("/", requireAuth, async (c) => {
  const user = c.get("user");
  const userId = user?.id;

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const parsed = createReviewSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0].message }, 400);
  }

  const { bookingId, rating, comment } = parsed.data;

  // Get the booking and verify it belongs to this customer
  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, bookingId),
  });

  if (!booking) {
    return c.json({ error: "Booking not found" }, 404);
  }

  if (booking.userId !== userId) {
    return c.json({ error: "You can only review your own bookings" }, 403);
  }

  if (booking.status !== "completed") {
    return c.json({ error: "You can only review completed bookings" }, 400);
  }

  if (!booking.providerId) {
    return c.json({ error: "No provider was assigned to this booking" }, 400);
  }

  // Check if review already exists
  const existingReview = await db.query.reviews.findFirst({
    where: eq(reviews.bookingId, bookingId),
  });

  if (existingReview) {
    return c.json({ error: "You have already reviewed this booking" }, 400);
  }

  // Create the review
  const [newReview] = await db
    .insert(reviews)
    .values({
      bookingId,
      providerId: booking.providerId,
      customerId: userId,
      rating,
      comment: comment || null,
    })
    .returning();

  // Update provider average rating
  const [ratingStats] = await db
    .select({
      avgRating: avg(reviews.rating),
      totalCount: count(),
    })
    .from(reviews)
    .where(eq(reviews.providerId, booking.providerId));

  await db
    .update(providers)
    .set({
      averageRating: ratingStats.avgRating ? parseFloat(String(ratingStats.avgRating)) : null,
      reviewCount: ratingStats.totalCount,
      updatedAt: new Date(),
    })
    .where(eq(providers.id, booking.providerId));

  return c.json({ success: true, review: newReview });
});

// Get review for a specific booking (for the customer who owns it)
app.get("/booking/:bookingId", requireAuth, async (c) => {
  const user = c.get("user");
  const userId = user?.id;
  const bookingId = c.req.param("bookingId");

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, bookingId),
  });

  if (!booking || booking.userId !== userId) {
    return c.json({ error: "Booking not found" }, 404);
  }

  const review = await db.query.reviews.findFirst({
    where: eq(reviews.bookingId, bookingId),
  });

  return c.json({ review: review || null });
});

// Update a review (only by the customer who created it)
app.patch("/:reviewId", requireAuth, async (c) => {
  const user = c.get("user");
  const userId = user?.id;
  const reviewId = c.req.param("reviewId");

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const review = await db.query.reviews.findFirst({
    where: eq(reviews.id, reviewId),
  });

  if (!review) {
    return c.json({ error: "Review not found" }, 404);
  }

  if (review.customerId !== userId) {
    return c.json({ error: "You can only edit your own reviews" }, 403);
  }

  const body = await c.req.json();
  const rating = body.rating ? parseInt(body.rating) : undefined;
  const comment = body.comment;

  if (rating !== undefined && (rating < 1 || rating > 5)) {
    return c.json({ error: "Rating must be between 1 and 5" }, 400);
  }

  const [updatedReview] = await db
    .update(reviews)
    .set({
      ...(rating !== undefined && { rating }),
      ...(comment !== undefined && { comment }),
      updatedAt: new Date(),
    })
    .where(eq(reviews.id, reviewId))
    .returning();

  // Recalculate provider average
  const [ratingStats] = await db
    .select({
      avgRating: avg(reviews.rating),
      totalCount: count(),
    })
    .from(reviews)
    .where(eq(reviews.providerId, review.providerId));

  await db
    .update(providers)
    .set({
      averageRating: ratingStats.avgRating ? parseFloat(String(ratingStats.avgRating)) : null,
      reviewCount: ratingStats.totalCount,
      updatedAt: new Date(),
    })
    .where(eq(providers.id, review.providerId));

  return c.json({ success: true, review: updatedReview });
});

// Delete a review (admin only)
app.delete("/:reviewId", requireAuth, async (c) => {
  const user = c.get("user");
  const role = user?.role;
  const reviewId = c.req.param("reviewId");

  if (role !== "admin") {
    return c.json({ error: "Admin access required" }, 403);
  }

  const review = await db.query.reviews.findFirst({
    where: eq(reviews.id, reviewId),
  });

  if (!review) {
    return c.json({ error: "Review not found" }, 404);
  }

  const providerId = review.providerId;

  await db.delete(reviews).where(eq(reviews.id, reviewId));

  // Recalculate provider average
  const [ratingStats] = await db
    .select({
      avgRating: avg(reviews.rating),
      totalCount: count(),
    })
    .from(reviews)
    .where(eq(reviews.providerId, providerId));

  await db
    .update(providers)
    .set({
      averageRating: ratingStats.avgRating ? parseFloat(String(ratingStats.avgRating)) : null,
      reviewCount: ratingStats.totalCount,
      updatedAt: new Date(),
    })
    .where(eq(providers.id, providerId));

  return c.json({ success: true });
});

export default app;
