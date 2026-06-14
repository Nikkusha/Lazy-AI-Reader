import React, { useState, useEffect } from 'react';
import { Sparkles, LogOut, Trash2, Clock, Calendar, Volume2, User, Play, ChevronRight, BookOpen } from 'lucide-react';
import { UserProfile, HistoryItem, VoiceOption } from '../types';
import { PREBUILT_VOICES } from '../data';
import { estimateReadTime } from '../utils';
import { supabase } from '../supabaseClient';

const SAMPLING_PHRASES = [
  "საქართველო ევროპისა და აზიის გზაჯვარედინზე მდებარეობს, რომელსაც აქვს ძალიან მდიდარი ისტორია, უნიკალური დამწერლობა და მრავალფეროვანი ბუნება კავკასიონის მთებიდან შავი ზღვის სანაპირომდე.",
  "ვეფხისტყაოსანი ქართული ლიტერატურის გვირგვინია, რომელიც მეთორმეტე საუკუნეში შოთა რუსთაველის მიერ დაიწერა. ეს პოემა სიყვარულის, ნამდვილი მეგობრობისა და ერთგულების უმაღლეს იდეალებს ქადაგებს საუკუნეების მანძილზე.",
  "ქართული ღვინის დამზადების ტრადიციული ტექნოლოგია, რომელიც ქვევრში ყურძნის წვენის დადუღებას გულისხმობს, რვა ათასზე მეტ წელს ითვლის და შესულია იუნესკოს არამატერიალური კულტურული მემკვიდრეობის ძეგლთა სიაში.",
  "თბილისი ქვეყნის დედაქალაქი და ყველაზე დიდი ქალაქია, რომელიც მეხუთე საუკუნეში ვახტანგ გორგასალმა დააარსა ცხელი გოგირდის წყაროების აღმოჩენის შემდეგ, რამაც განსაზღვრა მისი სახელი და კულტურული იდენტობა."
];

interface DashboardScreenProps {
  user: UserProfile;
  history: HistoryItem[];
  onLogout: () => void;
  onSynthesize: (text: string, voiceId: string, speedRate: number) => void;
  onSelectHistoryItem: (item: HistoryItem) => void;
  onClearHistory: () => void;
  onHistoryFetched: (items: HistoryItem[]) => void;
}

