import dotenv from 'dotenv';
import { ConvexHttpClient } from 'convex/browser';

dotenv.config({ path: '.env.hosted' });

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
const client = new ConvexHttpClient(CONVEX_URL);

async function run() {
  try {
    // We can't query using an internal query from outside, but we can call a public query or use the HTTP API if available.
    // Instead of querying directly, let's just use the Convex fetch API if we know the endpoint, or rely on the script logs.
    console.log("To check parsed CVs, look at the dashboard.");
  } catch (err) {
    console.error(err);
  }
}
run();
