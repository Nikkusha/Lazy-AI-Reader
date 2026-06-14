import React, { useState } from 'react';
import { Sparkles, ArrowRight, User, Shield, Info, AlertCircle } from 'lucide-react';
import { UserProfile } from '../types';
import { supabase } from '../supabaseClient';

interface AuthScreenProps {
  onLogin: (profile: UserProfile) => void;
}

export default function AuthScreen({ onLogin }: AuthScreenProps) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfoMessage(null);

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin
          }
        });
        if (signUpError) throw signUpError;

        if (data.session && data.user) {
          onLogin({
            id: data.user.id,
            email: data.user.email ?? email,
            fullName: fullName || 'ქართველი მომხმარებელი'
          });
        } else {
          setInfoMessage('რეგისტრაცია წარმატებულია! გთხოვთ გადაამოწმოთ თქვენი ელ-ფოსტა და შემდეგ შედით სისტემაში.');
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (signInError) throw signInError;

        if (data.user) {
          onLogin({
            id: data.user.id,
            email: data.user.email ?? email,
            fullName: data.user.user_metadata?.full_name || 'ქართველი მომხმარებელი'
          });
        }
      }
    } catch (err: any) {
      setError(err.message || 'დაფიქსირდა შეცდომა. გთხოვთ სცადოთ ხელახლა.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-zinc-950 font-sans" id="auth-screen-container">
      <div className="w-full max-w-md bg-zinc-900 border border-slate-800 rounded-xl p-8 shadow-2xl space-y-8" id="auth-card">
        {/* Header Logo */}
        <div className="flex flex-col items-center text-center space-y-3" id="auth-logo-header">
          <div className="p-3 bg-zinc-800 border border-slate-700 rounded-xl flex items-center justify-center text-zinc-50" id="auth-icon-wrapper">
            <Sparkles className="w-8 h-8 text-indigo-400" id="auth-logo-icon" />
          </div>
          <div id="auth-brand-text">
            <h1 className="text-2xl font-bold font-space tracking-tight text-white flex items-center justify-center gap-2">
              Lazy <span className="text-xs bg-zinc-800 text-indigo-400 border border-slate-700 px-2 py-0.5 rounded-full font-sans uppercase">პრემიუმი</span>
            </h1>
            <p className="text-zinc-400 text-sm mt-1 font-geo">ქართული ხმის ხელოვნური ინტელექტი</p>
          </div>
        </div>

        {/* Tabs for Login & Sign Up */}
        <div className="grid grid-cols-2 p-1 bg-zinc-950 rounded-lg border border-slate-800" id="auth-tabs">
          <button
            id="login-tab-btn"
            type="button"
            className={`py-2 text-xs font-semibold rounded-md transition-all duration-200 font-geo ${
              !isSignUp ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
            }`}
            onClick={() => { setIsSignUp(false); setError(null); setInfoMessage(null); }}
          >
            შესვლა
          </button>
          <button
            id="signup-tab-btn"
            type="button"
            className={`py-2 text-xs font-semibold rounded-md transition-all duration-200 font-geo ${
              isSignUp ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
            }`}
            onClick={() => { setIsSignUp(true); setError(null); setInfoMessage(null); }}
          >
            რეგისტრაცია
          </button>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-5" id="auth-credentials-form">
          {isSignUp && (
            <div className="space-y-1.5" id="form-fullname-group">
              <label className="text-xs font-medium text-zinc-300 font-geo" htmlFor="fullname-input">
                სრული სახელი
              </label>
              <div className="relative">
                <input
                  id="fullname-input"
                  type="text"
                  required
                  placeholder="მაგ: გიორგი კალანდაძე"
                  className="w-full bg-zinc-950 border border-slate-800 placeholder-zinc-600 focus:placeholder-zinc-700 text-sm py-2.5 pl-9 pr-4 rounded-lg focus:ring-2 focus:ring-zinc-400 focus-visible:outline-none focus:border-zinc-400 text-white font-geo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
                <User className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          )}

          <div className="space-y-1.5" id="form-email-group">
            <label className="text-xs font-medium text-zinc-300 font-geo" htmlFor="email-input">
              ელ-ფოსტა
            </label>
            <div className="relative">
              <input
                id="email-input"
                type="email"
                required
                placeholder="სახელი@მაგალითი.გე"
                className="w-full bg-zinc-950 border border-slate-800 placeholder-zinc-600 focus:placeholder-zinc-700 text-sm py-2.5 pl-9 pr-4 rounded-lg focus:ring-2 focus:ring-zinc-400 focus-visible:outline-none focus:border-zinc-400 text-white font-sans"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <span className="text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold">@</span>
            </div>
          </div>

          <div className="space-y-1.5" id="form-password-group">
            <div className="flex justify-between items-center">
              <label className="text-xs font-medium text-zinc-300 font-geo" htmlFor="password-input">
                პაროლი
              </label>
              <a href="#forgot" className="text-[11px] text-zinc-400 hover:text-indigo-400 font-geo">
                დაგავიწყდათ?
              </a>
            </div>
            <div className="relative">
              <input
                id="password-input"
                type="password"
                required
                minLength={6}
                placeholder="პაროლი"
                className="w-full bg-zinc-950 border border-slate-800 placeholder-zinc-650 text-sm py-2.5 pl-9 pr-4 rounded-lg focus:ring-2 focus:ring-zinc-400 focus-visible:outline-none focus:border-zinc-400 text-white"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Shield className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {error && (
            <div className="bg-rose-950/30 border border-rose-900/40 text-rose-200 p-3 rounded-lg flex items-start gap-2 text-xs font-geo" id="auth-error-message">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {infoMessage && (
            <div className="bg-indigo-950/30 border border-indigo-900/40 text-indigo-200 p-3 rounded-lg flex items-start gap-2 text-xs font-geo" id="auth-info-message">
              <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          <button
            id="auth-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full bg-zinc-50 text-zinc-950 hover:bg-zinc-200 focus:ring-2 focus:ring-zinc-400 focus-visible:outline-none shadow text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 mt-2 font-geo cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <svg className="animate-spin h-4 w-4 text-zinc-950" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : isSignUp ? (
              <>
                რეგისტრაცია <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                ავტორიზაცია <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="border-t border-slate-800/60 pt-5 text-center flex flex-col items-center gap-2" id="auth-security-notice">
          <p className="text-[11px] text-zinc-500 font-geo flex items-center gap-1">
            <Info className="w-3.5 h-3.5 inline text-indigo-400" />
            თქვენი ანგარიში დაცულია Supabase ავტენტიფიკაციით.
          </p>
        </div>
      </div>
    </div>
  );
}
