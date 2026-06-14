import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Enable safe CORS headers for iframe/sandbox development
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Set up Google GenAI
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
  console.log("Successfully initialized GoogleGenAI with API key from environment.");
} else {
  console.warn("WARNING: GEMINI_API_KEY is not set in environment variables. Gemini TTS will not be available server-side.");
}

app.use(express.json({ limit: "50mb" }));

// Express API routes go here FIRST
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasGeminiKey: !!apiKey,
  });
});

app.post("/api/tts", async (req, res) => {
  try {
    const { text, voiceName } = req.body;
    if (!text || typeof text !== "string" || text.trim() === "") {
      return res.status(400).json({ error: "ტექსტი ცარიელია ან არასწორია" });
    }

    if (!ai) {
      return res.status(503).json({
        error: "Gemini API key is not configured. Falling back to local Web Speech API synthesis.",
        code: "NO_API_KEY"
      });
    }

    // Call the Gemini TTS API
    console.log(`Generating TTS for text length ${text.length} using voice ${voiceName || 'Kore'}`);
    
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      console.error("Gemini TTS API did not return audio data. Response:", JSON.stringify(response));
      return res.status(502).json({ error: "Gemini TTS-მა არ დააბრუნა აუდიო ფაილი" });
    }

    res.json({
      success: true,
      audioContent: base64Audio, // Base64 PCM data 24000Hz mono little endian
      mimeType: "audio/pcm;rate=24000",
    });
  } catch (err: any) {
    console.error("Error in /api/tts endpoint:", err);
    res.status(500).json({ error: err.message || "შიდა სერვერის შეცდომა" });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
