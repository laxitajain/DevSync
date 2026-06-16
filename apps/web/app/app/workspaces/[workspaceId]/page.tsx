"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FolderKanban, Plus, ArrowRight, Users } from "lucide-react";
import {
  useCreateProject,
  useProjects,
  useWorkspace
} from "../../../../lib/query/hooks";
import { useWorkspacePresence } from "../../../../lib/realtime/use-realtime";
import { ApiError } from "../../../../lib/api/client";
import { Button, Card, Input, Label, Spinner, EmptyState } from "../../../../components/ui";

export default function WorkspacePage() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params.workspaceId;
  const { data: workspace } = useWorkspace(workspaceId);
  const { data: projects, isLoading } = useProjects(workspaceId);
  const createProject = useCreateProject(workspaceId);
  const onlineUserIds = useWorkspacePresence(workspaceId);

  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createProject.mutateAsync({ name: name.trim(), key: key.trim().toUpperCase() });
      setName("");
      setKey("");
      setShowForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create project");
    }
  }

  const onlineCount = onlineUserIds.length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[var(--font-size-2xl)] font-semibold text-[var(--color-text-default)]">
            {workspace?.name ?? "Workspace"}
          </h1>
          <div className="mt-1 flex items-center gap-3">
            {onlineCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[var(--font-size-sm)] text-[var(--color-text-subtle)]">
                <span className="h-2 w-2 rounded-full bg-[var(--ds-green-600)]" />
                {onlineCount} online
              </span>
            )}
            <span className="text-[var(--font-size-sm)] text-[var(--color-text-subtlest)]">
              {projects?.length ?? 0} project{(projects?.length ?? 0) !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/app/workspaces/${workspaceId}/members`}>
            <Button variant="secondary" size="sm">
              <Users size={14} />
              Members
            </Button>
          </Link>
          {!showForm && (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus size={14} />
              New project
            </Button>
          )}
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="p-4">
          <form className="flex items-end gap-3" onSubmit={onCreate}>
            <div className="flex-1">
              <Label htmlFor="proj-name">Project name</Label>
              <Input
                id="proj-name"
                value={name}
                required
                minLength={2}
                onChange={(e) => setName(e.target.value)}
                placeholder="Engineering"
                autoFocus
              />
            </div>
            <div className="w-24">
              <Label htmlFor="proj-key">Key</Label>
              <Input
                id="proj-key"
                value={key}
                required
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                placeholder="ENG"
              />
            </div>
            <Button type="submit" disabled={createProject.isPending}>
              {createProject.isPending ? "Creating…" : "Create"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowForm(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </form>
          {error && (
            <p className="mt-2 text-[var(--font-size-sm)] text-[var(--color-text-danger)]">
              {error}
            </p>
          )}
        </Card>
      )}

      {/* Project list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-5 w-5" />
        </div>
      ) : projects && projects.length > 0 ? (
        <div className="space-y-1">
          {projects.map((project) => {
            const board = project.boards[0];
            const wrapper = (children: React.ReactNode) =>
              board ? (
                <Link key={project.id} href={`/app/boards/${board.id}`}>
                  {children}
                </Link>
              ) : (
                <div key={project.id}>{children}</div>
              );

            return wrapper(
              <div className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 transition-colors hover:bg-[var(--color-bg-surface-sunken)] group cursor-pointer">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--ds-neutral-800)] text-white text-[var(--font-size-xs)] font-bold">
                  {project.key}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[var(--font-size-base)] font-medium text-[var(--color-text-default)]">
                    {project.name}
                  </p>
                  {project.description && (
                    <p className="text-[var(--font-size-sm)] text-[var(--color-text-subtlest)] truncate">
                      {project.description}
                    </p>
                  )}
                </div>
                {board ? (
                  <span className="flex items-center gap-1 text-[var(--font-size-sm)] text-[var(--color-text-brand)] opacity-0 group-hover:opacity-100 transition-opacity">
                    Open board
                    <ArrowRight size={12} />
                  </span>
                ) : (
                  <span className="text-[var(--font-size-xs)] text-[var(--color-text-subtlest)]">
                    No board
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<FolderKanban size={32} />}
          title="No projects yet"
          description="Create a project to start tracking work."
          action={
            !showForm ? (
              <Button size="sm" onClick={() => setShowForm(true)}>
                <Plus size={14} />
                Create project
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
