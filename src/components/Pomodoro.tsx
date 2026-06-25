import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, Coffee, Brain, Volume2, VolumeX, AlertCircle, Sparkles, CheckCircle } from "lucide-react";
import { PomodoroRecord } from "../types";

interface PomodoroProps {
  activeTaskTitle?: string;
  onSessionComplete: (record: Omit<PomodoroRecord, 'id' | 'updatedAt'>) => void;
  initialMinutes?: number;
}

export default function Pomodoro({
  activeTaskTitle,
  onSessionComplete,
  initialMinutes = 25
}: PomodoroProps) {
  const [phase, setPhase] = useState<'work' | 'short_break' | 'long_break'>('work');
  const [minutes, setMinutes] = useState(initialMinutes);
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [completedSessions, setCompletedSessions] = useState(0);

  const [currentTaskFocus, setCurrentTaskFocus] = useState<string>(activeTaskTitle || "");

  // Update focus task when parent changes it
  useEffect(() => {
    if (activeTaskTitle) {
      setCurrentTaskFocus(activeTaskTitle);
      // Reset timer to 25 if focus changes and timer isn't already active
      if (!isActive && phase === 'work') {
        setMinutes(25);
        setSeconds(0);
      }
    }
  }, [activeTaskTitle]);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const getPhaseDuration = (p: typeof phase) => {
    switch (p) {
      case 'work': return 25;
      case 'short_break': return 5;
      case 'long_break': return 15;
    }
  };

  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(() => {
        if (seconds > 0) {
          setSeconds(prev => prev - 1);
        } else if (minutes > 0) {
          setMinutes(prev => prev - 1);
          setSeconds(59);
        } else {
          // Timer finished
          handleTimerComplete();
        }
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, minutes, seconds]);

  const playNotification = () => {
    if (!soundEnabled) return;
    try {
      // Audio synthesis using Web Audio API to prevent iframe sound errors and make it 100% reliable
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      // Success melody: high, then higher
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.3); // G5

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (err) {
      console.warn("Web Audio API failed or blocked:", err);
    }
  };

  const handleTimerComplete = () => {
    setIsActive(false);
    playNotification();

    // Trigger save action
    const recordMinutes = getPhaseDuration(phase);
    onSessionComplete({
      taskTitle: phase === 'work' ? (currentTaskFocus || "General Focus") : undefined,
      durationMinutes: recordMinutes,
      completedAt: new Date().toISOString(),
      type: phase
    });

    if (phase === 'work') {
      setCompletedSessions(prev => prev + 1);
      // Auto-toggle to break
      const nextPhase = (completedSessions + 1) % 4 === 0 ? 'long_break' : 'short_break';
      setPhase(nextPhase);
      setMinutes(getPhaseDuration(nextPhase));
    } else {
      setPhase('work');
      setMinutes(getPhaseDuration('work'));
    }
    setSeconds(0);
  };

  const toggleTimer = () => {
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    setIsActive(false);
    setMinutes(getPhaseDuration(phase));
    setSeconds(0);
  };

  const selectPhase = (p: typeof phase) => {
    setIsActive(false);
    setPhase(p);
    setMinutes(getPhaseDuration(p));
    setSeconds(0);
  };

  // SVG progress logic
  const totalDurationSeconds = getPhaseDuration(phase) * 60;
  const currentSecondsLeft = minutes * 60 + seconds;
  const progressPercent = totalDurationSeconds > 0
    ? (totalDurationSeconds - currentSecondsLeft) / totalDurationSeconds
    : 0;

  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent * circumference);

  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div id="pomodoro-timer-card" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center text-center h-full text-slate-100">
      <div className="flex flex-wrap items-center justify-center gap-3.5 mb-5">
        <button
          id="pomodoro-phase-work"
          onClick={() => selectPhase('work')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            phase === 'work'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          Work
        </button>
        <button
          id="pomodoro-phase-break"
          onClick={() => selectPhase('short_break')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            phase === 'short_break'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          Break
        </button>
        <button
          id="pomodoro-phase-long-break"
          onClick={() => selectPhase('long_break')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            phase === 'long_break'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          Long Break
        </button>
      </div>

      <div className="relative w-40 h-40 flex items-center justify-center mb-4 mt-2">
        <svg className="absolute w-full h-full transform -rotate-90">
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke="currentColor"
            strokeWidth="6"
            fill="transparent"
            className="text-slate-800"
          />
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke="currentColor"
            strokeWidth="6"
            fill="transparent"
            className={phase === 'work' ? "text-indigo-500" : phase === 'short_break' ? "text-emerald-500" : "text-blue-500"}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="text-4.5xl font-mono font-bold tracking-tight text-white select-none">
          {formattedTime}
        </div>
      </div>

      <div className="text-sm font-semibold mb-1 uppercase tracking-wider text-slate-200">
        {phase === 'work' ? 'Deep Work Phase' : phase === 'short_break' ? 'Short Break' : 'Restoration Break'}
      </div>
      <div className="text-xs text-slate-400 font-mono flex items-center gap-1.5 justify-center">
        <span>Session {completedSessions} complete</span>
        <span>•</span>
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="text-slate-500 hover:text-slate-300 transition-colors"
          title={soundEnabled ? "Mute audio notification" : "Unmute audio notification"}
        >
          {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-indigo-400" /> : <VolumeX className="w-3.5 h-3.5" />}
        </button>
      </div>

      {phase === 'work' && (
        <div className="mt-3.5 w-full">
          <label className="block text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Focus Target</label>
          <input
            type="text"
            placeholder="What are you mastering?"
            value={currentTaskFocus}
            onChange={e => setCurrentTaskFocus(e.target.value)}
            className="w-full bg-slate-950/40 border border-slate-850 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-600 text-center"
          />
        </div>
      )}

      <div className="flex gap-2.5 mt-5">
        <button
          onClick={toggleTimer}
          className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            isActive
              ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/10'
          }`}
        >
          {isActive ? (
            <>
              <Pause className="w-3.5 h-3.5" /> Pause
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" /> Focus
            </>
          )}
        </button>
        <button
          onClick={resetTimer}
          title="Reset timer"
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all cursor-pointer border border-slate-750"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
