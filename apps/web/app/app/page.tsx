"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";
import { useCreateWorkspace, useWorkspaces } from "../../lib/query/hooks";
import { ApiError } from "../../lib/api/client";
import { Button, Card, Input, Label, Spinner, EmptyState } from "../../components/ui";

export default function DashboardPage() {
  const { data: workspaces, isLoading } = useWorkspaces();
  const createWorkspace = useCreateWorkspace();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createWorkspace.mutateAsync(name.trim());
      setName("");
      setShowForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create workspace");
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[var(--font-size-2xl)] font-semibold text-[var(--color-text-default)]">
            Workspaces
          </h1>
          <p className="mt-0.5 text-[var(--font-size-md)] text-[var(--color-text-subtle)]">
            Each workspace is an isolated team space with its own projects and members.
          </p>
        </div>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus size={14} />
            New workspace
          </Button>
        )}
      </div>

      {/* Create form — collapsible */}
      {showForm && (
        <Card className="p-4">
          <form className="flex items-end gap-3" onSubmit={onCreate}>
            <div className="flex-1">
              <Label htmlFor="ws-name">Workspace name</Label>
              <Input
                id="ws-name"
                value={name}
                required
                minLength={2}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Inc"
                autoFocus
              />
            </div>
            <Button type="submit" disabled={createWorkspace.isPending}>
              {createWorkspace.isPending ? "Creating…" : "Create"}
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

      {/* Workspace list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-5 w-5" />
        </div>
      ) : workspaces && workspaces.length > 0 ? (
        <div className="space-y-1">
          {workspaces.map((workspace) => (
            <Link key={workspace.id} href={`/app/workspaces/${workspace.id}`}>
              <div className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 transition-colors hover:bg-[var(--color-bg-surface-sunken)] group">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--ds-blue-700)] text-white text-[var(--font-size-sm)] font-bold">
                  {workspace.name[0]?.toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[var(--font-size-base)] font-medium text-[var(--color-text-default)]">
                    {workspace.name}
                  </p>
                  <p className="text-[var(--font-size-xs)] text-[var(--color-text-subtlest)]">
                    /{workspace.slug}
                  </p>
                </div>
                <span className="rounded-[var(--radius-sm)] bg-[var(--ds-neutral-100)] px-2 py-0.5 text-[var(--font-size-xs)] font-medium text-[var(--color-text-subtle)]">
                  {workspace.role}
                </span>
                <ArrowRight
                  size={14}
                  className="text-[var(--color-text-subtlest)] opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No workspaces yet"
          description="Create your first workspace to start organizing your projects."
          action={
            !showForm ? (
              <Button size="sm" onClick={() => setShowForm(true)}>
                <Plus size={14} />
                Create workspace
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
