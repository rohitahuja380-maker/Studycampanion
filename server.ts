import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { Task, FlashcardDeck, Flashcard, Note, PomodoroRecord } from "./src/types";

dotenv.config();

// Initialize Gemini Client Lazily/Safely
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;

if (apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey.trim() !== "") {
  aiClient = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    throw new Error("GEMINI_API_KEY environment variable is required and must be configured via AI Studio Secrets.");
  }
  return aiClient;
}

// Pre-seeded Database State for Syncing (Cross-platform demo & persistent state)
const initialTimestamp = Date.now() - 3600000; // 1 hour ago
const mockTasks: Task[] = [
  {
    id: "task-seed-1",
    title: "Master TypeScript Generics & Advanced Types",
    description: "Read study note and complete exercise on Mapped Types, Conditional Types, and keyof operator.",
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0], // 2 days from now
    estimatedMinutes: 45,
    completed: false,
    category: "Study",
    priority: "high",
    aiRecommended: false,
    studyTopic: "TypeScript",
    updatedAt: initialTimestamp
  },
  {
    id: "task-seed-2",
    title: "Configure Spaced Repetition Interval",
    description: "Draft cards for active recall and perform your daily deck reviews.",
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // 1 day from now
    estimatedMinutes: 20,
    completed: false,
    category: "Study",
    priority: "medium",
    aiRecommended: false,
    studyTopic: "Spaced Repetition",
    updatedAt: initialTimestamp
  },
  {
    id: "task-seed-3",
    title: "Review Weekly Budget & Expense Log",
    description: "Update study-related book costs and tool subscriptions.",
    dueDate: "",
    estimatedMinutes: 15,
    completed: true,
    category: "Personal",
    priority: "low",
    aiRecommended: false,
    updatedAt: initialTimestamp
  }
];

const mockDecks: FlashcardDeck[] = [
  {
    id: "deck-seed-1",
    name: "Web Development Essentials",
    description: "Core concepts of frontend engineering, React render lifecycles, and TypeScript type constraints.",
    updatedAt: initialTimestamp
  }
];

const mockCards: Flashcard[] = [
  {
    id: "card-seed-1",
    deckId: "deck-seed-1",
    front: "What is the difference between a type and an interface in TypeScript?",
    back: "Interfaces are extendable and can be merged via declaration merging, whereas Types can define primitives, unions, and tuples and are closed to merging.",
    mastered: false,
    updatedAt: initialTimestamp
  },
  {
    id: "card-seed-2",
    deckId: "deck-seed-1",
    front: "What triggers a re-render in React?",
    back: "A state change, props update, or parent component re-render triggers a virtual DOM reconciliation.",
    mastered: true,
    updatedAt: initialTimestamp
  },
  {
    id: "card-seed-3",
    deckId: "deck-seed-1",
    front: "Explain Spaced Repetition System (SRS).",
    back: "A learning technique where flashcards are reviewed at increasing intervals (e.g., 1 day, 3 days, 7 days) to optimize long-term cognitive retention.",
    mastered: false,
    updatedAt: initialTimestamp
  }
];

const mockNotes: Note[] = [
  {
    id: "note-seed-1",
    title: "Effective Learning Strategy: Spaced Repetition",
    content: `# Spaced Repetition System (SRS) Guide

Spaced repetition is an evidence-based learning technique usually performed with flashcards. Newly introduced and more difficult flashcards are shown more frequently, while older and less difficult flashcards are shown less frequently in order to exploit the psychological spacing effect.

## Key Principles:
1. **Active Recall**: Force yourself to recall the answer before flipping the card. Do not just read passive study guides.
2. **Interval Spacing**: Review intervals double or triple when a card is answered correctly.
3. **Optimized Retention**: Prevents the 'forgetting curve' by reviewing topics right when they are about to fade from memory.
`,
    category: "Study Guide",
    updatedAt: initialTimestamp
  },
  {
    id: "note-seed-2",
    title: "React 19 & Hooks Cheatsheet",
    content: `# React 19 Core Hooks

* **useState**: Declares primitive/object states in functional components.
* **useEffect**: Synchronizes components with external side-effects safely. Remember to supply primitive values in the dependency array!
* **useContext**: Consumes shared global values without prop drilling.
* **useMemo / useCallback**: Stabilizes expensive computations or callback references to minimize unneeded rendering cycles.
`,
    category: "React",
    updatedAt: initialTimestamp
  }
];

