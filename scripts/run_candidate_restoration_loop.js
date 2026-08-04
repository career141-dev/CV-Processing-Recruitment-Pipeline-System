async function runRestorationLoop() {
  console.log("=================================================================");
  console.log("🚀 CANDIDATE PROFILE AUTOMATED RESTORATION ENGINE");
  console.log("📡 Target Backend: https://api.career141.com");
  console.log("=================================================================\n");

  let totalRestored = 0;
  let totalChecked = 0;

  for (let i = 1; i <= 50; i++) {
    try {
      const res = await fetch("https://api.career141.com/api/mutation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "cvs/cvUploads:restoreAllCandidatesFromUploads",
          args: {},
        }),
      });

      const data: any = await res.json();
      if (data.status === "success") {
        const { checkedCount, requeuedRestored } = data.value;
        totalChecked += checkedCount;
        totalRestored += requeuedRestored;
        console.log(`[Batch ${i}] Checked ${checkedCount} uploads -> Restored & enqueued ${requeuedRestored} candidate extractions.`);

        if (requeuedRestored === 0 && checkedCount < 100) {
          console.log("\n🎉 All candidate uploads checked and fully restored!");
          break;
        }
      } else {
        console.error(`[Batch ${i}] Server error:`, data.errorMessage);
        break;
      }
    } catch (err: any) {
      console.error(`[Batch ${i}] Network error:`, err.message);
      break;
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("\n=================================================================");
  console.log(`✅ Restoration Trigger Complete! Total Enqueued Restorations: ${totalRestored}`);
  console.log("=================================================================");
}

runRestorationLoop();
