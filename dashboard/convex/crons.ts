import { cronJobs } from "convex/server";

const crons = cronJobs();

// Scrapers stay in GitHub Actions/Python for now. Convex crons are reserved
// for lightweight Convex-native maintenance once the read path is migrated.

export default crons;
