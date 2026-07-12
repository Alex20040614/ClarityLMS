import { AI_SYSTEM_PROMPT, AI_FALLBACK_REPLY } from "../data.js";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// turns: [{ role: "user" | "assistant", text }]
export async function getCoachReply(turns) {
  if (!apiKey) return AI_FALLBACK_REPLY;

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: AI_SYSTEM_PROMPT }] },
        contents: turns.map((t) => ({
          role: t.role === "assistant" ? "model" : "user",
          parts: [{ text: t.text }],
        })),
        generationConfig: { maxOutputTokens: 400, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });

    if (!response.ok) throw new Error(`Gemini request failed: ${response.status}`);

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("");
    return text || AI_FALLBACK_REPLY;
  } catch (err) {
    console.error("AI Tutor request failed:", err);
    return AI_FALLBACK_REPLY;
  }
}
