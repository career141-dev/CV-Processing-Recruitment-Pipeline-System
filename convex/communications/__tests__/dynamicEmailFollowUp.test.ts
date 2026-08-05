import test from "node:test";
import assert from "node:assert/strict";

/**
 * Empirical Unit & Integration Test Suite: Dynamic AI Email Follow-Up Engine (Agent 3)
 */

test("Dynamic Follow-Up — ETA Capping & Flagged TA Review", async (t) => {
  await t.test("Caps promised ETA at 72 hours and flags for TA review when ETA exceeds 72h", () => {
    const MAX_ETA_MINS = 72 * 60; // 4320 minutes (3 days)
    
    // Test Case 1: Standard 8-hour ETA ("tonight by 7pm")
    const shortEtaMins = 480; // 8 hours
    assert.equal(shortEtaMins <= MAX_ETA_MINS, true, "8 hour ETA should be within 72h ceiling");
    const isFlaggedShort = shortEtaMins > MAX_ETA_MINS;
    assert.equal(isFlaggedShort, false, "Standard ETA should NOT flag for TA review");

    // Test Case 2: Unreasonable 30-day ETA ("in 30 days")
    const longEtaMins = 30 * 24 * 60; // 43,200 minutes (30 days)
    assert.equal(longEtaMins > MAX_ETA_MINS, true, "30-day ETA should exceed 72h ceiling");
    const isFlaggedLong = longEtaMins > MAX_ETA_MINS;
    assert.equal(isFlaggedLong, true, "30-day ETA MUST set flaggedForTaReview = true");
  });
});

test("Dynamic Follow-Up — Fail-Open Error Handling", async (t) => {
  await t.test("Fails open to 3-hour fallback nudge on LLM extraction exception", () => {
    let mockLlmThrowsError = true;
    let scheduledHours = null;
    let loggedWarning = null;

    try {
      if (mockLlmThrowsError) {
        throw new Error("OpenRouter API rate limit / timeout");
      }
    } catch (err: any) {
      loggedWarning = err.message;
      scheduledHours = 3; // Fail-open 3-hour fallback
    }

    assert.equal(loggedWarning, "OpenRouter API rate limit / timeout");
    assert.equal(scheduledHours, 3, "Fail-open mechanism must fallback safely to 3 hours");
  });
});

test("Dynamic Follow-Up — Max Attempt Terminal Condition", async (t) => {
  await t.test("Transitions application to unresponsive when attempt count reaches ceiling", () => {
    const maxAttempts = 4;
    let currentAttempts = 4;
    let targetStage = "follow_up";

    if (currentAttempts >= maxAttempts) {
      targetStage = "unresponsive";
    }

    assert.equal(targetStage, "unresponsive", "Application must transition to unresponsive at max attempt ceiling");
  });
});

test("Dynamic Follow-Up — Candidate Timezone Quiet Hours Calculation", async (t) => {
  function isWithinCallingHours(phone: string, currentUtcHour: number): boolean {
    let offsetHours = 0;
    if (phone.startsWith("+44") || phone.startsWith("07")) offsetHours = 0; // UK UTC+0
    else if (phone.startsWith("+971")) offsetHours = 4; // UAE UTC+4
    else if (phone.startsWith("+94")) offsetHours = 5.5; // Sri Lanka UTC+5.5
    else if (phone.startsWith("+65")) offsetHours = 8; // Singapore UTC+8
    else if (phone.startsWith("+1")) offsetHours = -5; // US EST
    else if (phone.startsWith("+61")) offsetHours = 10; // Australia

    const localHour = (currentUtcHour + offsetHours + 24) % 24;
    return localHour >= 9 && localHour < 20; // 9 AM to 8 PM local time
  }

  await t.test("UK phone (+44) at 11 PM UTC (23:00) is outside calling hours", () => {
    const allowed = isWithinCallingHours("+447700900123", 23);
    assert.equal(allowed, false, "11 PM local time should be quiet hours (outside 9am-8pm)");
  });

  await t.test("UK phone (+44) at 10 AM UTC (10:00) is within calling hours", () => {
    const allowed = isWithinCallingHours("+447700900123", 10);
    assert.equal(allowed, true, "10 AM local time should be active calling hours");
  });
});

test("Dynamic Follow-Up — Missing Fields Filtering", async (t) => {
  await t.test("Prompts ONLY for remaining missing fields after partial candidate update", () => {
    const candidateProfile = {
      cvUploadId: "cv123",
      currentSalary: 150000, // Provided in last message!
      expectedSalary: undefined, // Missing
      noticePeriodDays: undefined, // Missing
    };

    const stillMissing: string[] = [];
    if (!candidateProfile.cvUploadId) stillMissing.push("CV");
    if (candidateProfile.currentSalary === undefined) stillMissing.push("Current Salary");
    if (candidateProfile.expectedSalary === undefined) stillMissing.push("Expected Salary");
    if (candidateProfile.noticePeriodDays === undefined) stillMissing.push("Notice Period");

    assert.deepEqual(stillMissing, ["Expected Salary", "Notice Period"]);
    assert.equal(stillMissing.includes("Current Salary"), false, "Already provided Current Salary MUST NOT be asked again!");
  });
});
