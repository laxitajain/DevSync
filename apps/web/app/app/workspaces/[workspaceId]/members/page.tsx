"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CornerDownLeft, UserPlus, Trash2 } from "lucide-react";
import {
  useInviteMember,
  useRemoveMember,
  useUpdateMemberRole,
  useWorkspace
} from "../../../../../lib/query/hooks";
import { ApiError } from "../../../../../lib/api/client";
import { useAuthStore } from "../../../../../lib/store/auth-store";
import { Avatar, Button, Card, Input, Label, Select, Spinner } from "../../../../../components/ui";
import type { Role } from "../../../../../lib/types";

const ROLES: Role[] = ["ADMIN", "MEMBER", "VIEWER"];

export default function MembersPage() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params.workspaceId;
  const currentUser = useAuthStore((state) => state.user);
  const { data: workspace, isLoading } = useWorkspace(workspaceId);
  const invite = useInviteMember(workspaceId);
  const updateRole = useUpdateMemberRole(workspaceId);
  const removeMember = useRemoveMember(workspaceId);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onInvite(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setInviteToken(null);
    try {
      const result = await invite.mutateAsync({ email: email.trim(), role });
      setInviteToken(result.token);
      setEmail("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send invite");
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <Link
          href={`/app/workspaces/${workspaceId}`}
          className="inline-flex items-center gap-1 text-[var(--font-size-sm)] text-[var(--color-text-subtle)] hover:text-[var(--color-text-brand)] transition-colors"
        >
          <CornerDownLeft size={12} className="rotate-90" />
          Back to workspace
        </Link>
        <h1 className="mt-2 text-[var(--font-size-2xl)] font-semibold text-[var(--color-text-default)]">
          Members
        </h1>
      </div>

      {/* Invite form */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <UserPlus size={16} className="text-[var(--color-icon-default)]" />
          <h2 className="text-[var(--font-size-md)] font-semibold text-[var(--color-text-default)]">
            Invite a member
          </h2>
        </div>
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={onInvite}>
          <div className="flex-1">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
            />
          </div>
          <div>
            <Label htmlFor="invite-role">Role</Label>
            <Select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={invite.isPending}>
            {invite.isPending ? "Inviting…" : "Send invite"}
          </Button>
        </form>
        {error && (
          <p className="mt-2 text-[var(--font-size-sm)] text-[var(--color-text-danger)]">
            {error}
          </p>
        )}
        {inviteToken && (
          <div className="mt-3 rounded-[var(--radius-md)] bg-[var(--ds-neutral-50)] border border-[var(--color-border-default)] p-3">
            <p className="text-[var(--font-size-sm)] font-medium text-[var(--color-text-default)] mb-1">
              Invite token
            </p>
            <code className="block break-all text-[var(--font-size-xs)] text-[var(--color-text-subtle)] font-mono bg-[var(--ds-neutral-100)] rounded-[var(--radius-sm)] px-2 py-1">
              {inviteToken}
            </code>
          </div>
        )}
      </Card>

      {/* Members table */}
      <Card className="overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-[var(--color-border-default)] bg-[var(--ds-neutral-50)] px-4 py-2">
          <span className="text-[var(--font-size-xs)] font-semibold text-[var(--color-text-subtlest)] uppercase tracking-wider">
            Member
          </span>
          <span className="text-[var(--font-size-xs)] font-semibold text-[var(--color-text-subtlest)] uppercase tracking-wider">
            Role
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner className="h-5 w-5" />
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border-default)]">
            {workspace?.members.map((member) => {
              const isSelf = member.userId === currentUser?.id;
              const isOwner = member.role === "OWNER";
              return (
                <div
                  key={member.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      name={member.user.name}
                      email={member.user.email}
                      size="md"
                    />
                    <div className="min-w-0">
                      <p className="text-[var(--font-size-base)] font-medium text-[var(--color-text-default)] truncate">
                        {member.user.name ?? member.user.email}
                        {isSelf && (
                          <span className="ml-1.5 text-[var(--font-size-xs)] font-normal text-[var(--color-text-subtlest)]">
                            (you)
                          </span>
                        )}
                      </p>
                      <p className="text-[var(--font-size-sm)] text-[var(--color-text-subtlest)] truncate">
                        {member.user.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isOwner || isSelf ? (
                      <span className="rounded-[var(--radius-sm)] bg-[var(--ds-neutral-100)] px-2 py-1 text-[var(--font-size-xs)] font-medium text-[var(--color-text-subtle)]">
                        {member.role}
                      </span>
                    ) : (
                      <>
                        <Select
                          value={member.role}
                          onChange={(e) =>
                            updateRole.mutate({
                              memberId: member.id,
                              role: e.target.value as Role
                            })
                          }
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </Select>
                        <button
                          onClick={() => removeMember.mutate(member.id)}
                          className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-icon-subtle)] hover:bg-[var(--ds-red-50)] hover:text-[var(--color-text-danger)] transition-colors cursor-pointer"
                          title="Remove member"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
