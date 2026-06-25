import React, { useState, useEffect } from "react";
import { Plus, Trash2, Edit3, Sparkles, BookOpen, FileText, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { Note, FlashcardDeck } from "../types";

interface NotepadProps {
  notes: Note[];
  decks: FlashcardDeck[];
  onAddNote: (title: string, content: string, category: string) => void;
  onUpdateNote: (id: string, title: string, content: string, category: string) => void;
  onDeleteNote: (id: string) => void;
  onAutoGenerateFlashcards: (noteId: string, deckId: string) => Promise<void>;
  isGeneratingFlashcards: boolean;
  hasAIKey: boolean;
}

export default function Notepad({
  notes,
  decks,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onAutoGenerateFlashcards,
  isGeneratingFlashcards,
  hasAIKey
}: NotepadProps) {
  const [selectedNoteId, setSelectedNoteId] = useState<string>(notes[0]?.id || "");
  const [isEditing, setIsEditing] = useState(false);

  // Form edit states
  const [noteTitle, setNoteTitle] = useState("");
  const [noteCategory, setNoteCategory] = useState("General Study");
  const [noteContent, setNoteContent] = useState("");

  const [targetDeckId, setTargetDeckId] = useState("");
  const [flashcardSuccess, setFlashcardSuccess] = useState(false);
  const [flashcardError, setFlashcardError] = useState<string | null>(null);

  const selectedNote = notes.find(n => n.id === selectedNoteId);

  // Auto-set target deck
  useEffect(() => {
    if (decks.length > 0 && !targetDeckId) {
      setTargetDeckId(decks[0].id);
    }
  }, [decks, targetDeckId]);

  // Load selected note into form on edit/view transition
  useEffect(() => {
    if (selectedNote) {
      setNoteTitle(selectedNote.title);
      setNoteCategory(selectedNote.category);
      setNoteContent(selectedNote.content);
    } else if (notes.length > 0) {
      setSelectedNoteId(notes[0].id);
    }
  }, [selectedNoteId, selectedNote, notes]);

  const handleCreateNote = () => {
    const defaultTitle = "Untitled Note";
    const defaultCategory = "General";
    const defaultContent = "# New Study Document\n\nWrite your markdown content here...";
    onAddNote(defaultTitle, defaultContent, defaultCategory);
    // Select the new note immediately (it will be at the end of list or we can search)
    setIsEditing(true);
  };

  const handleSave = () => {
    if (selectedNoteId) {
      onUpdateNote(selectedNoteId, noteTitle, noteContent, noteCategory);
      setIsEditing(false);
    }
  };

  const handleGenerateCards = async () => {
    if (!selectedNoteId || !targetDeckId) return;
    setFlashcardSuccess(false);
    setFlashcardError(null);
    try {
      await onAutoGenerateFlashcards(selectedNoteId, targetDeckId);
      setFlashcardSuccess(true);
      setTimeout(() => setFlashcardSuccess(false), 5000);
    } catch (err: any) {
      setFlashcardError(err.message || "Failed to generate active cards");
    }
  };

  return (
    <div id="notepad-card" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col h-full text-slate-100">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-400" />
          <h3 className="font-bold text-lg text-white">Study Notes & Notepad</h3>
        </div>
        <button
          onClick={handleCreateNote}
          className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Note
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-grow">
        {/* Left Notes List Bar (col-span-4) */}
        <div className="col-span-1 md:col-span-4 flex flex-col space-y-3 max-h-[300px] overflow-y-auto pr-1">
          {notes.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              No study notes. Create one to begin.
            </div>
          ) : (
            notes.map(note => (
              <button
                key={note.id}
                onClick={() => {
                  setSelectedNoteId(note.id);
                  setIsEditing(false);
                  setFlashcardSuccess(false);
                  setFlashcardError(null);
                }}
                className={`w-full text-left p-3 rounded-xl transition-all border ${
                  selectedNoteId === note.id
                    ? "bg-indigo-600/10 border-indigo-500 text-white"
                    : "bg-slate-950/20 border-slate-850 text-slate-400 hover:bg-slate-950/50 hover:text-slate-200"
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[9px] uppercase font-bold tracking-wider font-mono text-indigo-400">
                    {note.category}
                  </span>
                </div>
                <div className="text-xs font-semibold truncate text-slate-200">{note.title}</div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5">
                  {note.content.replace(/[#*`_]/g, "").substring(0, 45)}...
                </div>
              </button>
            ))
          )}
        </div>

        {/* Right Editor Pane (col-span-8) */}
        <div className="col-span-1 md:col-span-8 bg-slate-950/40 border border-slate-850 rounded-2xl p-4 flex flex-col justify-between min-h-[300px]">
          {selectedNote ? (
            <div className="flex flex-col flex-grow justify-between">
              {isEditing ? (
                <div className="space-y-3 flex-grow flex flex-col">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Title</label>
                      <input
                        type="text"
                        value={noteTitle}
                        onChange={e => setNoteTitle(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Category</label>
                      <input
                        type="text"
                        value={noteCategory}
                        onChange={e => setNoteCategory(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex-grow flex flex-col">
                    <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Content (Markdown Supported)</label>
                    <textarea
                      value={noteContent}
                      onChange={e => setNoteContent(e.target.value)}
                      rows={6}
                      className="w-full flex-grow bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 font-mono focus:outline-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1.5">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1 bg-slate-850 hover:bg-slate-800 text-slate-400 rounded text-xs"
                    >
                      Discard
                    </button>
                    <button
                      onClick={handleSave}
                      className="px-4 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded text-xs"
                    >
                      Save Document
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col flex-grow justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-850 pb-2 mb-3">
                      <div>
                        <span className="text-[10px] bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded font-mono">
                          {selectedNote.category}
                        </span>
                        <h4 className="text-sm font-bold text-slate-100 mt-1">{selectedNote.title}</h4>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setIsEditing(true)}
                          className="p-1.5 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-lg transition-colors cursor-pointer"
                          title="Edit note"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this study note?")) {
                              onDeleteNote(selectedNote.id);
                            }
                          }}
                          className="p-1.5 bg-slate-850 hover:bg-slate-800 text-rose-400 rounded-lg transition-colors cursor-pointer"
                          title="Delete note"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Simple Markdown Render view */}
                    <div className="text-xs text-slate-300 max-h-[140px] overflow-y-auto font-sans leading-relaxed space-y-1.5 pr-1">
                      {selectedNote.content.split('\n').map((line, i) => {
                        if (line.startsWith('# ')) {
                          return <h1 key={i} className="text-base font-bold text-white border-b border-slate-850/40 pb-1">{line.substring(2)}</h1>;
                        }
                        if (line.startsWith('## ')) {
                          return <h2 key={i} className="text-sm font-bold text-white pt-1">{line.substring(3)}</h2>;
                        }
                        if (line.startsWith('* ') || line.startsWith('- ')) {
                          return <li key={i} className="list-disc ml-4">{line.substring(2)}</li>;
                        }
                        return <p key={i}>{line}</p>;
                      })}
                    </div>
                  </div>

                  {/* AI Flashcard Generator Drawer */}
                  <div className="mt-4 pt-3 border-t border-slate-850 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950/40 p-3 rounded-xl">
                    <div className="text-left w-full sm:w-auto">
                      <div className="text-[10px] font-bold text-indigo-400 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-indigo-400 animate-pulse" /> Gemini AI Card Engine
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 max-w-xs">
                        Auto-generate 5-8 smart flashcards from this note.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      {decks.length > 0 && (
                        <select
                          value={targetDeckId}
                          onChange={e => setTargetDeckId(e.target.value)}
                          className="bg-slate-900 border border-slate-800 text-[11px] text-slate-200 rounded px-2 py-1.5"
                        >
                          {decks.map(deck => (
                            <option key={deck.id} value={deck.id}>
                              {deck.name}
                            </option>
                          ))}
                        </select>
                      )}

                      <button
                        onClick={handleGenerateCards}
                        disabled={isGeneratingFlashcards || !targetDeckId || !hasAIKey}
                        className="text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        {isGeneratingFlashcards ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" /> Distilling...
                          </>
                        ) : (
                          <>
                            <BookOpen className="w-3.5 h-3.5" /> Generate Cards
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {flashcardSuccess && (
                    <div className="mt-2 text-[10px] text-emerald-400 flex items-center gap-1.5 justify-center bg-emerald-950/20 py-1 rounded border border-emerald-900/30">
                      <CheckCircle className="w-3.5 h-3.5" /> Active revision flashcards successfully compiled in deck!
                    </div>
                  )}

                  {flashcardError && (
                    <div className="mt-2 text-[10px] text-rose-400 flex items-center gap-1.5 justify-center bg-rose-950/20 py-1 rounded border border-rose-900/30">
                      <AlertCircle className="w-3.5 h-3.5" /> {flashcardError}
                    </div>
                  )}

                </div>
              )}
            </div>
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center text-slate-500 py-16">
              <FileText className="w-8 h-8 mb-1" />
              <p className="text-sm">No notes written yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
