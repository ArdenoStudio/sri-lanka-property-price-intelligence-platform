import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const sourceFields = {
  source: v.string(),
  sourceId: v.string(),
};

const listingCoreFields = {
  ...sourceFields,
  title: v.optional(v.string()),
  url: v.optional(v.string()),
  rawPrice: v.optional(v.string()),
  rawLocation: v.optional(v.string()),
  rawSize: v.optional(v.string()),
  district: v.optional(v.string()),
  city: v.optional(v.string()),
  propertyType: v.optional(v.string()),
  listingType: v.optional(v.string()),
  priceLkr: v.optional(v.number()),
  originalPriceLkr: v.optional(v.number()),
  pricePerPerch: v.optional(v.number()),
  pricePerSqft: v.optional(v.number()),
  sizePerches: v.optional(v.number()),
  sizeSqft: v.optional(v.number()),
  bedrooms: v.optional(v.number()),
  bathrooms: v.optional(v.number()),
  lat: v.optional(v.number()),
  lng: v.optional(v.number()),
  firstSeenAt: v.optional(v.number()),
  lastSeenAt: v.optional(v.number()),
  scrapedAt: v.optional(v.number()),
};

export default defineSchema({
  rawListings: defineTable({
    ...sourceFields,
    scrapedAt: v.number(),
    url: v.string(),
    title: v.optional(v.string()),
    rawPrice: v.optional(v.string()),
    rawLocation: v.optional(v.string()),
    rawSize: v.optional(v.string()),
    propertyType: v.optional(v.string()),
    listingType: v.optional(v.string()),
    description: v.optional(v.string()),
    rawJson: v.optional(v.any()),
    isProcessed: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_source_id", ["source", "sourceId"])
    .index("by_scraped_at", ["scrapedAt"])
    .index("by_processed", ["isProcessed"]),

  listings: defineTable({
    ...listingCoreFields,
    rawListingId: v.optional(v.id("rawListings")),
    dealScore: v.optional(v.number()),
    marketMedianLkr: v.optional(v.number()),
    isOutlier: v.optional(v.boolean()),
    isDuplicate: v.optional(v.boolean()),
    isShortTerm: v.optional(v.boolean()),
    updatedAt: v.number(),
  })
    .index("by_source_id", ["source", "sourceId"])
    .index("by_district", ["district"])
    .index("by_scraped_at", ["scrapedAt"])
    .index("by_property_type", ["propertyType"])
    .index("by_listing_type", ["listingType"]),

  priceAggregates: defineTable({
    district: v.string(),
    propertyType: v.string(),
    bedroomBucket: v.optional(v.string()),
    periodYear: v.number(),
    periodMonth: v.number(),
    medianPriceLkr: v.optional(v.number()),
    medianPricePerPerch: v.optional(v.number()),
    avgPriceLkr: v.optional(v.number()),
    p25PriceLkr: v.optional(v.number()),
    p75PriceLkr: v.optional(v.number()),
    listingCount: v.number(),
    computedAt: v.number(),
  })
    .index("by_district_type_period", ["district", "propertyType", "periodYear", "periodMonth"])
    .index("by_district_type_bucket_period", [
      "district",
      "propertyType",
      "bedroomBucket",
      "periodYear",
      "periodMonth",
    ]),

  scrapeRuns: defineTable({
    source: v.string(),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    status: v.optional(v.string()),
    listingsFound: v.optional(v.number()),
    listingsNew: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  })
    .index("by_source_started", ["source", "startedAt"])
    .index("by_started", ["startedAt"]),

  jobRuns: defineTable({
    jobName: v.string(),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    status: v.optional(v.string()),
    stats: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
  })
    .index("by_job_started", ["jobName", "startedAt"])
    .index("by_started", ["startedAt"]),
});
