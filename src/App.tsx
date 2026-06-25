import React, { useState, useEffect } from "react";
import { Sparkles, Brain, CheckSquare, Clock, BookOpen, FileText, Database, ShieldAlert, CheckCircle2, RefreshCw, Smartphone, Laptop, Settings, HelpCircle, ListTodo } from "lucide-react";
import { Task, FlashcardDeck, Flashcard, Note, PomodoroRecord } from "./types";
import { loadLocalData, saveLocalData, syncWithServer, SyncState, resetServerDB } from "./lib/syncService";

// Import Custom Sub-components
import AiCompanion from "./components/AiCompanion";
import TaskPlanner from "./components/TaskPlanner";
import Pomodoro from "./components/Pomodoro";
import Flashcards from "./components/Flashcards";
import Notepad from "./components/Notepad";

export default function App() {
  // Global Application State (Tasks, Decks, Cards, Notes, Pomodoros)
  const [tasks, setTasks] = useState<Task[]>([]);
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [pomodoros, setPomodoros] = useState<PomodoroRecord[]>([]);

  // System States
  const [syncState, setSyncState] = useState<SyncState>("synced");
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);
  const [isOfflineForced, setIsOfflineForced] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("dashboard"); // "dashboard", "focus", "study", "history"
  const [hasAIKey, setHasAIKey] = useState<boolean>(true); // default true, checked via API

  // AI Generation Loading States
  const [isPrioritizing, setIsPrioritizing] = useState(false);
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
  const [priorityOrder, setPriorityOrder] = useState<{ taskId: string; timeSlot: string; reason: string }[]>([]);

  // Focus Timer Cross-Trigger
  const [activePomodoroTaskTitle, setActivePomodoroTaskTitle] = useState<string>("");

  // Quick Note Scratchpad State (replicated on bento grid and persisted locally in notes[0])
  const [quickNoteText, setQuickNoteText] = useState("");

  // Check backend connection and API key on mount
  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch("/api/health");
        if (res.ok) {
          const data = await res.json();
          setHasAIKey(data.hasAI);
        } else {
          setHasAIKey(false);
        }
      } catch (err) {
        // Backend offline or starting up
        setHasAIKey(false);
      }
    }
    checkHealth();
  }, []);

  // Initialize and load data (Offline-First cache priority)
  useEffect(() => {
    const local = loadLocalData();
    setTasks(local.tasks);
    setDecks(local.decks);
    setCards(local.cards);
    setNotes(local.notes);
    setPomodoros(local.pomodoros);

    // Sync state is "unsynced" initially until the sync call completes
    setSyncState("unsynced");

    // Perform background sync with server
    triggerSynchronization(local);

    // Re-sync on network status change
    const handleOnline = () => triggerSynchronization(local);
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [isOfflineForced]);

  // Synchronize state with both local state updates & server db endpoints
  const triggerSynchronization = async (currentData?: {
    tasks: Task[];
    decks: FlashcardDeck[];
    cards: Flashcard[];
    notes: Note[];
    pomodoros: PomodoroRecord[];
  }) => {
    const dataToSync = currentData || { tasks, decks, cards, notes, pomodoros };
    setSyncState("syncing");
    const result = await syncWithServer(dataToSync, isOfflineForced);

    if (result.state === "synced") {
      setTasks(result.data.tasks);
      setDecks(result.data.decks);
      setCards(result.data.cards);
      setNotes(result.data.notes);
      setPomodoros(result.data.pomodoros);

      // Propagate the first note content to the scratchpad if present
      const studyGuideNote = result.data.notes.find(n => n.id === "note-seed-1");
      if (studyGuideNote) {
        setQuickNoteText(studyGuideNote.content.split('\n').slice(0, 5).join('\n'));
      }

      setSyncErrorMessage(null);
    } else if (result.state === "offline") {
      setSyncErrorMessage("Sync paused. Working in secure Local Storage mode.");
    } else if (result.state === "error") {
      setSyncErrorMessage(result.error || "A connection issue occurred.");
    }
    setSyncState(result.state);
  };

  // Helper helper to write and schedule background syncs
  const updateDataStateAndSync = (updated: {
    tasks?: Task[];
    decks?: FlashcardDeck[];
    cards?: Flashcard[];
    notes?: Note[];
    pomodoros?: PomodoroRecord[];
  }) => {
    const nextTasks = updated.tasks ?? tasks;
    const nextDecks = updated.decks ?? decks;
    const nextCards = updated.cards ?? cards;
    const nextNotes = updated.notes ?? notes;
    const nextPomodoros = updated.pomodoros ?? pomodoros;

    // Save state locally immediately (Zero latency)
    const payload = { tasks: nextTasks, decks: nextDecks, cards: nextCards, notes: nextNotes, pomodoros: nextPomodoros };
    saveLocalData(payload);

    if (updated.tasks) setTasks(nextTasks);
    if (updated.decks) setDecks(nextDecks);
    if (updated.cards) setCards(nextCards);
    if (updated.notes) setNotes(nextNotes);
    if (updated.pomodoros) setPomodoros(nextPomodoros);

    // Push async updates to cloud
    triggerSynchronization(payload);
  };

  // --- Task Operations ---
  const handleAddTask = (newTask: Omit<Task, 'id' | 'updatedAt'>) => {
    const task: Task = {
      ...newTask,
      id: "task-" + Math.random().toString(36).substring(2, 9),
      updatedAt: Date.now()
    };
    updateDataStateAndSync({ tasks: [...tasks, task] });
  };

  const handleToggleTask = (id: string) => {
    const next = tasks.map(t => t.id === id ? { ...t, completed: !t.completed, updatedAt: Date.now() } : t);
    updateDataStateAndSync({ tasks: next });
  };

  const handleDeleteTask = (id: string) => {
    const next = tasks.filter(t => t.id !== id);
    updateDataStateAndSync({ tasks: next });
  };

  const handlePrioritizeTasks = async () => {
    if (tasks.length === 0) return;
    setIsPrioritizing(true);
    try {
      const res = await fetch("/api/ai/prioritize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: tasks.filter(t => !t.completed) })
      });
      if (res.ok) {
        const data = await res.json();
        setPriorityOrder(data.sequencedTasks || []);
      }
    } catch (err) {
      console.error("Prioritizing failed", err);
    } finally {
      setIsPrioritizing(false);
    }
  };

  // --- Deck & Card Operations ---
  const handleAddDeck = (name: string, description: string): string => {
    const id = "deck-" + Math.random().toString(36).substring(2, 9);
    const newDeck: FlashcardDeck = {
      id,
      name,
      description,
      updatedAt: Date.now()
    };
    updateDataStateAndSync({ decks: [...decks, newDeck] });
    return id;
  };

  const handleAddCard = (deckId: string, front: string, back: string) => {
    const newCard: Flashcard = {
      id: "card-" + Math.random().toString(36).substring(2, 9),
      deckId,
      front,
      back,
      mastered: false,
      updatedAt: Date.now()
    };
    updateDataStateAndSync({ cards: [...cards, newCard] });
  };

  const handleToggleMastered = (cardId: string) => {
    const next = cards.map(c => c.id === cardId ? { ...c, mastered: !c.mastered, updatedAt: Date.now() } : c);
    updateDataStateAndSync({ cards: next });
  };

  const handleDeleteDeck = (deckId: string) => {
    const remainingDecks = decks.filter(d => d.id !== deckId);
    const remainingCards = cards.filter(c => c.deckId !== deckId);
    updateDataStateAndSync({ decks: remainingDecks, cards: remainingCards });
  };

  const handleDeleteCard = (cardId: string) => {
    const next = cards.filter(c => c.id !== cardId);
    updateDataStateAndSync({ cards: next });
  };

  // --- Study Note Operations ---
  const handleAddNote = (title: string, content: string, category: string) => {
    const newNote: Note = {
      id: "note-" + Math.random().toString(36).substring(2, 9),
      title,
      content,
      category,
      updatedAt: Date.now()
    };
    updateDataStateAndSync({ notes: [...notes, newNote] });
  };

  const handleUpdateNote = (id: string, title: string, content: string, category: string) => {
    const next = notes.map(n => n.id === id ? { ...n, title, content, category, updatedAt: Date.now() } : n);
    updateDataStateAndSync({ notes: next });
  };

  const handleDeleteNote = (id: string) => {
    const next = notes.filter(n => n.id !== id);
    updateDataStateAndSync({ notes: next });
  };

  const handleAutoGenerateFlashcards = async (noteId: string, deckId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    setIsGeneratingFlashcards(true);
    try {
      const res = await fetch("/api/ai/generate-flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteContent: note.content, noteTitle: note.title })
      });

      if (!res.ok) {
        throw new Error("Unable to contact card generator");
      }

      const generated: { front: string; back: string }[] = await res.json();

      const newCards: Flashcard[] = generated.map(g => ({
        id: "card-ai-" + Math.random().toString(36).substring(2, 9),
        deckId,
        front: g.front,
        back: g.back,
        mastered: false,
        updatedAt: Date.now()
      }));

      updateDataStateAndSync({ cards: [...cards, ...newCards] });
    } catch (err) {
      console.error(err);
      throw err;
    } finally {
      setIsGeneratingFlashcards(false);
    }
  };

  // --- Pomodoro Record Handler ---
  const handlePomodoroComplete = (newRecord: Omit<PomodoroRecord, 'id' | 'updatedAt'>) => {
    const rec: PomodoroRecord = {
      ...newRecord,
      id: "pomodoro-" + Math.random().toString(36).substring(2, 9),
      updatedAt: Date.now()
    };
    updateDataStateAndSync({ pomodoros: [rec, ...pomodoros] });
  };

  // Trigger from AI recommendations card
  const handleSelectTabFromRec = (tabName: string, target?: string, initialData?: any) => {
    if (tabName === 'pomodoro') {
      setActiveTab('focus');
      if (initialData?.preloadedTitle) {
        setActivePomodoroTaskTitle(initialData.preloadedTitle);
      }
    } else if (tabName === 'flashcards' || tabName === 'notes') {
      setActiveTab('study');
    } else {
      setActiveTab('dashboard');
    }
  };

  // Clean wipe server database & restart demo state
  const handleResetDB = async () => {
    if (confirm("Reset server database back to original sample study guides?")) {
      setSyncState("syncing");
      try {
        const data = await resetServerDB();
        setTasks(data.tasks);
        setDecks(data.decks);
        setCards(data.cards);
        setNotes(data.notes);
        setPomodoros(data.pomodoros);
        setSyncState("synced");
        setSyncErrorMessage(null);
      } catch (e: any) {
        setSyncState("error");
        setSyncErrorMessage("Failed to reset db: " + e.message);
      }
    }
  };

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen flex flex-col font-sans selection:bg-indigo-600/30 selection:text-white">
      {/* Upper Brand Header */}
      <header className="max-w-7xl w-full mx-auto px-6 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-indigo-600/20">
            Σ
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
              Scribe AI Productivity
              <span className="text-indigo-400 font-medium text-xs px-2 py-0.5 bg-indigo-400/10 rounded-full border border-indigo-400/20">
                v2.4
              </span>
            </h1>
            <p className="text-xs text-slate-400">Proactive Study Planning & Active Recall Engine</p>
          </div>
        </div>

        {/* Offline Status indicator and toggle controls */}
        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${
              isOfflineForced 
                ? "bg-amber-500 animate-pulse" 
                : syncState === "synced" 
                ? "bg-emerald-500" 
                : "bg-indigo-500 animate-pulse"
            }`}></div>
            <span className="text-[11px] text-slate-300 font-mono tracking-wider uppercase font-semibold">
              {isOfflineForced 
                ? "OFFLINE SYNC PAUSED" 
                : syncState === "synced" 
                ? "CLOUD SYNCED" 
                : syncState === "syncing"
                ? "SYNCING..."
                : "LOCAL STORAGE ACTIVE"}
            </span>
          </div>

          <div className="h-4 w-[1px] bg-slate-800"></div>

          {/* Sync mode controls */}
          <button
            onClick={() => setIsOfflineForced(!isOfflineForced)}
            className={`text-[10px] px-2 py-1 rounded font-bold cursor-pointer transition-all ${
              isOfflineForced
                ? "bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/30"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
            title={isOfflineForced ? "Reconnect to cloud sync server" : "Simulate working on-the-go offline"}
          >
            {isOfflineForced ? "Go Online" : "Go Offline"}
          </button>

          <button
            onClick={() => triggerSynchronization()}
            title="Force synchronization check"
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncState === "syncing" ? "animate-spin text-indigo-400" : ""}`} />
          </button>
        </div>
      </header>

      {/* Sync State Alert message */}
      {syncErrorMessage && (
        <div className="max-w-7xl w-full mx-auto px-6 mt-3">
          <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-3 text-xs text-amber-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
              {syncErrorMessage}
            </span>
            <button
              onClick={() => triggerSynchronization()}
              className="underline hover:text-white cursor-pointer font-semibold ml-2"
            >
              Retry Sync
            </button>
          </div>
        </div>
      )}

      {/* Main Core View Area */}
      <main className="max-w-7xl w-full mx-auto px-6 py-6 flex-grow flex flex-col justify-center">
        
        {/* DASHBOARD TAB - THE BENTO GRID */}
        {activeTab === "dashboard" && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 flex-grow">
            
            {/* Bento Grid Row 1: AI Recommendations (col-span-8) & Pomodoro Timer (col-span-4) */}
            <AiCompanion
              tasks={tasks}
              notes={notes}
              onAddTask={handleAddTask}
              onSelectTab={handleSelectTabFromRec}
              hasAIKey={hasAIKey}
            />

            <div className="col-span-1 md:col-span-4">
              <Pomodoro
                activeTaskTitle={activePomodoroTaskTitle}
                onSessionComplete={handlePomodoroComplete}
              />
            </div>

            {/* Bento Grid Row 2: Prioritized Tasks (col-span-5), Flashcards (col-span-4), and Quick Scratchpad (col-span-3) */}
            <div className="col-span-1 md:col-span-5">
              <TaskPlanner
                tasks={tasks}
                onAddTask={handleAddTask}
                onToggleTask={handleToggleTask}
                onDeleteTask={handleDeleteTask}
                onPrioritizeTasks={handlePrioritizeTasks}
                isPrioritizing={isPrioritizing}
                priorityOrder={priorityOrder}
                onStartPomodoro={(title) => {
                  setActivePomodoroTaskTitle(title);
                  setActiveTab("focus");
                }}
              />
            </div>

            <div className="col-span-1 md:col-span-4">
              <Flashcards
                decks={decks}
                cards={cards}
                onAddDeck={handleAddDeck}
                onAddCard={handleAddCard}
                onToggleMastered={handleToggleMastered}
                onDeleteDeck={handleDeleteDeck}
                onDeleteCard={handleDeleteCard}
              />
            </div>

            {/* Quick Note Scratchpad (Yellow amber block from mockup style) */}
            <div className="col-span-1 md:col-span-3 bg-amber-100 rounded-3xl p-6 flex flex-col text-slate-900 shadow-lg min-h-[250px]">
              <h3 className="font-bold text-sm mb-2 flex items-center gap-2 text-slate-800">
                <FileText className="w-4 h-4 text-amber-700" />
                Quick Scratchpad
              </h3>
              <p className="text-[10px] text-amber-800 uppercase font-mono tracking-wider font-semibold mb-2">
                Draft concepts, synced in study guide
              </p>
              
              <textarea
                value={quickNoteText}
                onChange={(e) => {
                  const val = e.target.value;
                  setQuickNoteText(val);
                  // Auto-save the first note or create a temporary one
                  if (notes.length > 0) {
                    const first = notes[0];
                    handleUpdateNote(first.id, first.title, val, first.category);
                  } else {
                    handleAddNote("Scratchpad Note", val, "General");
                  }
                }}
                placeholder="Remember to check gradient descent example... type or edit here."
                className="w-full flex-grow bg-amber-50/50 border border-amber-200 rounded-xl p-3 text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none resize-none font-medium leading-relaxed"
              />
              
              <div className="mt-4 pt-2 border-t border-amber-200/50 flex justify-between items-center text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                <span>Last saved: Live</span>
                <button
                  onClick={() => setActiveTab("study")}
                  className="hover:underline flex items-center gap-0.5"
                >
                  Edit Rich Notes →
                </button>
              </div>
            </div>

          </div>
        )}

        {/* FOCUS TAB - MAXIMIZED POMODORO AND FOCUS HISTORY */}
        {activeTab === "focus" && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
            <div className="col-span-1 md:col-span-5">
              <Pomodoro
                activeTaskTitle={activePomodoroTaskTitle}
                onSessionComplete={handlePomodoroComplete}
              />
            </div>
            
            <div className="col-span-1 md:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col text-slate-100">
              <h3 className="font-bold text-lg text-white mb-1 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-400" /> Focus Session History
              </h3>
              <p className="text-xs text-slate-400 mb-4">Track your deep study phases and rest breaks completed today.</p>
              
              <div className="flex-grow overflow-y-auto space-y-2.5 max-h-[380px] pr-1">
                {pomodoros.length === 0 ? (
                  <div className="h-44 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs text-center px-4">
                    <CheckCircle2 className="w-6 h-6 text-slate-600 mb-1" />
                    <p>No completed sessions recorded yet.</p>
                    <p className="text-slate-600 mt-0.5">Start your 25 minute work timer above!</p>
                  </div>
                ) : (
                  pomodoros.map((pom) => (
                    <div
                      key={pom.id}
                      className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          pom.type === 'work' ? 'bg-indigo-950 text-indigo-400' : 'bg-emerald-950 text-emerald-400'
                        }`}>
                          <Brain className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-200">
                            {pom.type === 'work' ? (pom.taskTitle || 'Deep Work') : 'Recharge Break'}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Completed at {new Date(pom.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-bold font-mono text-indigo-400 bg-indigo-950/20 px-2.5 py-1 rounded border border-indigo-900/30">
                        +{pom.durationMinutes}m
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* STUDY TAB - NOTE COMPILER AND FLASHCARDS */}
        {activeTab === "study" && (
          <div className="space-y-6">
            <Notepad
              notes={notes}
              decks={decks}
              onAddNote={handleAddNote}
              onUpdateNote={handleUpdateNote}
              onDeleteNote={handleDeleteNote}
              onAutoGenerateFlashcards={handleAutoGenerateFlashcards}
              isGeneratingFlashcards={isGeneratingFlashcards}
              hasAIKey={hasAIKey}
            />
          </div>
        )}

        {/* ANALYTICS & SETTINGS TAB */}
        {activeTab === "analytics" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Analytics Summary */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-slate-100 flex flex-col">
              <h3 className="font-bold text-lg text-white mb-1">Knowledge Retentions</h3>
              <p className="text-xs text-slate-400 mb-4">Summary statistics on tasks, notes, and spacing recall sessions.</p>

              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-850">
                  <div className="text-xs text-slate-500 uppercase tracking-wider font-bold">Tasks Completed</div>
                  <div className="text-3xl font-extrabold text-white mt-1">
                    {tasks.filter(t => t.completed).length} / {tasks.length}
                  </div>
                  <div className="text-[10px] text-indigo-400 mt-1">
                    {tasks.length > 0 ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100) : 0}% success velocity
                  </div>
                </div>

                <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-850">
                  <div className="text-xs text-slate-500 uppercase tracking-wider font-bold">Revision Cards</div>
                  <div className="text-3xl font-extrabold text-indigo-400 mt-1">
                    {cards.length}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {cards.filter(c => c.mastered).length} cards mastered in active recall
                  </div>
                </div>

                <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-850">
                  <div className="text-xs text-slate-500 uppercase tracking-wider font-bold">Minutes of Deep Focus</div>
                  <div className="text-3xl font-extrabold text-emerald-400 mt-1">
                    {pomodoros.filter(p => p.type === 'work').reduce((acc, curr) => acc + curr.durationMinutes, 0)}m
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Completed {pomodoros.length} interval phases
                  </div>
                </div>

                <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-850">
                  <div className="text-xs text-slate-500 uppercase tracking-wider font-bold">Study Notes</div>
                  <div className="text-3xl font-extrabold text-amber-400 mt-1">
                    {notes.length}
                  </div>
                  <div className="text-[10px] text-amber-500 mt-1">
                    Connected with AI Flashcard compiler
                  </div>
                </div>
              </div>
            </div>

            {/* System settings and Seed Controls */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-slate-100 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-lg text-white mb-1">Device Sync Controls</h3>
                <p className="text-xs text-slate-400 mb-4">Managing multi-device cross-platform synchronization and cloud caches.</p>

                <div className="space-y-3 bg-slate-950/40 p-4 rounded-2xl border border-slate-850">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <Laptop className="w-4 h-4 text-slate-400" /> Desktop Client Cache
                    </span>
                    <span className="text-[10px] bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded uppercase font-bold">
                      Primary
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <Smartphone className="w-4 h-4 text-slate-400" /> Mobile / PWA Client
                    </span>
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded uppercase font-bold">
                      Linked
                    </span>
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Troubleshooting & Cache</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    If you observe mismatch states between client windows, run manual synchronizations. Click below to restore database defaults if you would like to start clean.
                  </p>
                </div>
              </div>

              <div className="flex gap-2.5 pt-4 border-t border-slate-800 mt-6">
                <button
                  onClick={handleResetDB}
                  className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Reset Server Database
                </button>
                <button
                  onClick={() => triggerSynchronization()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Force Sync Now
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Navigation Bottom Control Bar */}
      <nav className="max-w-7xl w-full mx-auto px-6 pb-6 mt-8">
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3.5 text-slate-400 text-sm font-semibold w-full sm:w-auto justify-center sm:justify-start">
            <button
              id="nav-tab-dashboard"
              onClick={() => setActiveTab("dashboard")}
              className={`flex items-center gap-2.5 cursor-pointer transition-colors py-1 px-1.5 rounded-lg hover:bg-slate-800/30 ${
                activeTab === "dashboard" ? "text-white bg-slate-800/40" : "hover:text-slate-200"
              }`}
            >
              <div className={`w-2 h-2 bg-indigo-500 rounded-full transition-all ${
                activeTab === "dashboard" ? "opacity-100 scale-100" : "opacity-0 scale-50"
              }`}></div>
              Dashboard
            </button>
            
            <button
              id="nav-tab-focus"
              onClick={() => setActiveTab("focus")}
              className={`flex items-center gap-2.5 cursor-pointer transition-colors py-1 px-1.5 rounded-lg hover:bg-slate-800/30 ${
                activeTab === "focus" ? "text-white bg-slate-800/40" : "hover:text-slate-200"
              }`}
            >
              <div className={`w-2 h-2 bg-indigo-500 rounded-full transition-all ${
                activeTab === "focus" ? "opacity-100 scale-100" : "opacity-0 scale-50"
              }`}></div>
              Focus Room
            </button>

            <button
              id="nav-tab-study"
              onClick={() => setActiveTab("study")}
              className={`flex items-center gap-2.5 cursor-pointer transition-colors py-1 px-1.5 rounded-lg hover:bg-slate-800/30 ${
                activeTab === "study" ? "text-white bg-slate-800/40" : "hover:text-slate-200"
              }`}
            >
              <div className={`w-2 h-2 bg-indigo-500 rounded-full transition-all ${
                activeTab === "study" ? "opacity-100 scale-100" : "opacity-0 scale-50"
              }`}></div>
              Study Material
            </button>

            <button
              id="nav-tab-analytics"
              onClick={() => setActiveTab("analytics")}
              className={`flex items-center gap-2.5 cursor-pointer transition-colors py-1 px-1.5 rounded-lg hover:bg-slate-800/30 ${
                activeTab === "analytics" ? "text-white bg-slate-800/40" : "hover:text-slate-200"
              }`}
            >
              <div className={`w-2 h-2 bg-indigo-500 rounded-full transition-all ${
                activeTab === "analytics" ? "opacity-100 scale-100" : "opacity-0 scale-50"
              }`}></div>
              Analytics & Config
            </button>
          </div>

          <div className="text-slate-500 text-[10px] font-mono tracking-widest font-semibold text-center sm:text-right">
            PREMIUM ACCOUNT • SYNCED ACROSS 3 DEVICES
          </div>
        </div>
      </nav>
    </div>
  );
}
