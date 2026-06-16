"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CornerDownLeft } from "lucide-react";
import {
  useBoard,
  useCreateTask,
  useUpdateTask
} from "../../../../lib/query/hooks";
import { useBoardRealtime } from "../../../../lib/realtime/use-realtime";
import { Avatar, Button, Card, Input, PriorityBadge, Spinner } from "../../../../components/ui";
import { TaskPanel } from "../../../../components/task-panel";
import type { BoardColumn, Task } from "../../../../lib/types";

/* ─── New Task Inline Form ──────────────────────────────────────────── */

function NewTaskForm({ boardId, columnId }: { boardId: string; columnId: string }) {
  const createTask = useCreateTask(boardId);
  const [title, setTitle] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = title.trim();
    if (!value) return;
    await createTask.mutateAsync({ title: value, columnId });
    setTitle("");
  }

  return (
    <form className="mt-2" onSubmit={onSubmit}>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="+ Add a task…"
        className="bg-transparent border-dashed border-[var(--color-border-default)] hover:border-[var(--color-border-input)] focus:border-[var(--color-border-focused)] focus:bg-[var(--color-bg-input)] text-[var(--font-size-md)]"
      />
    </form>
  );
}

/* ─── Board Page ────────────────────────────────────────────────────── */

export default function BoardPage() {
  const params = useParams<{ boardId: string }>();
  const boardId = params.boardId;
  const { data: board, isLoading } = useBoard(boardId);
  const updateTask = useUpdateTask(boardId);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const { onlineUserIds, typing } = useBoardRealtime({
    boardId,
    projectId: board?.projectId,
    workspaceId: board?.project.workspaceId
  });

  function moveTask(task: Task, columns: BoardColumn[], direction: -1 | 1) {
    const index = columns.findIndex((c) => c.id === task.columnId);
    const target = columns[index + direction];
    if (target) {
      updateTask.mutate({ taskId: task.id, body: { columnId: target.id } });
    }
  }

  if (isLoading || !board) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }

  const onlineCount = onlineUserIds.length;

  return (
    <div className="space-y-4">
      {/* Board header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/app/workspaces/${board.project.workspaceId}`}
            className="inline-flex items-center gap-1 text-[var(--font-size-sm)] text-[var(--color-text-subtle)] hover:text-[var(--color-text-brand)] transition-colors"
          >
            <CornerDownLeft size={12} className="rotate-90" />
            {board.project.name}
          </Link>
          <h1 className="text-[var(--font-size-xl)] font-semibold text-[var(--color-text-default)]">
            {board.name}
          </h1>
        </div>
        {onlineCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-full)] bg-[var(--ds-green-50)] px-2.5 py-1 text-[var(--font-size-xs)] font-medium text-[var(--ds-green-700)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--ds-green-600)]" />
            {onlineCount} online
          </span>
        )}
      </div>

      {/* Kanban columns */}
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
        {board.columns.map((column) => (
          <div
            key={column.id}
            className="flex w-[272px] shrink-0 flex-col rounded-[var(--radius-lg)] bg-[var(--color-bg-surface-sunken)] p-2"
          >
            {/* Column header */}
            <div className="flex items-center justify-between px-1.5 py-1.5">
              <h2 className="text-[var(--font-size-sm)] font-semibold text-[var(--color-text-subtle)] uppercase tracking-wide">
                {column.name}
              </h2>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-full)] bg-[var(--ds-neutral-200)] px-1 text-[var(--font-size-xs)] font-medium text-[var(--color-text-subtle)]">
                {column.tasks.length}
              </span>
            </div>

            {/* Task cards */}
            <div className="mt-1 space-y-1.5 flex-1">
              {column.tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className="group rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-2.5 cursor-pointer transition-shadow hover:shadow-[var(--shadow-card-hover)] active:bg-[var(--ds-neutral-50)]"
                >
                  <p className="text-[var(--font-size-md)] font-medium text-[var(--color-text-default)] leading-snug">
                    {task.title}
                  </p>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={task.priority} />
                      {task.assignees.length > 0 && (
                        <div className="flex -space-x-1.5">
                          {task.assignees.slice(0, 3).map((a) => (
                            <Avatar
                              key={a.userId}
                              name={a.user.name}
                              email={a.user.email}
                              size="sm"
                            />
                          ))}
                          {task.assignees.length > 3 && (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--ds-neutral-200)] text-[9px] font-medium text-[var(--color-text-subtle)] ring-2 ring-[var(--color-bg-surface)]">
                              +{task.assignees.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Move buttons */}
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-0.5 rounded-[var(--radius-sm)] text-[var(--color-icon-subtle)] hover:bg-[var(--ds-neutral-100)] hover:text-[var(--color-text-default)] transition-colors cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveTask(task, board.columns, -1);
                        }}
                        title="Move left"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        className="p-0.5 rounded-[var(--radius-sm)] text-[var(--color-icon-subtle)] hover:bg-[var(--ds-neutral-100)] hover:text-[var(--color-text-default)] transition-colors cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveTask(task, board.columns, 1);
                        }}
                        title="Move right"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>

                  {typing[task.id]?.length > 0 && (
                    <p className="mt-1.5 text-[var(--font-size-xs)] italic text-[var(--color-text-subtlest)]">
                      someone is commenting…
                    </p>
                  )}
                </div>
              ))}
            </div>

            <NewTaskForm boardId={boardId} columnId={column.id} />
          </div>
        ))}
      </div>

      {/* Task detail panel */}
      {selectedTaskId && (
        <TaskPanel
          taskId={selectedTaskId}
          boardId={boardId}
          projectId={board.projectId}
          workspaceId={board.project.workspaceId}
          typingEmails={typing[selectedTaskId] ?? []}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  );
}
