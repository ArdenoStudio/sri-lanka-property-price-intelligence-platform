import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

export const record = internalMutation({
  args: {
    jobName: v.string(),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    status: v.optional(v.string()),
    stats: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("jobRuns", args);
  },
});

export const latest = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("jobRuns")
      .withIndex("by_started")
      .order("desc")
      .take(Math.min(args.limit ?? 20, 100));
  },
});
