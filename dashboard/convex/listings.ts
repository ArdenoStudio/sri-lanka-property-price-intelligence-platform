import { v } from "convex/values";
import { query } from "./_generated/server";

export const list = query({
  args: {
    district: v.optional(v.string()),
    propertyType: v.optional(v.string()),
    listingType: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 30, 100);
    let rows;

    if (args.district) {
      rows = await ctx.db
        .query("listings")
        .withIndex("by_district", (q) => q.eq("district", args.district))
        .order("desc")
        .take(limit * 3);
    } else {
      rows = await ctx.db.query("listings").withIndex("by_scraped_at").order("desc").take(limit * 3);
    }

    return rows
      .filter((listing) => {
        if (args.propertyType && listing.propertyType !== args.propertyType) return false;
        if (args.listingType && listing.listingType !== args.listingType) return false;
        return true;
      })
      .slice(0, limit);
  },
});

export const byId = query({
  args: { id: v.id("listings") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const listings = await ctx.db.query("listings").collect();
    const districts = new Set<string>();
    const byType: Record<string, number> = {};
    let priceTotal = 0;
    let pricedCount = 0;
    let lastUpdated: number | null = null;

    for (const listing of listings) {
      if (listing.district) districts.add(listing.district);
      if (listing.propertyType) {
        byType[listing.propertyType] = (byType[listing.propertyType] ?? 0) + 1;
      }
      if (typeof listing.priceLkr === "number") {
        priceTotal += listing.priceLkr;
        pricedCount += 1;
      }
      if (typeof listing.updatedAt === "number" && (!lastUpdated || listing.updatedAt > lastUpdated)) {
        lastUpdated = listing.updatedAt;
      }
    }

    return {
      totalListings: listings.length,
      avgPriceLkr: pricedCount ? priceTotal / pricedCount : null,
      districtsCovered: districts.size,
      listingsByType: byType,
      lastUpdated,
      dataSource: "convex",
    };
  },
});

export const districts = query({
  args: {
    propertyType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const listings = await ctx.db.query("listings").collect();
    const grouped = new Map<string, { count: number; total: number; priced: number }>();

    for (const listing of listings) {
      if (!listing.district) continue;
      if (args.propertyType && listing.propertyType !== args.propertyType) continue;

      const row = grouped.get(listing.district) ?? { count: 0, total: 0, priced: 0 };
      row.count += 1;
      if (typeof listing.priceLkr === "number") {
        row.total += listing.priceLkr;
        row.priced += 1;
      }
      grouped.set(listing.district, row);
    }

    return [...grouped.entries()]
      .map(([district, row]) => ({
        district,
        count: row.count,
        avgPrice: row.priced ? row.total / row.priced : null,
      }))
      .sort((a, b) => b.count - a.count);
  },
});
