import { action } from "../_generated/server";
import { internal } from "../_generated/api";

const testAction = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean }> => {
    console.log("Starting action testIngedup...");
    
    // 1. Store mock files in Convex Storage
    const file1Blob = new Blob(["Mock CV v1 content"], { type: "application/pdf" });
    const file1StorageId = await ctx.storage.store(file1Blob);
    console.log(`Stored mock file 1: ${file1StorageId}`);

    const file2Blob = new Blob(["Mock CV v2 updated content"], { type: "application/pdf" });
    const file2StorageId = await ctx.storage.store(file2Blob);
    console.log(`Stored mock file 2: ${file2StorageId}`);

    // 2. Call the test mutation with storage IDs
    const result = await ctx.runMutation((internal as any).admin.testIngedupMut.default, {
      file1StorageId,
      file2StorageId,
    }) as { success: boolean };

    // 3. Clean up the stored files
    console.log("Cleaning up stored files...");
    await ctx.storage.delete(file1StorageId);
    await ctx.storage.delete(file2StorageId);

    return result;
  },
});

export default testAction;
