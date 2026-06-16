"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Trash2 } from "lucide-react";
import {
  useAddComment,
  useDeleteTask,
  useTask,
  useUpdateTask,
  useWorkspace
} from "../lib/query/hooks";
import { useSocket } from "../lib/realtime/socket-provider";
import { Avatar, Button, Card, Input, Label, PriorityBadge, Select, Spinner, Textarea } from "./ui";
import type { TaskPriority } from "../lib/types";

const PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TaskPanel({
  taskId,
  boardId,
  projectId,
  workspaceId,
  typingEmails,
  onClose
}: {
  taskId: string;
  boardId: string;
  projectId?: string;
  workspaceId?: string;
  typingEmails: string[];
  onClose: () => void;
}) {
  const { data: task, isLoading } = useTask(taskId);
  const { data: workspace } = useWorkspace(workspaceId ?? "");
  const updateTask = useUpdateTask(boardId);
  const deleteTask = useDeleteTask(boardId);
  const addComment = useAddComment(taskId);
  const socket = useSocket();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [comment, setComment] = useState("");
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
    }
  }, [task?.id, task]);

  const assigneeIds = useMemo(
    () => new Set(task?.assignees.map((a) => a.userId) ?? []),
    [task]
  );

  function saveField(body: Parameters<typeof updateTask.mutate>[0]["body"]) {
    updateTask.mutate({ taskId, body });
  }

  function emitTyping(isTyping: boolean) {
    if (socket && projectId) {
      socket.emit("comment:typing", { projectId, taskId, isTyping });
    }
  }

  function onCommentChange(value: string) {
    setComment(value);
    emitTyping(true);
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }
    typingTimeout.current = setTimeout(() => emitTyping(false), 1500);
  }

  async function submitComment(event: React.FormEvent) {
    event.preventDefault();
    const body = comment.trim();
    if (!body) return;
    await addComment.mutateAsync(body);
    setComment("");
    emitTyping(false);
  }

  function toggleAssignee(userId: string) {
    const next = new Set(assigneeIds);
    if (next.has(userId)) {
      next.delete(userId);
    } else {
      next.add(userId);
    }
    saveField({ assigneeIds: [...next] });
  }

  return (
    <div
      className="fixed inset-0 z-[var(--z-overlay-backdrop)] flex justify-end bg-[var(--ds-neutral-900)]/25"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-md flex-col bg-[var(--color-bg-surface)] shadow-[var(--shadow-overlay)] animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: "slideInRight var(--duration-slow) var(--ease-out) forwards",
        }}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border-default)] px-4 py-3">
          <h2 className="text-[var(--font-size-md)] font-semibold text-[var(--color-text-subtle)]">
            Task details
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-[var(--radius-sm)] text-[var(--color-icon-subtle)] hover:bg-[var(--ds-neutral-100)] hover:text-[var(--color-text-default)] transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {isLoading || !task ? (
          <div className="flex items-center justify-center flex-1">
            <Spinner className="h-5 w-5" />
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
            {/* Title */}
            <div>
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() =>
                  title.trim() &&
                  title !== task.title &&
                  saveField({ title: title.trim() })
                }
              />
            </div>

            {/* Description */}
            <div>
              <Label>Description</Label>
              <Textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() =>
                  description !== (task.description ?? "") &&
                  saveField({ description })
                }
                placeholder="Add more detail…"
              />
            </div>

            {/* Priority */}
            <div className="flex items-center gap-4">
              <div>
                <Label>Priority</Label>
                <Select
                  value={task.priority}
                  onChange={(e) =>
                    saveField({ priority: e.target.value as TaskPriority })
                  }
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="pt-5">
                <PriorityBadge priority={task.priority} />
              </div>
            </div>

            {/* Assignees */}
            <div>
              <Label>Assignees</Label>
              <div className="flex flex-wrap gap-1.5">
                {workspace?.members.map((member) => {
                  const active = assigneeIds.has(member.userId);
                  return (
                    <button
                      key={member.userId}
                      onClick={() => toggleAssignee(member.userId)}
                      className={`flex items-center gap-1.5 rounded-[var(--radius-full)] border px-2 py-1 text-[var(--font-size-xs)] transition-colors cursor-pointer ${
                        active
                          ? "border-[var(--color-border-brand)] bg-[var(--ds-blue-50)] text-[var(--color-text-brand)]"
                          : "border-[var(--color-border-default)] text-[var(--color-text-subtle)] hover:bg-[var(--ds-neutral-50)]"
                      }`}
                    >
                      <Avatar name={member.user.name} email={member.user.email} size="sm" />
                      {member.user.name ?? member.user.email}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comments */}
            <div className="flex-1">
              <Label>Comments</Label>
              <div className="space-y-2.5">
                {task.comments.length === 0 && (
                  <p className="text-[var(--font-size-md)] text-[var(--color-text-subtlest)] py-2">
                    No comments yet.
                  </p>
                )}
                {task.comments.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] p-3"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar
                        name={c.author?.name ?? null}
                        email={c.author?.email ?? "?"}
                        size="sm"
                      />
                      <span className="text-[var(--font-size-md)] font-medium text-[var(--color-text-default)]">
                        {c.author?.name ?? c.author?.email ?? "Unknown"}
                      </span>
                      <span className="text-[var(--font-size-xs)] text-[var(--color-text-subtlest)]">
                        {formatTime(c.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-[var(--font-size-md)] text-[var(--color-text-default)] leading-relaxed">
                      {c.body}
                    </p>
                  </div>
                ))}
              </div>

              {typingEmails.length > 0 && (
                <p className="mt-2 text-[var(--font-size-xs)] italic text-[var(--color-text-subtlest)]">
                  {typingEmails.join(", ")} typing…
                </p>
              )}

              <form className="mt-3 space-y-2" onSubmit={submitComment}>
                <Textarea
                  rows={2}
                  value={comment}
                  onChange={(e) => onCommentChange(e.target.value)}
                  placeholder="Write a comment…"
                />
                <Button type="submit" size="sm" disabled={addComment.isPending}>
                  {addComment.isPending ? "Posting…" : "Comment"}
                </Button>
              </form>
            </div>

            {/* Delete */}
            <div className="border-t border-[var(--color-border-default)] pt-4">
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  deleteTask.mutate(taskId);
                  onClose();
                }}
              >
                <Trash2 size={14} />
                Delete task
              </Button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
