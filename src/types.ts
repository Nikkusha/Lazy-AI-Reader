export interface HistoryItem {
  id: string;
  text: string;
  estimatedReadTime: string; // e.g., "0:15 / 0:45"
  date: string;              // e.g., "13 ივნ, 2026"
  voiceName: string;         // 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr' | 'local'
  audioBase64?: string;      // Cached audio base64 from Gemini TTS API
  speedRate?: number;        // Playback speed stored alongside the record
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
}

export type AppScreen = 'auth' | 'dashboard' | 'player';

export interface VoiceOption {
  id: string;
  name: string;
  gender: 'კაცი' | 'ქალი' | 'სისტემური';
  source: 'Gemini AI (პრემიუმ)' | 'სისტემური ვებ ხმა';
  lang: string;
}
