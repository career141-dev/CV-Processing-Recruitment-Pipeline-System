const { ConvexHttpClient } = require("convex/browser");
require("dotenv").config({ path: ".env.local" });

const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

async function main() {
  console.log("Since backend won't sync, please just refresh your browser!");
  console.log("The UI component is kept alive by React state.");
}

main().catch(console.error);
