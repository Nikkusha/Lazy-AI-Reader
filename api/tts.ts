import type { IncomingMessage, ServerResponse } from "http";
import { GoogleGenAI, Modality } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } },
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  // Parse body
  let body: { text?: string; voiceName?: string } = {};
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    body = JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  const { text, voiceName } = body;

  if (!text || typeof text !== "string" || text.trim() === "") {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "ტექსტი ცარიელია ან არასწორია" }));
    return;
  }

  if (!ai) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: "Gemini API key is not configured. Falling back to local Web Speech API synthesis.",
      code: "NO_API_KEY",
    }));
    return;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName || "Kore" },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Gemini TTS-მა არ დააბრუნა აუდიო ფაილი" }));
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      success: true,
      audioContent: base64Audio,
      mimeType: "audio/pcm;rate=24000",
    }));
  } catch (err: any) {
    console.error("Error in /api/tts:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message || "შიდა სერვერის შეცდომა" }));
  }
}
