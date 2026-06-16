"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { workspacesApi } from "../../../../lib/api/endpoints";
import { ApiError } from "../../../../lib/api/client";
import { queryKeys } from "../../../../lib/query/hooks";
import { Button, Card, Spinner } from "../../../../components/ui";

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"working" | "done" | "error">("working");
  const [message, setMessage] = useState("Accepting your invite…");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const member = await workspacesApi.acceptInvite(params.token);
        if (cancelled) return;
        await queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
        setStatus("done");
        setMessage("You're in! Redirecting…");
        router.replace(member.workspaceId ? `/app/workspaces/${member.workspaceId}` : "/app");
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setMessage(err instanceof ApiError ? err.message : "Could not accept invite");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.token, router, queryClient]);

  return (
    <div className="flex items-center justify-center py-16">
      <Card className="w-full max-w-sm p-8 text-center">
        <div className="flex justify-center mb-4">
          {status === "working" && <Spinner className="h-8 w-8" />}
          {status === "done" && (
            <CheckCircle2 size={32} className="text-[var(--ds-green-600)]" />
          )}
          {status === "error" && (
            <AlertCircle size={32} className="text-[var(--ds-red-600)]" />
          )}
        </div>
        <p
          className={`text-[var(--font-size-base)] font-medium ${
            status === "error"
              ? "text-[var(--color-text-danger)]"
              : "text-[var(--color-text-default)]"
          }`}
        >
          {message}
        </p>
        {status === "error" && (
          <Button className="mt-4" onClick={() => router.replace("/app")}>
            Back to workspaces
          </Button>
        )}
      </Card>
    </div>
  );
}
