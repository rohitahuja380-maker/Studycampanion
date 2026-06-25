import React, { useState, useEffect } from "react";
import { Sparkles, ArrowRight, CheckCircle2, Clock, Brain, Loader2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Task, Note } from "../types";

interface Recommendation {
  title: string;
  description: string;
  type: 'task' | 'study_tip' | 'break';
  estimatedMinutes: number;
  relatedTaskId?: string;
  actionLabel: string;
}

interface AiCompanionProps {
  tasks: Task[];
  notes: Note[];
  onAddTask: (task: Omit<Task, 'id' | 'updatedAt'>) => void;
  onSelectTab: (tab: string, subTab?: string, initialData?: any) => void;
  hasAIKey: boolean;
}

export default function AiCompanion({
  tasks,
  notes,
  onAddTask,
  onSelectTab,
  hasAIKey
}: AiCompanionProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ tasks, notes })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${res.status}`);
      }

      const data = await res.json();
      setRecommendations(data);
      setCurrentIndex(0);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to contact Gemini. Make sure your GEMINI_API_KEY is configured.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasAIKey && recommendations.length === 0) {
      fetchRecommendations();
    }
  }, [hasAIKey]);

  const handleAction = (rec: Recommendation) => {
    if (rec.type === 'task' || rec.actionLabel.toLowerCase().includes('add')) {
      onAddTask({
        title: rec.title,
        description: rec.description,
        dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        estimatedMinutes: rec.estimatedMinutes,
        completed: false,
        category: 'Study',
        priority: 'high',
        aiRecommended: true,
        aiReason: rec.description
      });
      // Advance recommendation index or filter
      setRecommendations(prev => prev.filter(r => r.title !== rec.title));
      if (currentIndex >= recommendations.length - 1 && currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
      }
    } else if (rec.actionLabel.toLowerCase().includes('pomodoro') || rec.actionLabel.toLowerCase().includes('focus')) {
      onSelectTab('pomodoro', undefined, { preloadedTitle: rec.title, minutes: rec.estimatedMinutes });
    } else if (rec.actionLabel.toLowerCase().includes('flashcard') || rec.actionLabel.toLowerCase().includes('card')) {
      if (notes.length > 0) {
        onSelectTab('notes', undefined, { selectNoteId: notes[0].id, autoTriggerFlashcards: true });
      } else {
        onSelectTab('flashcards', undefined, { createNewDeck: true });
      }
    } else {
      onSelectTab('planner');
    }
  };

  const currentRec = recommendations[currentIndex];

  return (
    <div 
      id="ai-proactive-companion" 
      className="col-span-1 md:col-span-8 bg-indigo-600 rounded-3xl p-6 md:p-8 flex flex-col justify-between relative overflow-hidden text-white shadow-xl min-h-[300px]"
    >
      {/* Decorative blurred blob matches HTML exactly */}
      <div className="absolute -right-10 -top-10 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10 flex flex-col flex-grow">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="bg-white/25 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-300 animate-spin" /> Smart Recommendation
            </span>
            {recommendations.length > 1 && (
              <span className="text-indigo-200 text-xs font-semibold">
                ({currentIndex + 1} of {recommendations.length})
              </span>
            )}
          </div>
          
          <button
            onClick={fetchRecommendations}
            disabled={loading}
            className="text-[10px] bg-white/10 hover:bg-white/20 text-indigo-100 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 border border-white/10 cursor-pointer disabled:opacity-50"
            title="Refresh recommendations with Gemini AI"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-amber-200" />}
            Analyze Study Load
          </button>
        </div>

        <div className="flex-grow flex flex-col justify-center my-4 md:my-5">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading-rec"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2 py-4"
              >
                <div className="h-8 bg-white/20 rounded-lg animate-pulse w-3/4"></div>
                <div className="h-4 bg-white/10 rounded-lg animate-pulse w-5/6"></div>
                <div className="h-4 bg-white/10 rounded-lg animate-pulse w-2/3"></div>
              </motion.div>
            ) : error ? (
              <motion.div
                key="error-rec"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-indigo-100 text-sm flex gap-2"
              >
                <AlertCircle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white">AI Key Configuration Missing</p>
                  <p className="text-xs text-indigo-200 mt-1">
                    Please ensure you have configured <code className="bg-white/15 px-1 py-0.5 rounded font-mono">GEMINI_API_KEY</code> under the Secrets menu.
                  </p>
                </div>
              </motion.div>
            ) : !hasAIKey ? (
              <div className="text-indigo-100 text-sm flex gap-3">
                <Brain className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white">Waiting for Workspace Initialization</p>
                  <p className="text-xs text-indigo-200 mt-1">
                    Your smart proactive study predictions will render once your AI API credential activates.
                  </p>
                </div>
              </div>
            ) : !currentRec ? (
              <motion.div
                key="empty-rec"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-1"
              >
                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight leading-tight">
                  You are completely caught up! 🎉
                </h2>
                <p className="text-indigo-100 text-sm md:text-md opacity-80 mt-1.5">
                  Excellent work. No pending warnings, overdue tasks, or review gaps found on your study dashboard. Use the notepad or tasks pane to expand your focus map.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-2"
              >
                <h2 className="text-2.5xl md:text-3.5xl font-extrabold tracking-tight leading-tight text-white drop-shadow-sm">
                  {currentRec.title}
                </h2>
                <p className="text-indigo-100 text-sm md:text-md opacity-90 leading-relaxed font-medium">
                  {currentRec.description}
                </p>
                <div className="flex items-center gap-2 mt-2 text-xs text-indigo-200 font-mono">
                  <Clock className="w-3.5 h-3.5" /> Estimated time: {currentRec.estimatedMinutes} minutes
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="relative z-10 flex flex-col sm:flex-row gap-2 items-center justify-between pt-3 border-t border-white/10 mt-auto">
        {currentRec ? (
          <div className="flex gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => handleAction(currentRec)}
              className="bg-white hover:bg-slate-100 text-indigo-700 font-bold px-5 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1 cursor-pointer"
            >
              {currentRec.actionLabel}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            {recommendations.length > 1 && (
              <button
                onClick={() => setCurrentIndex(prev => (prev + 1) % recommendations.length)}
                className="bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer"
              >
                Next Tip
              </button>
            )}
          </div>
        ) : (
          <div className="text-xs text-indigo-200 font-medium italic">
            "An investment in knowledge pays the best interest." — Benjamin Franklin
          </div>
        )}
        <div className="text-[10px] font-mono text-indigo-200/60 uppercase tracking-widest mt-2 sm:mt-0">
          PROACTIVE RECOMMENDATIONS V1.0
        </div>
      </div>
    </div>
  );
}
