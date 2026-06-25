import React, { useState } from "react";
import { Plus, Brain, BookOpen, Layers, CheckCircle2, RefreshCw, ChevronRight, ChevronLeft, Trash2, ArrowRight, Sparkles } from "lucide-react";
import { FlashcardDeck, Flashcard } from "../types";

interface FlashcardsProps {
  decks: FlashcardDeck[];
  cards: Flashcard[];
  onAddDeck: (name: string, description: string) => string;
  onAddCard: (deckId: string, front: string, back: string) => void;
  onToggleMastered: (id: string) => void;
  onDeleteDeck: (id: string) => void;
  onDeleteCard: (id: string) => void;
  initialSelectedDeckId?: string;
}

export default function Flashcards({
  decks,
  cards,
  onAddDeck,
  onAddCard,
  onToggleMastered,
  onDeleteDeck,
  onDeleteCard,
  initialSelectedDeckId
}: FlashcardsProps) {
  const [selectedDeckId, setSelectedDeckId] = useState<string>(initialSelectedDeckId || (decks[0]?.id || ""));
  const [reviewMode, setReviewMode] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  // Decks & Cards Creation States
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckDesc, setNewDeckDesc] = useState("");
  const [showNewDeckForm, setShowNewDeckForm] = useState(false);

  const [newCardFront, setNewCardFront] = useState("");
  const [newCardBack, setNewCardBack] = useState("");
  const [showNewCardForm, setShowNewCardForm] = useState(false);

  // Derived Values
  const currentDeck = decks.find(d => d.id === selectedDeckId);
  const deckCards = cards.filter(c => c.deckId === selectedDeckId);
  const unmasteredCards = deckCards.filter(c => !c.mastered);

  const handleCreateDeck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeckName.trim()) return;
    const newId = onAddDeck(newDeckName.trim(), newDeckDesc.trim());
    setSelectedDeckId(newId);
    setNewDeckName("");
    setNewDeckDesc("");
    setShowNewDeckForm(false);
  };

  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeckId || !newCardFront.trim() || !newCardBack.trim()) return;
    onAddCard(selectedDeckId, newCardFront.trim(), newCardBack.trim());
    setNewCardFront("");
    setNewCardBack("");
    setShowNewCardForm(false);
  };

  const activeCardsList = reviewMode ? deckCards : deckCards; // we let them study everything or filtered
  const activeCard = activeCardsList[currentCardIndex];

  const handleNext = () => {
    setShowAnswer(false);
    setCurrentCardIndex(prev => (prev + 1) % activeCardsList.length);
  };

  const handlePrev = () => {
    setShowAnswer(false);
    setCurrentCardIndex(prev => (prev - 1 + activeCardsList.length) % activeCardsList.length);
  };

  return (
    <div id="flashcards-card" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col h-full text-slate-100">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-400" />
          <h3 className="font-bold text-lg text-white">Active Recall Decks</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewDeckForm(!showNewDeckForm)}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-400" /> New Deck
          </button>
        </div>
      </div>

      {/* Create Deck Form */}
      {showNewDeckForm && (
        <form onSubmit={handleCreateDeck} className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 mb-4 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Create New Deck</h4>
          <div>
            <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Deck Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Machine Learning, Physics formulas"
              value={newDeckName}
              onChange={e => setNewDeckName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-850 rounded-lg px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Description</label>
            <input
              type="text"
              placeholder="e.g. Exam notes and core concepts"
              value={newDeckDesc}
              onChange={e => setNewDeckDesc(e.target.value)}
              className="w-full bg-slate-900 border border-slate-850 rounded-lg px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowNewDeckForm(false)}
              className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs"
            >
              Create Deck
            </button>
          </div>
        </form>
      )}

      {/* Main Study Deck View */}
      {decks.length === 0 ? (
        <div className="h-44 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-2xl text-slate-500 text-center px-4">
          <Layers className="w-8 h-8 text-slate-600 mb-2" />
          <p className="text-sm font-semibold">No revision decks found</p>
          <p className="text-xs text-slate-500 max-w-xs mt-1">
            Build active study blocks by adding a flashcard deck or auto-generate cards from study notes.
          </p>
        </div>
      ) : (
        <div className="flex flex-col flex-grow">
          {/* Deck Selector Row */}
          <div className="flex flex-wrap items-center gap-3 mb-5 max-w-full">
            {decks.map(deck => (
              <button
                id={`deck-tab-${deck.id}`}
                key={deck.id}
                onClick={() => {
                  setSelectedDeckId(deck.id);
                  setCurrentCardIndex(0);
                  setShowAnswer(false);
                }}
                className={`flex-shrink-0 px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                  selectedDeckId === deck.id
                    ? "bg-indigo-600 text-white shadow-md"
                    : "bg-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                {deck.name}
              </button>
            ))}
          </div>

          {currentDeck && (
            <div className="flex flex-col flex-grow">
              <div className="flex items-center justify-between mb-3.5 text-xs text-slate-400 bg-slate-950/40 px-3 py-2 rounded-xl border border-slate-850">
                <div>
                  <span className="font-bold text-slate-300">{deckCards.length}</span> cards in deck •{" "}
                  <span className="font-bold text-indigo-400">{unmasteredCards.length}</span> unmastered
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowNewCardForm(!showNewCardForm)}
                    className="text-[10px] text-indigo-400 font-bold hover:underline cursor-pointer"
                  >
                    + Add Card
                  </button>
                  <span>|</span>
                  <button
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this deck? All associated cards will be deleted.")) {
                        onDeleteDeck(currentDeck.id);
                        const remaining = decks.filter(d => d.id !== currentDeck.id);
                        if (remaining.length > 0) setSelectedDeckId(remaining[0].id);
                      }
                    }}
                    className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                  >
                    Delete Deck
                  </button>
                </div>
              </div>

              {/* Add Card Form */}
              {showNewCardForm && (
                <form onSubmit={handleCreateCard} className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 mb-3 space-y-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Front (Question / Prompt)</label>
                    <input
                      type="text"
                      required
                      placeholder="What is Backpropagation?"
                      value={newCardFront}
                      onChange={e => setNewCardFront(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-850 rounded-lg px-2.5 py-1 text-xs text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Back (Answer / Details)</label>
                    <textarea
                      required
                      placeholder="Algorithm to calculate gradient of error function..."
                      rows={2}
                      value={newCardBack}
                      onChange={e => setNewCardBack(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-850 rounded-lg px-2.5 py-1 text-xs text-slate-100"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowNewCardForm(false)}
                      className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 bg-indigo-600 text-white font-semibold rounded text-xs"
                    >
                      Save Card
                    </button>
                  </div>
                </form>
              )}

              {/* Card Slider Frame */}
              {deckCards.length === 0 ? (
                <div className="flex-grow flex flex-col items-center justify-center py-8 text-center text-slate-500 bg-slate-950/20 rounded-2xl border border-slate-800 border-dashed">
                  <Brain className="w-6 h-6 text-slate-600 mb-1" />
                  <p className="text-xs font-semibold">Deck is empty</p>
                  <button
                    onClick={() => setShowNewCardForm(true)}
                    className="mt-2 text-xs text-indigo-400 hover:underline"
                  >
                    Add your first card
                  </button>
                </div>
              ) : activeCard ? (
                <div className="flex-grow flex flex-col justify-between">
                  {/* Outer Flip Card Container */}
                  <div
                    onClick={() => setShowAnswer(!showAnswer)}
                    className="group relative flex-grow min-h-[140px] bg-slate-950/50 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer select-none transition-all hover:bg-slate-950/70"
                  >
                    {/* Mastery Stamp */}
                    {activeCard.mastered && (
                      <span className="absolute top-3 right-3 bg-indigo-500/10 text-indigo-400 text-[9px] font-bold px-2 py-0.5 rounded-full border border-indigo-500/20 flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3 text-indigo-400" /> Mastery
                      </span>
                    )}

                    <div className="text-center">
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
                        {showAnswer ? "ANSWER (CLICK TO FLIP)" : "PROMPT (CLICK TO FLIP)"}
                      </span>
                      <p className={`text-md leading-relaxed italic mt-2 text-slate-100 ${showAnswer ? 'text-indigo-200' : ''}`}>
                        {showAnswer ? activeCard.back : activeCard.front}
                      </p>
                    </div>

                    <div className="absolute bottom-2 text-[9px] text-slate-500">
                      Card {currentCardIndex + 1} of {deckCards.length}
                    </div>
                  </div>

                  {/* Study Navigation & mastery control */}
                  <div className="flex items-center justify-between gap-3 mt-4">
                    <div className="flex gap-1">
                      <button
                        onClick={handlePrev}
                        className="p-1.5 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-lg cursor-pointer"
                        title="Previous card"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleNext}
                        className="p-1.5 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-lg cursor-pointer"
                        title="Next card"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      onClick={() => onToggleMastered(activeCard.id)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 border cursor-pointer transition-all ${
                        activeCard.mastered
                          ? "bg-slate-850 border-slate-700 text-slate-400 hover:text-slate-200"
                          : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20"
                      }`}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      {activeCard.mastered ? "Unmark Mastered" : "Mark Mastered"}
                    </button>

                    <button
                      onClick={() => {
                        onDeleteCard(activeCard.id);
                        if (currentCardIndex > 0) setCurrentCardIndex(prev => prev - 1);
                      }}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition-colors"
                      title="Delete card"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
