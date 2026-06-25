import React, { useState } from "react";
import { Plus, Check, Trash2, Calendar, AlertTriangle, Clock, Play, ListTodo, Sparkles, CheckSquare, Square, Loader2 } from "lucide-react";
import { Task } from "../types";

interface TaskPlannerProps {
  tasks: Task[];
  onAddTask: (task: Omit<Task, 'id' | 'updatedAt'>) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onPrioritizeTasks: () => void;
  isPrioritizing: boolean;
  priorityOrder: { taskId: string; timeSlot: string; reason: string }[];
  onStartPomodoro: (taskTitle: string) => void;
}

export default function TaskPlanner({
  tasks,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onPrioritizeTasks,
  isPrioritizing,
  priorityOrder,
  onStartPomodoro
}: TaskPlannerProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState(25);
  const [category, setCategory] = useState<Task['category']>("Study");
  const [priority, setPriority] = useState<Task['priority']>("medium");
  const [studyTopic, setStudyTopic] = useState("");

  const [showAddForm, setShowAddForm] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAddTask({
      title: title.trim(),
      description: description.trim(),
      dueDate,
      estimatedMinutes: Number(estimatedMinutes) || 25,
      category,
      priority,
      studyTopic: studyTopic.trim() || undefined,
      completed: false,
      aiRecommended: false
    });
    setTitle("");
    setDescription("");
    setDueDate("");
    setEstimatedMinutes(25);
    setStudyTopic("");
    setShowAddForm(false);
  };

  // Combine tasks with AI sequencing info if present
  const orderedTasks = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    // If we have AI priority, sort by that
    const aOrderIdx = priorityOrder.findIndex(p => p.taskId === a.id);
    const bOrderIdx = priorityOrder.findIndex(p => p.taskId === b.id);
    if (aOrderIdx !== -1 && bOrderIdx !== -1) {
      return aOrderIdx - bOrderIdx;
    }
    if (aOrderIdx !== -1) return -1;
    if (bOrderIdx !== -1) return 1;

    // Fallback: high priority first
    const priorities = { high: 3, medium: 2, low: 1 };
    return priorities[b.priority] - priorities[a.priority];
  });

  return (
    <div id="task-planner-card" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col h-full text-slate-100">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <ListTodo className="w-5 h-5 text-indigo-400" />
          <h3 className="font-bold text-lg text-white">Prioritized Tasks</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onPrioritizeTasks}
            disabled={isPrioritizing || tasks.filter(t => !t.completed).length === 0}
            className="text-[10px] font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-2 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            {isPrioritizing ? (
              <>
                <Loader2 className="w-2.5 h-2.5 animate-spin" /> Sorting...
              </>
            ) : (
              <>
                <Sparkles className="w-2.5 h-2.5" /> AI Sequence
              </>
            )}
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 mb-4 space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Task Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Prepare discrete math quiz"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Estimated Minutes</label>
              <input
                type="number"
                min="5"
                max="480"
                value={estimatedMinutes}
                onChange={e => setEstimatedMinutes(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-100 focus:outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-100 focus:outline-none"
              >
                <option value="Study">Study</option>
                <option value="Work">Work</option>
                <option value="Personal">Personal</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Study Topic</label>
              <input
                type="text"
                placeholder="TypeScript"
                value={studyTopic}
                onChange={e => setStudyTopic(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Description</label>
            <textarea
              placeholder="Provide extra details..."
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs hover:bg-slate-750 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs hover:bg-indigo-700 transition-all font-semibold cursor-pointer"
            >
              Add Task
            </button>
          </div>
        </form>
      )}

      {/* Task List container */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 max-h-[350px]">
        {orderedTasks.length === 0 ? (
          <div className="h-32 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-2xl text-slate-500 text-sm">
            <ListTodo className="w-6 h-6 mb-1 text-slate-600" />
            <span>No tasks added yet</span>
          </div>
        ) : (
          orderedTasks.map(task => {
            const sequenceInfo = priorityOrder.find(p => p.taskId === task.id);
            const isHigh = task.priority === "high";
            const isMedium = task.priority === "medium";

            return (
              <div
                key={task.id}
                className={`flex items-start gap-4 bg-slate-800/30 hover:bg-slate-800/50 p-4 rounded-xl border-l-4 transition-all ${
                  task.completed
                    ? "border-slate-700 opacity-50"
                    : isHigh
                    ? "border-rose-500"
                    : isMedium
                    ? "border-indigo-500"
                    : "border-slate-500"
                }`}
              >
                <button
                  onClick={() => onToggleTask(task.id)}
                  className="mt-1 flex-shrink-0 text-slate-400 hover:text-indigo-400 cursor-pointer"
                >
                  {task.completed ? (
                    <CheckSquare className="w-4.5 h-4.5 text-indigo-400" />
                  ) : (
                    <Square className="w-4.5 h-4.5" />
                  )}
                </button>

                <div className="flex-grow min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <h4 className={`text-sm font-semibold text-slate-200 leading-snug break-words ${task.completed ? "line-through text-slate-500" : ""}`}>
                      {task.title}
                    </h4>
                    <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0">
                      {task.category}
                    </span>
                  </div>

                  {task.description && (
                    <p className={`text-xs text-slate-400 mt-0.5 break-words ${task.completed ? "line-through text-slate-500" : ""}`}>
                      {task.description}
                    </p>
                  )}

                  {sequenceInfo && !task.completed && (
                    <div className="mt-1.5 bg-indigo-950/40 border border-indigo-900/30 rounded-lg p-1.5 text-[10px] text-indigo-300 flex items-start gap-1">
                      <Sparkles className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-semibold text-indigo-200">{sequenceInfo.timeSlot}:</strong> {sequenceInfo.reason}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
                    {task.dueDate && (
                      <span className="flex items-center gap-0.5 text-slate-400">
                        <Calendar className="w-3 h-3" /> Due {task.dueDate}
                      </span>
                    )}
                    <span className="flex items-center gap-0.5">
                      <Clock className="w-3 h-3" /> {task.estimatedMinutes}m
                    </span>
                    {task.studyTopic && (
                      <span className="bg-indigo-950 text-indigo-300 px-1 py-0.2 rounded font-mono">
                        #{task.studyTopic}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1 shrink-0 self-center">
                  {!task.completed && (
                    <button
                      onClick={() => onStartPomodoro(task.title)}
                      title="Focus on this task"
                      className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-850 rounded transition-all cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                  )}
                  <button
                    onClick={() => onDeleteTask(task.id)}
                    title="Delete task"
                    className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-850 rounded transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
