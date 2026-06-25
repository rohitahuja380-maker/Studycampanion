import { Task, FlashcardDeck, Flashcard, Note, PomodoroRecord, SyncPayload, SyncResponse } from "../types";

const LOCAL_STORAGE_KEY_PREFIX = "ai_productivity_";

export interface AppData {
  tasks: Task[];
  decks: FlashcardDeck[];
  cards: Flashcard[];
  notes: Note[];
  pomodoros: PomodoroRecord[];
}

export type SyncState = "synced" | "offline" | "unsynced" | "syncing" | "error";

export function loadLocalData(): AppData {
  try {
    const tasks = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + "tasks") || "[]");
    const decks = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + "decks") || "[]");
    const cards = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + "cards") || "[]");
    const notes = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + "notes") || "[]");
    const pomodoros = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + "pomodoros") || "[]");

    return { tasks, decks, cards, notes, pomodoros };
  } catch (e) {
    console.error("Failed to load local data:", e);
    return { tasks: [], decks: [], cards: [], notes: [], pomodoros: [] };
  }
}

export function saveLocalData(data: AppData) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + "tasks", JSON.stringify(data.tasks));
    localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + "decks", JSON.stringify(data.decks));
    localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + "cards", JSON.stringify(data.cards));
    localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + "notes", JSON.stringify(data.notes));
    localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + "pomodoros", JSON.stringify(data.pomodoros));
  } catch (e) {
    console.error("Failed to save local data:", e);
  }
}

export async function syncWithServer(
  localData: AppData,
  isOfflineForced: boolean
): Promise<{ data: AppData; state: SyncState; error?: string }> {
  if (isOfflineForced || !navigator.onLine) {
    saveLocalData(localData);
    return { data: localData, state: "offline" };
  }

  try {
    const payload: SyncPayload = {
      ...localData,
      clientTimestamp: Date.now()
    };

    const response = await fetch("/api/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const syncedData: SyncResponse = await response.json();

    const mergedData: AppData = {
      tasks: syncedData.tasks,
      decks: syncedData.decks,
      cards: syncedData.cards,
      notes: syncedData.notes,
      pomodoros: syncedData.pomodoros
    };

    saveLocalData(mergedData);
    return { data: mergedData, state: "synced" };
  } catch (err: any) {
    console.error("Sync error:", err);
    saveLocalData(localData);
    return { data: localData, state: "error", error: err.message || "Network request failed" };
  }
}

export async function resetServerDB(): Promise<AppData> {
  const response = await fetch("/api/sync/reset", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    }
  });
  if (!response.ok) {
    throw new Error("Failed to reset database");
  }
  const data = await response.json();
  const resetData: AppData = {
    tasks: data.tasks,
    decks: data.decks,
    cards: data.cards,
    notes: data.notes,
    pomodoros: data.pomodoros
  };
  saveLocalData(resetData);
  return resetData;
}
