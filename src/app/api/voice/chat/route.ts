import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  try {
    const {
      candidateName,
      jobTitle,
      jobDescription,
      alreadyCollected = {},
      customScript,
      messages = [],
      candidateId,
      jobId,
    } = await req.json();

    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || "sk-or-v1-dummy";
    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: "https://openrouter.ai/api/v1",
    });
    const model = "deepseek/deepseek-chat";

    // Determine remaining missing fields
    const missing: string[] = [];
    if (!alreadyCollected.currentSalary) missing.push("Current Salary (monthly in LKR)");
    if (!alreadyCollected.expectedSalary) missing.push("Expected Salary (monthly in LKR)");
    if (!alreadyCollected.noticePeriodDays && !alreadyCollected.noticePeriodText) missing.push("Notice Period (in days or months)");

    const systemPrompt = `You are "Sarah", a professional, polite, and articulate talent recruiter at Career141 conducting a phone prescreening call with candidate "${candidateName || "Candidate"}" for the "${jobTitle || "open role"}" position.

JOB CONTEXT:
${jobDescription ? jobDescription.substring(0, 1200) : "A key role at our client company."}
${customScript ? `\nRECRUITER CUSTOM INSTRUCTIONS & QUESTIONS:\n${customScript}\n` : ""}

CURRENT RECRUITMENT STATE:
- ALREADY COLLECTED (DO NOT ASK FOR THESE AGAIN!):
  * Current Salary: ${alreadyCollected.currentSalary ? `${alreadyCollected.currentSalary.toLocaleString()} LKR` : "Not collected yet"}
  * Expected Salary: ${alreadyCollected.expectedSalary ? `${alreadyCollected.expectedSalary.toLocaleString()} LKR` : "Not collected yet"}
  * Notice Period: ${alreadyCollected.noticePeriodText || alreadyCollected.noticePeriodDays ? `${alreadyCollected.noticePeriodText || alreadyCollected.noticePeriodDays + ' days'}` : "Not collected yet"}

- STILL MISSING (YOUR GOAL IS TO COLLECT THESE ONE BY ONE):
  ${missing.length > 0 ? missing.map((m, i) => `${i + 1}. ${m}`).join("\n  ") : "NONE — All required fields are already collected!"}

BEHAVIOR RULES:
1. ALWAYS acknowledge what the candidate just said before asking the next question (e.g. "Great, thank you for sharing that," or "Got it, 250,000 for expected salary.").
2. Ask for ONLY ONE missing item at a time so the conversation feels natural and conversational on the phone. Never bombard them with multiple questions at once.
3. NEVER repeat a question for a field that is already listed under ALREADY COLLECTED.
4. If the candidate asks a question about the role, location, tech stack, or company, answer briefly in 1 sentence, then pivot back to the next missing field.
5. If ALL fields are collected (${missing.length === 0 ? "WHICH IS TRUE NOW" : "or once the candidate answers the remaining ones"}), warmly thank them and wrap up the call (e.g., "Thank you so much, ${candidateName || ""}! That's all the information we need. Our talent team will review your application and be in touch soon. Have a wonderful day!").
6. Keep your spoken response CONCISE (1 to 2 sentences maximum per turn).

CRITICAL JSON OUTPUT FORMAT:
You MUST respond with a valid JSON object matching this schema:
{
  "spokenResponse": "The exact concise text you will speak aloud to the candidate.",
  "extracted": {
    "currentSalary": number or null (e.g. 250000. Convert '2.5 lakhs' -> 250000, '250k' -> 250000),
    "expectedSalary": number or null (e.g. 350000. Convert '3.5 lakhs' -> 350000, '350k' -> 350000),
    "noticePeriodDays": number or null (e.g. '1 month' -> 30, '2 months' -> 60, 'immediate' -> 0),
    "noticePeriodText": string or null (e.g. '1 Month', 'Immediate', '2 Weeks'),
    "customAnswers": { "question": "answer" },
    "isPrescreeningComplete": boolean (set true when all fields collected or candidate concluded call)
  }
}`;

    const formattedMessages: any[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: any) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      })),
    ];

    const completion = await openai.chat.completions.create({
      model,
      messages: formattedMessages,
      temperature: 0.2,
      max_tokens: 600,
      response_format: { type: "json_object" },
    });

    const rawContent = completion.choices[0]?.message?.content?.trim() || "{}";
    let parsed: any = null;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      parsed = null;
    }

    // Resilient extraction for spokenResponse (guarantees no raw JSON leaks to UI or TTS)
    let spokenText = parsed?.spokenResponse;
    if (!spokenText || typeof spokenText !== "string" || spokenText.startsWith("{")) {
      const regexMatch = rawContent.match(/"spokenResponse"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
      if (regexMatch && regexMatch[1]) {
        try {
          spokenText = JSON.parse(`"${regexMatch[1]}"`);
        } catch {
          spokenText = regexMatch[1].replace(/\\"/g, '"').trim();
        }
      } else {
        spokenText = rawContent
          .replace(/```json|```/g, "")
          .replace(/\{[\s\S]*"spokenResponse"\s*:\s*/i, "")
          .replace(/"\s*,\s*"extracted"[\s\S]*$/i, "")
          .replace(/^["'\s]+|["'\s{}]+$/g, "")
          .trim();
      }
    }

    return NextResponse.json({
      success: true,
      spokenResponse: spokenText || "Thank you. Let's proceed.",
      extracted: parsed?.extracted || {},
      isPrescreeningComplete: parsed?.extracted?.isPrescreeningComplete || false,
    });
  } catch (error: any) {
    console.error("[Voice Chat API] Exception:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to process voice conversation",
        spokenResponse: "Thank you. Could you please share your expected salary and notice period?",
        extracted: {},
      },
      { status: 500 }
    );
  }
}