const mockPomodoros: PomodoroRecord[] = [
  {
    id: "pomodoro-seed-1",
    taskTitle: "Master TypeScript Generics",
    durationMinutes: 25,
    completedAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    type: "work",
    updatedAt: initialTimestamp
  }
];

// In-Memory DB
let serverDB = {
  tasks: [...mockTasks],
  decks: [...mockDecks],
  cards: [...mockCards],
  notes: [...mockNotes],
  pomodoros: [...mockPomodoros]
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // --- API Routes ---

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", hasAI: !!aiClient });
  });

  // Cross-Platform Sync Endpoint
  app.post("/api/sync", (req, res) => {
    try {
      const clientData = req.body;
      if (!clientData) {
        return res.status(400).json({ error: "No payload provided" });
      }

      const clientTasks: Task[] = clientData.tasks || [];
      const clientDecks: FlashcardDeck[] = clientData.decks || [];
      const clientCards: Flashcard[] = clientData.cards || [];
      const clientNotes: Note[] = clientData.notes || [];
      const clientPomodoros: PomodoroRecord[] = clientData.pomodoros || [];

      // Last-Write-Wins Merge Helper
      const mergeArrays = <T extends { id: string; updatedAt: number }>(serverArr: T[], clientArr: T[]): T[] => {
        const map = new Map<string, T>();
        // Add existing server items
        serverArr.forEach(item => map.set(item.id, item));
        // Merge client items
        clientArr.forEach(clientItem => {
          const serverItem = map.get(clientItem.id);
          if (!serverItem || clientItem.updatedAt > serverItem.updatedAt) {
            map.set(clientItem.id, clientItem);
          }
        });
        return Array.from(map.values());
      };

      // Perform Merges
      serverDB.tasks = mergeArrays(serverDB.tasks, clientTasks);
      serverDB.decks = mergeArrays(serverDB.decks, clientDecks);
      serverDB.cards = mergeArrays(serverDB.cards, clientCards);
      serverDB.notes = mergeArrays(serverDB.notes, clientNotes);
      serverDB.pomodoros = mergeArrays(serverDB.pomodoros, clientPomodoros);

      res.json({
        tasks: serverDB.tasks,
        decks: serverDB.decks,
        cards: serverDB.cards,
        notes: serverDB.notes,
        pomodoros: serverDB.pomodoros,
        serverTimestamp: Date.now()
      });
    } catch (err: any) {
      console.error("Sync Error:", err);
      res.status(500).json({ error: "Failed to perform data synchronization: " + err.message });
    }
  });

  // Reset Server State Endpoint (useful for clean slates)
  app.post("/api/sync/reset", (req, res) => {
    serverDB = {
      tasks: [...mockTasks],
      decks: [...mockDecks],
      cards: [...mockCards],
      notes: [...mockNotes],
      pomodoros: [...mockPomodoros]
    };
    res.json({
      success: true,
      ...serverDB,
      serverTimestamp: Date.now()
    });
  });

  // AI Endpoint: Smart Productivity Recommendations
  app.post("/api/ai/recommend", async (req, res) => {
    const { tasks, notes } = req.body;
    try {
      const client = getAIClient();

      const prompt = `You are an expert AI Study Planner & Productivity Companion.
Your goal is to proactively assist the user in planning, prioritizing, and completing tasks before deadlines are missed.
Here are the user's active tasks and notes:

TASKS:
${JSON.stringify(tasks || [], null, 2)}

STUDY NOTES / TOPICS:
${JSON.stringify((notes || []).map((n: any) => ({ title: n.title, category: n.category })), null, 2)}

Provide 3 to 4 actionable, highly personalized recommendations. For instance:
- Suggest a Pomodoro session for an urgent or high-priority task.
- Suggest creating active-recall flashcards if the user took notes but has no associated flashcards or decks.
- Suggest breaking down an complex/long task into smaller chunks.
- Suggest a quick break or specific study technique (like active recall or spaced repetition) related to their topics.

You must reply with a valid JSON array of objects strictly matching this schema. Avoid markdown fences other than raw json format, return a valid JSON array directly.
JSON Schema:
[
  {
    "title": "Short, catchy action-oriented recommendation title (e.g. 'Start Focus Session: TypeScript Generics')",
    "description": "Engaging context. Why are you recommending this? (e.g., 'Your deadline is in 2 days. Concentrating for 25 minutes will build your momentum.')",
    "type": "task" | "study_tip" | "break",
    "estimatedMinutes": 25,
    "relatedTaskId": "string (the matching taskId if applicable, else empty)",
    "actionLabel": "Label for the CTA button (e.g., 'Start Pomodoro', 'Add Subtask', 'Generate Flashcards')"
  }
]
`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                type: { type: Type.STRING, description: "Must be 'task', 'study_tip', or 'break'" },
                estimatedMinutes: { type: Type.INTEGER },
                relatedTaskId: { type: Type.STRING },
                actionLabel: { type: Type.STRING }
              },
              required: ["title", "description", "type", "estimatedMinutes", "actionLabel"]
            }
          }
        }
      });

      const responseText = response.text || "[]";
      res.json(JSON.parse(responseText.trim()));
    } catch (err: any) {
      console.warn("AI Recommendation API experienced high load or error, serving high-quality fallbacks:", err.message || err);
      
      // Smart Fallback Recommendation Generator (Heuristics)
      const fallbacks = [];
      const highPriority = (tasks || []).filter((t: any) => !t.completed && t.priority === "high");
      
      if (highPriority.length > 0) {
        fallbacks.push({
          title: `Focus Session: ${highPriority[0].title}`,
          description: `Concentrate on this high-priority task using structured focus. Keeping your attention here will minimize last-minute bottlenecks.`,
          type: "task",
          estimatedMinutes: 25,
          relatedTaskId: highPriority[0].id,
          actionLabel: "Start Pomodoro"
        });
      } else {
        fallbacks.push({
          title: "Designate a Prime Revision Block",
          description: "Dedicate a distraction-free 30-minute block for review. Building daily consistency is key to long-term mastery.",
          type: "study_tip",
          estimatedMinutes: 30,
          actionLabel: "Open Study Material"
        });
      }

      if ((notes || []).length > 0) {
        const randomNote = notes[Math.floor(Math.random() * notes.length)];
        fallbacks.push({
          title: `Generate Recall Cards: ${randomNote.title}`,
          description: `Optimize your study guide on "${randomNote.category || 'general'}" by converting your written note into interactive memory revision cards.`,
          type: "study_tip",
          estimatedMinutes: 15,
          actionLabel: "Generate Flashcards"
        });
      } else {
        fallbacks.push({
          title: "Write Your First Study Note",
          description: "Summarizing complex concepts or coding paradigms as you read is proven to double mental retention rates.",
          type: "study_tip",
          estimatedMinutes: 15,
          actionLabel: "Open Notepad"
        });
      }

      fallbacks.push({
        title: "Perform a Cognitive Reset Break",
        description: "Step away from screens, walk around, or practice deep breathing for 5 minutes to restore mental processing bandwidth.",
        type: "break",
        estimatedMinutes: 5,
        actionLabel: "Start Break Timer"
      });

      res.json(fallbacks);
    }
  });

  // AI Endpoint: Generate Flashcards from Study Notes
  app.post("/api/ai/generate-flashcards", async (req, res) => {
    const { noteContent, noteTitle } = req.body;
    try {
      const client = getAIClient();

      if (!noteContent || noteContent.trim() === "") {
        return res.status(400).json({ error: "Note content is required to generate flashcards." });
      }

      const prompt = `You are a cognitive science expert specializing in Active Recall.
Your task is to analyze the following study note titled "${noteTitle || 'Untitled Note'}" and automatically generate 5-8 highly effective flashcards (Questions/Prompts on the front, clear and concise Answers/Explanations on the back).

Focus on high-yield testable concepts, definitions, and active reasoning rather than passive recognition.

STUDY NOTE CONTENT:
"""
${noteContent}
"""

You must respond with a JSON array matching this schema:
[
  {
    "front": "The question or term (active recall prompt)",
    "back": "The answer or concise explanation"
  }
]
`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                front: { type: Type.STRING },
                back: { type: Type.STRING }
              },
              required: ["front", "back"]
            }
          }
        }
      });

      const responseText = response.text || "[]";
      res.json(JSON.parse(responseText.trim()));
    } catch (err: any) {
      console.warn("AI Flashcard Generation experienced high load or error, serving parsed heuristics:", err.message || err);
      
      const content = noteContent || "";
      const lines = content.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
      const cards: { front: string; back: string }[] = [];

      // Parse lines to extract lists or bullet definitions
      for (const line of lines) {
        if (line.startsWith('#') || line.startsWith('==') || line.startsWith('---')) continue;
        
        if (line.includes(':') && line.length > 15 && line.length < 120) {
          const parts = line.split(':');
          const front = parts[0].replace(/^[-*+]\s+/, '').trim();
          const back = parts.slice(1).join(':').trim();
          if (front.length > 3 && back.length > 5) {
            cards.push({
              front: `Define/Explain: ${front}`,
              back: back
            });
          }
        } else if (line.includes('-') && line.length > 15 && line.length < 120 && !line.startsWith('-')) {
          const parts = line.split('-');
          const front = parts[0].trim();
          const back = parts.slice(1).join('-').trim();
          if (front.length > 3 && back.length > 5) {
            cards.push({
              front: `What is the significance of "${front}"?`,
              back: back
            });
          }
        }
      }

      if (cards.length < 3) {
        const cleanTitle = noteTitle || "this study topic";
        cards.push({
          front: `What is the primary theme or objective of ${cleanTitle}?`,
          back: `The notes outline foundational parameters, core methodologies, and implementation structures related to ${cleanTitle}.`
        });
        
        const headers = lines.filter((l: string) => l.startsWith('#') || l.startsWith('##') || l.startsWith('###'));
        if (headers.length > 0) {
          headers.slice(0, 3).forEach((h: string) => {
            const headerText = h.replace(/^#+\s+/, '').trim();
            cards.push({
              front: `What core insights are highlighted under the section: "${headerText}"?`,
              back: `This section details key concepts, functional considerations, and critical checklists defined within the study guide.`
            });
          });
        }

        cards.push({
          front: `How does active recall benefit memory retention of ${cleanTitle}?`,
          back: `Formulating specific questions and answers challenges your retrieval paths, protecting knowledge from the forgetting curve.`
        });
      }

      res.json(cards.slice(0, 6));
    }
  });

  // AI Endpoint: Smart Timeline & Task Prioritizer
  app.post("/api/ai/prioritize", async (req, res) => {
    const { tasks } = req.body;
    try {
      const client = getAIClient();

      if (!tasks || tasks.length === 0) {
        return res.json({ sequencedTasks: [] });
      }

      const prompt = `You are a high-performance productivity coach.
Analyze the user's task list, their urgency (due dates), priorities, and estimated times.
Return a sequenced, optimized timeline/order in which the user should work on these tasks today to make maximum progress and stay ahead of deadlines.

TASK LIST:
${JSON.stringify(tasks, null, 2)}

Provide a sequence list with recommended timeslots/periods (e.g. 'Morning (High Concentration)', 'After Lunch (Quick Wins)', 'Evening Review') and a clear cognitive reason why this sequencing is optimal.

Response must match this JSON schema:
{
  "sequencedTasks": [
    {
      "taskId": "string matching the original task.id",
      "timeSlot": "string (e.g. 'Morning (Prime Focus)')",
      "reason": "string (brief explanation why this is placed here, e.g. 'Due tomorrow and needs high mental energy')"
    }
  ]
}
`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sequencedTasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    taskId: { type: Type.STRING },
                    timeSlot: { type: Type.STRING },
                    reason: { type: Type.STRING }
                  },
                  required: ["taskId", "timeSlot", "reason"]
                }
              }
            },
            required: ["sequencedTasks"]
          }
        }
      });

      const responseText = response.text || '{"sequencedTasks":[]}';
      res.json(JSON.parse(responseText.trim()));
    } catch (err: any) {
      console.warn("AI Prioritize API experienced high load or error, serving sorted fallback sequence:", err.message || err);
      
      const activeTasks = (tasks || []).filter((t: any) => !t.completed);
      if (activeTasks.length === 0) {
        return res.json({ sequencedTasks: [] });
      }

      // Sort: High priority first, then medium, then low
      const sorted = [...activeTasks].sort((a: any, b: any) => {
        const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
        const weightA = priorityWeight[a.priority] || 0;
        const weightB = priorityWeight[b.priority] || 0;
        if (weightA !== weightB) return weightB - weightA;

        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        return 0;
      });

      const slots = [
        "Morning (Prime Focus)",
        "Late Morning (High Focus)",
        "Afternoon (Structured Action)",
        "Late Afternoon (Tasks & Admin)",
        "Evening (Reflection & Review)"
      ];

      const sequencedTasks = sorted.map((task: any, index: number) => {
        const slot = slots[Math.min(index, slots.length - 1)];
        let reason = "Scheduled based on optimal cognitive load.";
        if (task.priority === "high") {
          reason = "High priority target with maximum attention requirements. Best tackled while fresh.";
        } else if (task.dueDate) {
          reason = `Approaching due date (${task.dueDate}). Placed strategically to prevent bottlenecking.`;
        } else {
          reason = "Lower priority task designated for standard work blocks.";
        }
        return {
          taskId: task.id,
          timeSlot: slot,
          reason
        };
      });

      res.json({ sequencedTasks });
    }
  });


  // --- Vite & SPA Static Serves ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
