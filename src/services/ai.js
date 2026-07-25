import { AI_SYSTEM_PROMPT, AI_FALLBACK_REPLY, AI_TITLE_PROMPT } from "../data.js";

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

// Model titles can come back wrapped in quotes or with trailing punctuation
// despite the prompt — strip that, collapse whitespace, and cap the length so
// the history list stays tidy even if the model ignores the word limit.
function cleanTitle(raw) {
  if (!raw) return "";
  let title = raw.trim().replace(/\s+/g, " ").replace(/^["'“”]+|["'“”]+$/g, "").replace(/[.]+$/, "").trim();
  if (title.length > 70) title = `${title.slice(0, 67)}…`;
  return title;
}

// Summarises a conversation into a short title. Returns "" when unavailable so
// the caller can keep its own fallback (e.g. the first message).
// turns: [{ role: "user" | "assistant", text }]
export async function getChatTitle(turns) {
  if (!apiKey) return "";

  try {
    const transcript = turns
      .map((t) => `${t.role === "assistant" ? "Coach" : "Student"}: ${t.text}`)
      .join("\n");
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: AI_TITLE_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: transcript }] }],
        generationConfig: { maxOutputTokens: 30, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });

    if (!response.ok) throw new Error(`Gemini title request failed: ${response.status}`);

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("");
    return cleanTitle(text);
  } catch (err) {
    console.error("AI title request failed:", err);
    return "";
  }
}
