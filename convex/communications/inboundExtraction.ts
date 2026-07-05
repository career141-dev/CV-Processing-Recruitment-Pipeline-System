import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import OpenAI from "openai";

export const extractDetailsFromText = internalAction({
  args: {
    candidateId: v.id("candidates"),
    textBody: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
      console.error("[Inbound Extraction] NVIDIA_API_KEY is not configured.");
      return;
    }

    const openai = new OpenAI({
      baseURL: "https://integrate.api.nvidia.com/v1",
      apiKey,
    });

    const systemPrompt = `You are an AI data extraction assistant for Career141 recruitment.
Your job is to analyze the candidate's chat message and extract key details:
1. Current salary (numeric value only)
2. Expected salary (numeric value only)
3. Notice period in days (numeric value only, e.g. 30 if they say "30 days" or "1 month", 0 if "immediate")
4. Notice period verbatim (verbatim string description, e.g. "1 month", "immediate", "30 days")

Return ONLY a valid JSON object matching this schema. Do not add any markdown formatting, code block backticks, or other text.
Schema:
{
  "currentSalary": number | null,
  "expectedSalary": number | null,
  "noticePeriodDays": number | null,
  "noticePeriod": string | null
}
If a field is not mentioned, return null for it. Do not invent or infer values.`;

    try {
      const completion = await openai.chat.completions.create({
        model: "meta/llama-3.1-70b-instruct",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: args.textBody },
        ],
        temperature: 0.1,
      });

      const responseText = completion.choices[0]?.message?.content?.trim() || "";
      console.log(`[Inbound Extraction] Raw response: "${responseText}"`);

      const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      const extracted = JSON.parse(cleanJson);

      const updates: Record<string, any> = {};
      if (typeof extracted.currentSalary === "number") updates.currentSalary = extracted.currentSalary;
      if (typeof extracted.expectedSalary === "number") updates.expectedSalary = extracted.expectedSalary;
      if (typeof extracted.noticePeriodDays === "number") updates.noticePeriodDays = extracted.noticePeriodDays;
      if (typeof extracted.noticePeriod === "string") updates.noticePeriod = extracted.noticePeriod;

      if (Object.keys(updates).length > 0) {
        console.log(`[Inbound Extraction] Extracted updates for candidate ${args.candidateId}:`, updates);
        await ctx.runMutation(api.candidates.updateCandidateDetails, {
          candidateId: args.candidateId,
          ...updates,
        });
      }
    } catch (err: any) {
      console.error("[Inbound Extraction] Error during LLM details extraction:", err.message);
    }
  },
});
