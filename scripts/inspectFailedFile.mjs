import { ConvexHttpClient } from "convex/browser";
import dotenv from "dotenv";

dotenv.config({ path: ".env.hosted" });
const url = process.env.CONVEX_URL || "https://api.career141.com";
const adminKey = process.env.CONVEX_DEPLOY_KEY || process.env.CONVEX_SELF_HOSTED_ADMIN_KEY;

const client = new ConvexHttpClient(url);
if (adminKey) {
  client.setAdminAuth(adminKey);
}

async function inspectFailedFile() {
  const uploadId = "jd75dz4e4m0ty71fxh5ngh3y9d8a4vw9";
  const upload = await client.query("candidates/candidates:getCvUpload", { cvUploadId: uploadId });
  console.log("Upload record:", upload);

  if (upload && upload.storageId) {
    try {
      const storageUrl = await client.action("cvs/cvExtraction:getStorageUrlForTest", { storageId: upload.storageId });
      console.log("Storage URL:", storageUrl);
    } catch (e) {
      console.log("Error getting URL:", e.message);
    }
  }
}

inspectFailedFile();
