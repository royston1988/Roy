// Read-only check that the Shopline key works: `npm run studio:check`. Changes nothing on the shop.
import { config } from "./config.js";
import { createShopline } from "./shopline-client.js";

if (!config.shoplineToken) {
  console.log("No SHOPLINE_ACCESS_TOKEN in .env yet. Add it, then run this again.");
  process.exit(1);
}

try {
  const result = await createShopline({ token: config.shoplineToken, apiUrl: config.shoplineApi }).check();
  for (const p of result.products) {
    console.log(`- ${p.title}: ${p.photoCount} photo(s)${p.imageUrl ? "" : ", main photo not found"}`);
  }
  if (result.ok) {
    console.log("\n✓ Shopline works. Products and photos can be read, and uploads are safe to try.");
  } else {
    console.log("\n⚠ Connected, but something needs fixing:");
    for (const problem of result.problems) console.log(`  - ${problem}`);
    console.log(`\n(For whoever fixes it: product fields seen = ${result.fieldsSeen.join(", ")})`);
    process.exitCode = 1;
  }
} catch (err) {
  console.log(`✗ Couldn't connect: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
}
