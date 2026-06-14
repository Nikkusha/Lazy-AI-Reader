/**
 * Estimates read time in Georgian text.
 * Average reading speed is around 120 words per minute. Or approx 7 characters per second.
 */
export function estimateReadTime(text: string): { seconds: number; formatted: string } {
  if (!text || text.trim() === '') {
    return { seconds: 0, formatted: '0 წამი' };
  }
  
  // Clean whitespace and get words
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  
  // Estimate using words or character length (Georgian chars can be slightly long)
  // Let's assume average of 120 words per minute (i.e. 2 words per second)
  let seconds = Math.ceil(wordCount / 2);
  if (seconds < 3) seconds = Math.max(1, Math.ceil(text.length / 8)); // fallback for short texts
  
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  
  let formatted = '';
  if (mins > 0) {
    formatted += `${mins} წთ `;
  }
  formatted += `${secs} წმ`;
  
  return { seconds, formatted };
}

/**
 * Encodes time as "MM:SS"
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Decodes base64 raw mono PCM audio data into a playable raw AudioBuffer.
 * Gemini 3.1 tts model outputs raw 16-bit little-endian PCM at 24000Hz.
 */
export async function decodePcmToBuffer(
  base64Data: string, 
  audioCtx: AudioContext, 
  sampleRate = 24000
): Promise<AudioBuffer> {
  const binaryString = window.atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Create an Int16Array wrapper over the array buffer
  const int16Array = new Int16Array(bytes.buffer);
  
  // Allocate AudioBuffer
  const audioBuffer = audioCtx.createBuffer(1, int16Array.length, sampleRate);
  const channelData = audioBuffer.getChannelData(0);
  
  // Convert Int16 [-32768, 32767] to Float32 [-1.0, 1.0]
  for (let i = 0; i < int16Array.length; i++) {
    channelData[i] = int16Array[i] / 32768.0;
  }
  
  return audioBuffer;
}