export default function DashboardScreen({
  user,
  history,
  onLogout,
  onSynthesize,
  onSelectHistoryItem,
  onClearHistory,
  onHistoryFetched
}: DashboardScreenProps) {
  const [inputText, setInputText] = useState('');
  const [selectedVoiceId, setSelectedVoiceId] = useState('Kore');
  const [speedRate, setSpeedRate] = useState(1.0);

  // Load this user's saved audio history from Supabase whenever the dashboard mounts
  useEffect(() => {
    const fetchHistory = async () => {
      const { data, error } = await supabase
        .from('audio_records')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch audio history:', error);
        return;
      }

      const mapped: HistoryItem[] = (data || []).map((record) => ({
        id: record.id.toString(),
        text: record.text,
        estimatedReadTime: estimateReadTime(record.text).formatted,
        date: new Date(record.created_at).toLocaleDateString('ka-GE', { day: 'numeric', month: 'short', year: 'numeric' }),
        voiceName: 'Kore',
        speedRate: record.speed_rate
      }));

      onHistoryFetched(mapped);
    };

    fetchHistory();
  }, [user.id]);

  const handleReadAloud = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const { error } = await supabase.from('audio_records').insert({
      text: inputText,
      speed_rate: speedRate,
      user_id: user.id,
      user_email: user.email
    });

    if (error) {
      console.error('Failed to save audio record:', error);
    }

    onSynthesize(inputText, selectedVoiceId, speedRate);
  };

  const handleTrySample = () => {
    const filtered = SAMPLING_PHRASES.filter(p => p !== inputText);
    const randomPhrase = filtered[Math.floor(Math.random() * filtered.length)];
    setInputText(randomPhrase);
  };

  const currentEst = estimateReadTime(inputText);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col font-sans" id="dashboard-container">
      {/* Premium Elegant Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-10 shrink-0" id="dashboard-header">
        <div className="flex items-center gap-3" id="header-logo-container">
          <div className="w-8 h-8 bg-zinc-50 rounded-lg flex items-center justify-center text-zinc-950">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#09090b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" x2="12" y1="19" y2="22"/>
            </svg>
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-white flex items-center gap-1.5 leading-none font-space">
            Lazy
          </h2>
          <div className="ml-2 px-2.5 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-[10px] font-medium uppercase tracking-wider text-zinc-300 font-sans">
            პრემიუმი
          </div>
        </div>

        {/* User profile detail + logout button */}
        <div className="flex items-center gap-4" id="header-profile-container">
          <div className="hidden sm:flex flex-col items-end" id="header-profile-text">
            <span className="text-xs font-semibold text-zinc-200 font-geo">{user.fullName}</span>
            <span className="text-[10px] text-zinc-500">{user.email}</span>
          </div>
          <button
            id="logout-button"
            className="h-9 w-9 flex items-center justify-center rounded-md border border-slate-800 hover:bg-zinc-900 transition-colors text-zinc-400 hover:text-rose-400 font-geo cursor-pointer"
            onClick={onLogout}
            title="გასვლა"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6" id="dashboard-main">
        {/* Left Side: Textarea input & voice selector (7 columns) */}
        <section className="col-span-1 lg:col-span-7 space-y-6" id="dashboard-left-section">
          <div className="bg-zinc-900/30 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6" id="input-control-panel">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4" id="panel-heading">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-zinc-400" />
                <h3 className="font-semibold text-white font-geo text-sm sm:text-base">ტექსტის შეყვანა</h3>
              </div>
            </div>

            <form onSubmit={handleReadAloud} className="space-y-6" id="tts-input-form">
              {/* Custom Textarea matching Sleek Interface exactly */}
              <div className="relative" id="textarea-container">
                <textarea
                  id="text-input-field"
                  className="w-full min-h-[250px] bg-zinc-900 border border-slate-800 rounded-xl p-6 text-base leading-relaxed text-zinc-50 placeholder:text-zinc-700 focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 focus:ring-offset-zinc-950 focus:outline-none transition-all resize-none font-geo pb-16"
                  placeholder="ჩაწერეთ ან ჩააფეისთეთ ტექსტი აქ... მაგალითად: სალამი საქართველო, როგორ ხართ?"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />
                <div className="absolute bottom-4 right-4 flex items-center gap-2">
                  {!inputText.trim() ? (
                    <button
                      id="try-sample-btn"
                      type="button"
                      onClick={handleTrySample}
                      className="text-xs bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700 py-1.5 px-3 rounded-md font-geo transition-all cursor-pointer shadow-sm hover:brightness-110 active:scale-[0.98]"
                    >
                      სცადე ნიმუში
                    </button>
                  ) : (
                    <button
                      id="clear-input-btn"
                      type="button"
                      onClick={() => setInputText('')}
                      className="text-xs bg-zinc-950 text-zinc-200 border border-slate-800 hover:bg-zinc-900 hover:text-white py-1.5 px-3 rounded-md font-geo transition cursor-pointer"
                    >
                      გასუფთავება
                    </button>
                  )}
                </div>
              </div>

              {/* Voice and Speed parameters side-by-side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-800/60 pt-5">
                {/* Speed indicator */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-medium text-zinc-400 font-geo flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-zinc-400" />
                      საუბრის სიჩქარე
                    </label>
                    <span className="text-xs font-mono font-semibold text-zinc-300 bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded">
                      {speedRate.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    className="w-full accent-zinc-50 bg-zinc-950 h-1.5 rounded-lg leading-none cursor-pointer border border-slate-800"
                    value={speedRate}
                    onChange={(e) => setSpeedRate(parseFloat(e.target.value))}
                  />
                  <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                    <span>0.5x</span>
                    <span>1.0x (ნორმალური)</span>
                    <span>2.0x</span>
                  </div>
                </div>

                {/* Estimate Audio Info bar */}
                <div className="bg-zinc-900 border border-slate-800 p-3 rounded-xl space-y-1 flex flex-col justify-center">
                  <span className="text-[10px] text-zinc-500 uppercase font-mono tracking-widest block">მოსალოდნელი დრო</span>
                  <div className="flex items-center gap-2 text-zinc-200">
                    <Clock className="w-4 h-4 text-zinc-400" />
                    <span className="text-sm font-semibold text-white font-geo">{currentEst.formatted}</span>
                  </div>
                </div>
              </div>

              {/* Large CTA high-contrast Button matching theme exactly */}
              <button
                id="synthesize-button"
                type="submit"
                disabled={!inputText.trim()}
                className="w-full bg-zinc-50 text-zinc-950 hover:bg-zinc-200 disabled:opacity-30 disabled:hover:bg-zinc-50 focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 focus:ring-offset-zinc-950 focus-visible:outline-none shadow-lg text-sm font-bold py-3.5 rounded-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all font-geo cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                გახმოვანება
              </button>
            </form>
          </div>
        </section>

        {/* Right Side: Translation History (5 columns) */}
        <section className="col-span-1 lg:col-span-5 space-y-6" id="dashboard-right-section">
          <div className="bg-zinc-900/30 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col h-full min-h-[450px]" id="history-panel">
            {/* History Panel Header */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4" id="history-header">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-zinc-400" />
                <h3 className="font-semibold text-white font-geo text-sm">ისტორია</h3>
              </div>
              {history.length > 0 && (
                <button
                  id="clear-all-history-btn"
                  onClick={onClearHistory}
                  className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 hover:bg-zinc-800 py-1 px-2 rounded border border-slate-800 transition cursor-pointer font-geo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  ყველას გასუფთავება
                </button>
              )}
            </div>

            {/* History Cards container */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 mt-4 max-h-[585px]" id="history-items-list">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-16 px-4 space-y-3" id="empty-history-visual">
                  <div className="p-3 bg-zinc-900 border border-slate-800 rounded-full text-zinc-500">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-300 font-geo">ისტორია ცარიელია</p>
                    <p className="text-xs text-zinc-500 font-geo mt-1">ჩაწერეთ ტექსტი და დააჭირეთ გახმოვანებას შესანახად</p>
                  </div>
                </div>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onSelectHistoryItem(item)}
                    className="p-3 bg-zinc-900 hover:bg-zinc-900 border border-slate-800 hover:border-zinc-650 rounded-lg transition-all duration-200 cursor-pointer group"
                    id={`history-item-card-${item.id}`}
                  >
                    {/* Text Preview paragraph */}
                    <p className="text-sm font-medium line-clamp-1 mb-1 text-zinc-100 group-hover:text-white font-geo">
                      {item.text}
                    </p>

                    {/* Metadata Footer bar */}
                    <div className="flex items-center justify-between text-[10px] text-zinc-550 group-hover:text-zinc-400">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 font-geo">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          {item.estimatedReadTime}
                        </span>
                        <span>•</span>
                        <span className="font-mono">{item.date}</span>
                      </div>
                      <span className="bg-zinc-900 border border-slate-800 px-1.5 py-0.5 rounded text-[9px] font-space text-zinc-400 font-medium group-hover:border-zinc-700">
                        {item.voiceName}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
