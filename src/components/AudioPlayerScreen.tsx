import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Play, Pause, RotateCcw, Volume2, Sparkles, RefreshCw, AlertCircle, Edit3, Save, Music } from 'lucide-react';
import { VoiceOption } from '../types';
import { formatTime } from '../utils';

interface AudioPlayerScreenProps {
  text: string;
  selectedVoiceId: string;
  voiceObj?: VoiceOption;
  speedRate: number;
  onSpeedRateChange: (rate: number) => void;
  
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isBuffering: boolean;
  errorMessage?: string;

  onPlayPauseToggle: () => void;
  onSkipBackward: () => void;
  onSkipForward: () => void;
  onSeek: (seconds: number) => void;
  onUpdateAndSynthesize: (newText: string) => void;
  onBackToDashboard: () => void;
}

export default function AudioPlayerScreen({
  text,
  selectedVoiceId,
  voiceObj,
  speedRate,
  onSpeedRateChange,
  
  isPlaying,
  currentTime,
  duration,
  isBuffering,
  errorMessage,

  onPlayPauseToggle,
  onSkipBackward,
  onSkipForward,
  onSeek,
  onUpdateAndSynthesize,
  onBackToDashboard
}: AudioPlayerScreenProps) {
  const [editableText, setEditableText] = useState(text);
  const [tick, setTick] = useState(0);

  // Keep a reference to tick animation frame
  const animationFrameId = useRef<number | null>(null);

  // Update original text when changed
  useEffect(() => {
    setEditableText(text);
  }, [text]);

  // Wobble effect for the waveform bars
  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        setTick((prev) => (prev + 1) % 360);
        animationFrameId.current = requestAnimationFrame(animate);
      };
      animationFrameId.current = requestAnimationFrame(animate);
    } else {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    }
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isPlaying]);

  const handleUpdateAndListen = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editableText.trim()) return;
    onUpdateAndSynthesize(editableText);
  };

  // Generate fixed bars for waveform representation
  const TOTAL_BARS = 45;
  const bars = Array.from({ length: TOTAL_BARS });

  // Calculate percentage progress of playback
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Handle manual clicking on track to seek
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onSeek(val);
  };

  const isGemini = voiceObj?.source.includes('Gemini');

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col font-sans" id="audio-player-page">
      <style>{`
        @keyframes waveform-skeleton-shimmer {
          0% { transform: translateX(-140%); }
          100% { transform: translateX(340%); }
        }
      `}</style>
      {/* Navigation Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-10 shrink-0" id="player-header">
        <button
          id="back-to-dashboard-btn"
          onClick={onBackToDashboard}
          className="flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white py-1.5 px-3 rounded-md hover:bg-zinc-900 border border-slate-800 transition cursor-pointer font-geo"
        >
          <ChevronLeft className="w-4 h-4" />
          უკან დაბრუნება
        </button>

        <div className="flex items-center gap-2" id="player-header-title">
          <span className="text-[10px] bg-zinc-850 text-zinc-300 border border-zinc-700 px-2 py-0.5 rounded-full font-sans font-medium uppercase tracking-wider">
            {isGemini ? 'Gemini AI Voice' : 'Web Synth Voice'}
          </span>
        </div>
      </header>

      {/* Main content body */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8" id="player-main">
        
        {/* Interactive Audio Player Card Container */}
        <div className="bg-zinc-900/30 border border-slate-800 rounded-xl p-6 sm:p-8 shadow-2xl space-y-8" id="player-main-card">
          
          {/* Active Voice Bio Panel */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4" id="player-status-bar">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-zinc-900 border border-slate-800 rounded-lg text-zinc-100 flex items-center justify-center">
                <Music className="w-5 h-5 text-zinc-400" />
              </div>
              <div>
                <span className="text-[10px] text-zinc-550 uppercase tracking-widest font-mono leading-none">მიმდინარე პერსონაჟი</span>
                <h3 className="font-semibold text-white font-geo text-sm mt-0.5">{voiceObj?.name.split(' (')[0] || selectedVoiceId}</h3>
              </div>
            </div>
            {isBuffering && (
              <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-750 px-3 py-1.5 rounded-full text-zinc-300 text-xs font-geo">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ხმის გენერირება...
              </div>
            )}
          </div>

          {/* Display potential error states nicely */}
          {errorMessage && (
            <div className="bg-rose-950/30 border border-rose-900/40 text-rose-200 p-4 rounded-lg flex items-start gap-3 mt-4" id="player-error">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed space-y-1">
                <h5 className="font-bold font-geo">შეცდომა სინთეზისას</h5>
                <p className="font-geo">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* 1. Dynamic modern waveform representing progress */}
          <div className="bg-zinc-900 border border-slate-800 rounded-xl p-8 flex flex-col items-center justify-center relative min-h-[140px] shadow-sm overflow-hidden" id="waveform-panel">
            {/* Background Grid Accent Lines */}
            <div className="absolute inset-x-0 bottom-4 top-4 border-y border-dashed border-slate-900/40 pointer-events-none select-none flex items-center justify-center">
              <div className="w-full h-px bg-slate-900/20"></div>
            </div>

            {/* Render dynamic soundwaves */}
            <div className="flex items-end gap-[3px] h-20 relative z-5" id="soundwave-bars">
              {isBuffering ? (
                <div className="relative flex h-3 items-center gap-[3px] overflow-hidden rounded-full">
                  {bars.map((_, i) => (
                    <div
                      key={`waveform-skeleton-${i}`}
                      className="h-3 w-[6px] rounded-full bg-zinc-700/90 ring-1 ring-zinc-500/40"
                    />
                  ))}
                  <div
                    className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-zinc-200/80 to-transparent blur-[1px]"
                    style={{ animation: 'waveform-skeleton-shimmer 1.25s linear infinite' }}
                  />
                </div>
              ) : (
                bars.map((_, i) => {
                  // Determine whether progress has reached this bar
                  const barRatio = i / TOTAL_BARS;
                  const active = progressPercent / 100 >= barRatio;

                  // Wobble formula using sinusoidal inputs when playing
                  let heightScale = 0.2; // default idle height ratio (min 20%)
                  if (isPlaying) {
                    // Phase shift wave to simulate left-to-right fluid travel
                    const basePhase = (tick * 10 - i * 18) * (Math.PI / 180);
                    // Dynamic height coefficient
                    heightScale = 0.35 + Math.sin(basePhase) * 0.45 + Math.cos(tick*0.06 + i)*0.25;
                    heightScale = Math.max(0.12, Math.min(1.0, heightScale));
                  } else if (active) {
                    // Subtle scale for played but idle soundwaves
                    heightScale = 0.28;
                  }

                  // Bar heights vary logically in look to resemble a pre-captured microphone sample
                  const initialFactor = Math.abs(Math.sin((i / TOTAL_BARS) * Math.PI)); // Arc pattern
                  const calculatedHeightPercent = (12 + heightScale * 68) * initialFactor;

                  return (
                    <div
                      key={i}
                      className={`w-[6px] rounded-full transition-all duration-150 ${
                        active 
                          ? 'bg-zinc-50 shadow-sm brightness-110' 
                          : 'bg-zinc-800 hover:bg-zinc-700'
                      }`}
                      style={{
                        height: `${Math.max(4, calculatedHeightPercent)}px`,
                      }}
                      title={`ბარი ${i + 1}`}
                    />
                  );
                })
              )}
            </div>
          </div>

          {/* 2. Sleek Custom Interactive Slider resembling Shadcn Slider */}
          <div className="space-y-2.5" id="slider-and-timer-panel">
            <div className="relative flex items-center select-none" id="slider-track-box">
              <input
                id="interactive-seek-slider"
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                disabled={isBuffering}
                onChange={handleSliderChange}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer outline-none focus:outline-none accent-zinc-50"
                style={{
                  background: `linear-gradient(to right, #fafafa 0%, #fafafa ${progressPercent}%, #27272a ${progressPercent}%, #27272a 100%)`
                }}
              />
            </div>

            {/* Current & Full Duration Play Timers */}
            <div className="flex justify-between items-center text-xs text-zinc-500 font-mono" id="player-timers">
              <span>{formatTime(currentTime)}</span>
              <span className="bg-zinc-900 border border-slate-800 px-2.5 py-0.5 rounded text-zinc-400 font-semibold font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* 3. Button Playback Controls Toolbar */}
          <div className="flex flex-col items-center gap-4 pt-1" id="playback-controls-wrapper">
            <div className="flex items-center justify-center gap-4" id="playback-controls">
              
              {/* Back 10 Seconds */}
              <button
                id="skip-backward-btn"
                type="button"
                disabled={isBuffering}
                onClick={onSkipBackward}
                className="p-3 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 border border-slate-800 rounded-lg text-zinc-300 hover:text-white transition duration-200 flex items-center justify-center cursor-pointer"
                title="10 წამით უკან გადასვლა"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="text-[10px] font-semibold font-mono ml-1.5">-10s</span>
              </button>

              {/* Play/Pause Toggle - Standard Primary High-Contrast Circular/Large Square */}
              <button
                id="player-play-pause-btn"
                type="button"
                disabled={isBuffering}
                onClick={onPlayPauseToggle}
                className="w-12 h-12 flex items-center justify-center bg-zinc-50 hover:bg-zinc-200 disabled:opacity-40 text-zinc-950 border border-transparent rounded-full transition duration-200 shadow-md cursor-pointer"
                title={isPlaying ? 'პაუზა' : 'დაწყება'}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 fill-zinc-950 text-zinc-950" />
                ) : (
                  <Play className="w-5 h-5 fill-zinc-950 text-zinc-950 ml-0.5" />
                )}
              </button>

              {/* Forward 10 Seconds */}
              <button
                id="skip-forward-btn"
                type="button"
                disabled={isBuffering}
                onClick={onSkipForward}
                className="p-3 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 border border-slate-800 rounded-lg text-zinc-300 hover:text-white transition duration-200 flex items-center justify-center cursor-pointer"
                title="10 წამით წინ გადასვლა"
              >
                <span className="text-[10px] font-semibold font-mono mr-1.5">+10s</span>
                <RotateCcw className="w-4 h-4 transform scale-x-[-1]" />
              </button>
            </div>

            {/* Interactive Speed Selector Pill */}
            <div className="flex items-center gap-3 bg-zinc-950/40 border border-slate-800/60 p-2 px-4 rounded-xl mt-2 w-full max-w-md justify-between select-none" id="playback-speed-selector">
              <span className="text-xs text-zinc-400 font-geo font-semibold shrink-0">ხმის სიჩქარე:</span>
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => {
                  const isSelected = Math.abs(speedRate - rate) < 0.05;
                  return (
                    <button
                      key={rate}
                      id={`speed-btn-${rate}`}
                      type="button"
                      onClick={() => onSpeedRateChange(rate)}
                      className={`px-2 py-1 rounded text-[10px] font-bold font-mono transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-zinc-50 text-zinc-950 shadow-sm font-extrabold scale-105' 
                          : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900'
                      }`}
                    >
                      {rate.toFixed(2)}x
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

        </div>

        {/* 4. Editable Text Section below controls inside secondary zinc card */}
        <div className="bg-zinc-900/30 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4" id="editable-text-panel">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3" id="edit-panel-header">
            <div className="flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-zinc-400" />
              <h4 className="font-semibold text-white font-geo text-sm">ტექსტის რედაქტირება მოსმენისას</h4>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono italic">სწრაფი განახლება</span>
          </div>

          <form onSubmit={handleUpdateAndListen} className="space-y-4" id="editable-text-form">
            <textarea
              id="player-text-editor"
              value={editableText}
              onChange={(e) => setEditableText(e.target.value)}
              className="w-full min-h-[110px] bg-zinc-900 border border-slate-800 text-white rounded-lg p-3 text-sm font-geo placeholder-zinc-700 focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 focus:ring-offset-zinc-950 focus-visible:outline-none focus:border-zinc-400 leading-relaxed resize-none"
              placeholder="შეცვალეთ ტექსტი..."
            />

            {/* Update & Listen button */}
            <button
              id="player-update-listen-btn"
              type="submit"
              disabled={isBuffering || !editableText.trim()}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-geo text-xs font-semibold py-3 border border-slate-700/80 rounded-lg flex items-center justify-center gap-2 transition duration-250 cursor-pointer disabled:opacity-40"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              განახლება და მოსმენა
            </button>
          </form>
        </div>

      </main>
    </div>
  );
}
