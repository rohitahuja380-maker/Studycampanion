export interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string; // ISO date string or empty
  estimatedMinutes: number;
  completed: boolean;
  category: 'Study' | 'Personal' | 'Work' | 'Other';
  priority: 'low' | 'medium' | 'high';
  aiRecommended: boolean;
  aiReason?: string;
  studyTopic?: string;
  updatedAt: number; // Timestamp for sync
}

export interface FlashcardDeck {
  id: string;
  name: string;
  description: string;
  updatedAt: number;
}

export interface Flashcard {
  id: string;
  deckId: string;
  front: string;
  back: string;
  mastered: boolean;
  updatedAt: number;
}

export interface Note {
  id: string;
  title: string;
  content: string; // markdown supported
  category: string;
  updatedAt: number;
}

export interface PomodoroRecord {
  id: string;
  taskTitle?: string;
  durationMinutes: number;
  completedAt: string; // ISO string
  type: 'work' | 'short_break' | 'long_break';
  updatedAt: number;
}

export interface SyncPayload {
  tasks: Task[];
  decks: FlashcardDeck[];
  cards: Flashcard[];
  notes: Note[];
  pomodoros: PomodoroRecord[];
  clientTimestamp: number;
}

export interface SyncResponse {
  tasks: Task[];
  decks: FlashcardDeck[];
  cards: Flashcard[];
  notes: Note[];
  pomodoros: PomodoroRecord[];
  serverTimestamp: number;
}
