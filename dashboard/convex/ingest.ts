import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const optionalNumber = v.optional(v.number());
const optionalString = v.optional(v.string());

const rawListingInput = v.object({
  source: v.string(),
  sourceId: v.string(),
  scrapedAt: v.optional(v.number()),
  url: v.string(),
  title: optionalString,
  rawPrice: optionalString,
  rawLocation: optionalString,
  rawSize: optionalString,
  propertyType: optionalString,
  listingType: optionalString,
  description: optionalString,
  rawJson: v.optional(v.any()),
});

const cleanListingInput = v.object({
  source: v.string(),
  sourceId: v.string(),
  title: optionalString,
  url: optionalString,
  rawPrice: optionalString,
  rawLocation: optionalString,
  rawSize: optionalString,
  district: optionalString,
  city: optionalString,
  propertyType: optionalString,
  listingType: optionalString,
  priceLkr: optionalNumber,
  originalPriceLkr: optionalNumber,
  pricePerPerch: optionalNumber,
  pricePerSqft: optionalNumber,
  sizePerches: optionalNumber,
  sizeSqft: optionalNumber,
  bedrooms: optionalNumber,
  bathrooms: optionalNumber,
  lat: optionalNumber,
  lng: optionalNumber,
  firstSeenAt: optionalNumber,
  lastSeenAt: optionalNumber,
  scrapedAt: optionalNumber,
  dealScore: optionalNumber,
  marketMedianLkr: optionalNumber,
  isOutlier: v.optional(v.boolean()),
  isDuplicate: v.optional(v.boolean()),
  isShortTerm: v.optional(v.boolean()),
});

export const upsertRawListings = internalMutation({
  args: {
    listings: v.array(rawListingInput),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let inserted = 0;
    let updated = 0;

    for (const listing of args.listings) {
      const existing = await ctx.db
        .query("rawListings")
        .withIndex("by_source_id", (q) =>
          q.eq("source", listing.source).eq("sourceId", listing.sourceId),
        )
        .unique();

      const values = {
        ...listing,
        scrapedAt: listing.scrapedAt ?? now,
        isProcessed: false,
        updatedAt: now,
      };

      if (existing) {
        await ctx.db.patch(existing._id, values);
        updated += 1;
      } else {
        await ctx.db.insert("rawListings", values);
        inserted += 1;
      }
    }

    return { inserted, updated, total: args.listings.length };
  },
});

export const upsertListings = internalMutation({
  args: {
    listings: v.array(cleanListingInput),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let inserted = 0;
    let updated = 0;

    for (const listing of args.listings) {
      const existing = await ctx.db
        .query("listings")
        .withIndex("by_source_id", (q) =>
          q.eq("source", listing.source).eq("sourceId", listing.sourceId),
        )
        .unique();

      const values = {
        ...listing,
        updatedAt: now,
        firstSeenAt: listing.firstSeenAt ?? now,
        lastSeenAt: listing.lastSeenAt ?? now,
      };

      if (existing) {
        await ctx.db.patch(existing._id, values);
        updated += 1;
      } else {
        await ctx.db.insert("listings", values);
        inserted += 1;
      }
    }

    return { inserted, updated, total: args.listings.length };
  },
});
