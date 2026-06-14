import React, { useState, useEffect, useRef } from 'react';
import { AppScreen, UserProfile, HistoryItem } from './types';
import { PREBUILT_VOICES } from './data';
import { estimateReadTime, decodePcmToBuffer } from './utils';
import { supabase } from './supabaseClient';

// Subcomponents
import AuthScreen from './components/AuthScreen';
import DashboardScreen from './components/DashboardScreen';
import AudioPlayerScreen from './components/AudioPlayerScreen';

export default function App() {
  // Screens state
  const [screen, setScreen] = useState<AppScreen>('auth');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Active Synthesis states
  const [activeText, setActiveText] = useState('');
  const [activeVoiceId, setActiveVoiceId] = useState('Kore');
  const [activeSpeedRate, setActiveSpeedRate] = useState(1.0);
  const speedRateRef = useRef<number>(1.0);

  // Real-time Audio Playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(10);
  const [isBuffering, setIsBuffering] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  // Audio Playback References
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  // Offset variables for tracking time correctly
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const progressTimerRef = useRef<any>(null);

  // Web Speech API References
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Dynamic real-time speed adjustment handler
  const handleSpeedRateChange = (newRate: number) => {
    setActiveSpeedRate(newRate);
    speedRateRef.current = newRate;

    // 1. Dynamic Web Audio (PCM) playback rate update if streaming
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.playbackRate.value = newRate;
      } catch (e) {
        console.error("Failed to update base playbackRate:", e);
      }
    }

    // 2. Adjust Web Audio (PCM) elapsed timeline offsets
    if (isPlaying && activeVoiceId !== 'local' && audioBufferRef.current) {
      try {
        const ctx = getAudioContext();
        startTimeRef.current = ctx.currentTime - (currentTime / newRate);
      } catch (e) {
        console.error("Failed to adjust source node start time offset:", e);
      }
    }

    // 3. Dynamic Web Speech API utterance rate and pitch update
    if (speechUtteranceRef.current) {
      try {
        speechUtteranceRef.current.rate = newRate;
        // Dynamically adjust the pitch property slightly downward as the rate increases
        const targetPitch = newRate <= 1.0 ? 1.0 : (newRate >= 2.0 ? 0.85 : (newRate >= 1.5 ? 0.9 : (newRate >= 1.25 ? 0.95 : 0.97)));
        speechUtteranceRef.current.pitch = targetPitch;
      } catch (e) {
        console.error("Failed to update Web Speech API rate/pitch:", e);
      }
    }

    // 4. Lock standard pitch scaling dynamically on any generated HTML5 audio elements in the document
    try {
      const audioElements = document.querySelectorAll('audio');
      audioElements.forEach((el) => {
        (el as any).preservesPitch = true;
        (el as any).webkitPreservesPitch = true;
      });
    } catch (e) {
      console.error("Failed to apply preservesPitch to audio elements:", e);
    }
  };

  // Restore an existing Supabase session on initial load (keeps user logged in across refreshes)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email ?? '',
          fullName: session.user.user_metadata?.full_name || 'ქართველი მომხმარებელი'
        });
        setScreen('dashboard');
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        setScreen('auth');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Handle login
  const handleLogin = (profile: UserProfile) => {
    setUser(profile);
    setScreen('dashboard');
  };

  // Handle logout
  const handleLogout = async () => {
    stopCurrentPlayback();
    await supabase.auth.signOut();
    setUser(null);
    setScreen('auth');
  };

  // Stop ALL background synthetic or streaming playbacks
  const stopCurrentPlayback = () => {
    // 1. Clear intervals
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }

    // 2. Stop Web Audio PCM Source
    try {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.onended = null;
        sourceNodeRef.current.stop();
        sourceNodeRef.current = null;
      }
    } catch (e) {
      // already stopped/ended
    }

    // 3. Stop window.speechSynthesis
    try {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } catch (e) {
      // unable to cancel
    }

    setIsPlaying(false);
  };

  // Lazy initialize AudioContext on client gesture
  const getAudioContext = (): AudioContext => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000
      });
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // Check and run synthesis loop
  const handleSynthesize = async (text: string, voiceId: string, speedRate: number) => {
    stopCurrentPlayback();

    // iOS Safari requires AudioContext to be created/resumed synchronously
    // within a user gesture handler — before any await/async break.
    if (voiceId !== 'local') {
      try { getAudioContext(); } catch(e) {}
    }

    setActiveText(text);
    setActiveVoiceId(voiceId);
    setActiveSpeedRate(speedRate);
    speedRateRef.current = speedRate;

    setIsBuffering(true);
    setErrorMessage(undefined);
    setCurrentTime(0);

    // Save history card or overwrite existing if text already exists
    const matchingInHistory = history.find(h => h.text.trim() === text.trim() && h.voiceName === voiceId);
    
    let activeHistoryItemObj: HistoryItem;

    if (matchingInHistory) {
      activeHistoryItemObj = matchingInHistory;
    } else {
      const estInfo = estimateReadTime(text);
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        text: text,
        estimatedReadTime: estInfo.formatted,
        date: new Date().toLocaleDateString('ka-GE', { day: 'numeric', month: 'short', year: 'numeric' }),
        voiceName: voiceId
      };
      setHistory(prev => [newItem, ...prev]);
      activeHistoryItemObj = newItem;
    }

    // Trigger Screen Transition
    setScreen('player');

    // Synthesis Strategy: Web Speech Engine vs. Gemini AI
    if (voiceId === 'local') {
      // Local Speech Synthesis Fallback
      try {
        const estSecs = estimateReadTime(text).seconds;
        setDuration(estSecs);
        pausedTimeRef.current = 0;
        
        // Prepare SpeechSynthesisUtterance
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = speedRate;
        // Dynamically adjust the pitch property slightly downward as the rate increases
        // to counteract the synthetic thinning effect ("chipmunk effect") and keep the voice sounding completely natural.
        const targetPitch = speedRate <= 1.0 ? 1.0 : (speedRate >= 2.0 ? 0.85 : (speedRate >= 1.5 ? 0.9 : (speedRate >= 1.25 ? 0.95 : 0.97)));
        utterance.pitch = targetPitch;
        utterance.lang = 'ka-GE';

        // Attempt to find ka-GE voice or system defaults
        const voices = window.speechSynthesis.getVoices();
        const kaVoice = voices.find(v => v.lang.toLowerCase().includes('ka') || v.lang.toLowerCase().includes('ge'));
        if (kaVoice) {
          utterance.voice = kaVoice;
        }

        utterance.onstart = () => {
          setIsBuffering(false);
          setIsPlaying(true);
          startTimeRef.current = Date.now();
          startLocalTimer(estSecs);
        };

        utterance.onend = () => {
          setIsPlaying(false);
          setCurrentTime(estSecs);
          if (progressTimerRef.current) clearInterval(progressTimerRef.current);
        };

        utterance.onerror = (err) => {
          console.error("Local synth error:", err);
          setIsPlaying(false);
          setIsBuffering(false);
          // If canceled on layout change, let it pass, otherwise warn
          if (err.error !== 'interrupted') {
            setErrorMessage("სისტემური ხმის გაშვება ჩაიშალა: " + (err.error || 'უცნობი ხარვეზი'));
          }
        };

        speechUtteranceRef.current = utterance;
        
        // Wait minor timeout to ensure speech cancel is complete
        setTimeout(() => {
          window.speechSynthesis.speak(utterance);
        }, 100);

      } catch (err: any) {
        setIsBuffering(false);
        setErrorMessage("ლოკალური სინთეზი მიუწვდომელია. გთხოვთ სცადოთ პრემიუმ ხმები.");
      }
    } else {
      // Gemini AI voice server synthesis
      try {
        let cachedBase64 = activeHistoryItemObj.audioBase64;

        if (!cachedBase64) {
          // Fetch from Express API proxy with absolute URL to prevent iframe issues
          const requestUrl = `${window.location.protocol}//${window.location.host}/api/tts`;
          let res;
          try {
            res = await fetch(requestUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text, voiceName: voiceId })
            });
          } catch (fetchErr: any) {
            console.error("Network fetch failed:", fetchErr);
            throw new Error("სერვერთან კავშირი ჩაიშალა (Failed to fetch). ავტომატურად გადაგყავართ ლოკალურ სინთეზზე.");
          }

          const responseText = await res.text();
          let data;
          try {
            data = JSON.parse(responseText);
          } catch (e) {
            console.error("Failed to parse response JSON. Type:", res.headers.get("Content-Type"), "Content:", responseText.slice(0, 150));
            throw new Error("სერვერმა დააბრუნა არასწორი პასუხი. ავტომატურად გადაგყავართ ლოკალურ სინთეზზე.");
          }

          if (!res.ok) {
            throw new Error(data?.error || `სერვერის შეცდომა: კოდით ${res.status}`);
          }

          cachedBase64 = data.audioContent;

          // Update cache inside history state for this list item
          if (cachedBase64) {
            setHistory(prev => prev.map(item => 
              item.id === activeHistoryItemObj.id 
                ? { ...item, audioBase64: cachedBase64 } 
                : item
            ));
          }
        }

        if (!cachedBase64) {
          throw new Error("აუდიო ფაილის მიღება ვერ მოხერხდა");
        }

        // Decode into Web Audio buffer
        const ctx = getAudioContext();
        const decodedBuffer = await decodePcmToBuffer(cachedBase64, ctx);
        audioBufferRef.current = decodedBuffer;
        
        // Update player metrics
        const totalSecs = decodedBuffer.duration;
        setDuration(totalSecs);
        pausedTimeRef.current = 0;
        setIsBuffering(false);

        // Immediate autoplay
        playPcmBuffer(decodedBuffer, 0, speedRate);

      } catch (err: any) {
        console.error("Gemini TTS service error:", err);
        setIsBuffering(false);
        setErrorMessage(err.message || "Gemini Voice სერვერი დროებით მიუწვდომელია. ავტომატურად გადაგყავართ ლოკალურ სინთეზზე.");
        
        // Automatic fallback to local speech engine
        setTimeout(() => {
          handleSynthesize(text, 'local', speedRate);
        }, 3000);
      }
    }
  };

  // Start continuous clock progress indicators safely for Local Speech SynthesiS
  const startLocalTimer = (maxDuration: number) => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    
    const intervalMs = 100;
    progressTimerRef.current = setInterval(() => {
      setCurrentTime((prev) => {
        const rate = speedRateRef.current;
        const nextTime = prev + (intervalMs / 1000) * rate;
        if (nextTime >= maxDuration) {
          clearInterval(progressTimerRef.current);
          return maxDuration;
        }
        return nextTime;
      });
    }, intervalMs);
  };

  // Play Web Audio PCM buffer with custom offsets/durations
  const playPcmBuffer = (audioBuffer: AudioBuffer, offsetSecs: number, rate: number) => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    
    try {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
      }
    } catch(e) {}

    const ctx = getAudioContext();
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = rate;
    
    source.connect(ctx.destination);
    
    // Assign references
    sourceNodeRef.current = source;
    startTimeRef.current = ctx.currentTime - (offsetSecs / rate);
    setIsPlaying(true);

    source.start(0, offsetSecs);

    // Track active timeline slider progression
    const trackingIntervalMs = 100;
    progressTimerRef.current = setInterval(() => {
      const liveRate = speedRateRef.current;
      const elapsed = (ctx.currentTime - startTimeRef.current) * liveRate;
      if (elapsed >= audioBuffer.duration) {
        clearInterval(progressTimerRef.current);
        setCurrentTime(audioBuffer.duration);
        setIsPlaying(false);
      } else {
        setCurrentTime(elapsed);
      }
    }, trackingIntervalMs);

    // Trigger playing state update when playback naturally ends
    source.onended = () => {
      setIsPlaying(false);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  };

  // Toggle user click of Pause and Resume variables
  const handlePlayPause = () => {
    if (isBuffering) return;

    if (isPlaying) {
      // Pause action
      if (activeVoiceId === 'local') {
        window.speechSynthesis.pause();
        setIsPlaying(false);
        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      } else {
        if (sourceNodeRef.current) {
          try {
            sourceNodeRef.current.stop();
          } catch(e) {}
          sourceNodeRef.current = null;
        }
        pausedTimeRef.current = currentTime;
        setIsPlaying(false);
        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      }
    } else {
      // Resume action
      if (activeVoiceId === 'local') {
        window.speechSynthesis.resume();
        setIsPlaying(true);
        startLocalTimer(duration);
      } else {
        if (audioBufferRef.current) {
          const seekTarget = currentTime >= duration ? 0 : currentTime;
          playPcmBuffer(audioBufferRef.current, seekTarget, activeSpeedRate);
        } else {
          // Re-generate if buffer lost
          handleSynthesize(activeText, activeVoiceId, activeSpeedRate);
        }
      }
    }
  };

  // Backward 10 Seconds
  const handleSkipBackward = () => {
    if (isBuffering) return;
    const target = Math.max(0, currentTime - 10);
    handleSeek(target);
  };

  // Forward 10 Seconds
  const handleSkipForward = () => {
    if (isBuffering) return;
    const target = Math.min(duration, currentTime + 10);
    handleSeek(target);
  };

  // Dynamic seeker change
  const handleSeek = (seconds: number) => {
    if (isBuffering) return;

    if (activeVoiceId === 'local') {
      // Web speech API cannot seek to a precise timestamp natively on all browsers.
      // So we fallback to stopping and re-synthesizing or resuming with a relative estimate
      setCurrentTime(seconds);
      // Let's cancel and speak from a slice of length if seeking substantially
      try {
        window.speechSynthesis.cancel();
        
        // Roughly estimate where we are in characters to trim the string
        const charRatio = seconds / duration;
        const stringOffset = Math.floor(activeText.length * charRatio);
        const slicedText = activeText.substring(stringOffset);

        if (slicedText.trim()) {
          const utterance = new SpeechSynthesisUtterance(slicedText);
          utterance.rate = activeSpeedRate;
          // Dynamically adjust the pitch property slightly downward as the rate increases
          // to counteract the synthetic thinning effect ("chipmunk effect") and keep the voice sounding completely natural.
          const targetPitch = activeSpeedRate <= 1.0 ? 1.0 : (activeSpeedRate >= 2.0 ? 0.85 : (activeSpeedRate >= 1.5 ? 0.9 : (activeSpeedRate >= 1.25 ? 0.95 : 0.97)));
          utterance.pitch = targetPitch;
          utterance.lang = 'ka-GE';

          const voices = window.speechSynthesis.getVoices();
          const kaVoice = voices.find(v => v.lang.toLowerCase().includes('ka') || v.lang.toLowerCase().includes('ge'));
          if (kaVoice) utterance.voice = kaVoice;

          utterance.onstart = () => {
            setIsPlaying(true);
            startLocalTimer(duration - seconds);
          };

          utterance.onend = () => {
            setIsPlaying(false);
            setCurrentTime(duration);
          };

          speechUtteranceRef.current = utterance;
          window.speechSynthesis.speak(utterance);
        }
      } catch (e) {
        console.error("Local seek recreation failed:", e);
      }
    } else {
      // PCM can easily seek precisely
      setCurrentTime(seconds);
      pausedTimeRef.current = seconds;
      if (isPlaying && audioBufferRef.current) {
        playPcmBuffer(audioBufferRef.current, seconds, activeSpeedRate);
      }
    }
  };

  // Click prefilled history item
  const handleSelectHistoryItem = (item: HistoryItem) => {
    // Navigate straight to the audio player and begin reading this card's text!
    handleSynthesize(item.text, item.voiceName || 'Kore', activeSpeedRate);
  };

  // On editable text update in player
  const handleUpdateAndSynthesize = (newText: string) => {
    setActiveText(newText);
    handleSynthesize(newText, activeVoiceId, activeSpeedRate);
  };

  // Back to dashboard
  const handleBackToDashboard = () => {
    stopCurrentPlayback();
    setScreen('dashboard');
  };

  // Clear translation history
  const handleClearHistory = () => {
    setHistory([]);
  };

  return (
    <div className="bg-zinc-950 min-h-screen text-zinc-50 font-sans select-none" id="app-wrapper">
      {screen === 'auth' && (
        <AuthScreen onLogin={handleLogin} />
      )}

      {screen === 'dashboard' && user && (
        <DashboardScreen
          user={user}
          history={history}
          onLogout={handleLogout}
          onSynthesize={handleSynthesize}
          onSelectHistoryItem={handleSelectHistoryItem}
          onClearHistory={handleClearHistory}
          onHistoryFetched={setHistory}
        />
      )}

      {screen === 'player' && (
        <AudioPlayerScreen
          text={activeText}
          selectedVoiceId={activeVoiceId}
          voiceObj={PREBUILT_VOICES.find(v => v.id === activeVoiceId)}
          speedRate={activeSpeedRate}
          onSpeedRateChange={handleSpeedRateChange}
          
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          isBuffering={isBuffering}
          errorMessage={errorMessage}

          onPlayPauseToggle={handlePlayPause}
          onSkipBackward={handleSkipBackward}
          onSkipForward={handleSkipForward}
          onSeek={handleSeek}
          onUpdateAndSynthesize={handleUpdateAndSynthesize}
          onBackToDashboard={handleBackToDashboard}
        />
      )}
    </div>
  );
}
