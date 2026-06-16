"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi } from "../lib/api/endpoints";
import { ApiError } from "../lib/api/client";
import { useAuthStore } from "../lib/store/auth-store";
import { Button, Card, Input, Label, Spinner } from "./ui";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const session = isRegister
        ? await authApi.register({ email, password, name: name || undefined })
        : await authApi.login({ email, password });
      setSession(session);
      router.replace("/app");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 bg-[var(--color-bg-body)]">
      <div className="w-full max-w-sm">
        {/* Brand mark */}
        <div className="mb-6 text-center">
          <div className="inline-flex mb-3">
            <img
              src="/logo.png"
              alt="DevSync Logo"
              className="h-12 w-12 object-contain"
            />
          </div>
          <h1 className="text-[var(--font-size-xl)] font-semibold text-[var(--color-text-default)]">
            {isRegister ? "Create your account" : "Sign in to DevSync"}
          </h1>
          <p className="mt-1 text-[var(--font-size-md)] text-[var(--color-text-subtle)]">
            {isRegister
              ? "Start collaborating in minutes."
              : "Enter your credentials to continue."}
          </p>
        </div>

        <Card className="p-5">
          <form className="space-y-4" onSubmit={onSubmit}>
            {isRegister && (
              <div>
                <Label htmlFor="auth-name">Name</Label>
                <Input
                  id="auth-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ada Lovelace"
                />
              </div>
            )}
            <div>
              <Label htmlFor="auth-email">Email</Label>
              <Input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <Label htmlFor="auth-password">Password</Label>
              <Input
                id="auth-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>

            {error && (
              <div className="rounded-[var(--radius-md)] bg-[var(--ds-red-50)] px-3 py-2 text-[var(--font-size-sm)] text-[var(--color-text-danger)]">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Spinner />
                  Please wait…
                </>
              ) : isRegister ? (
                "Create account"
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        </Card>

        <p className="mt-4 text-center text-[var(--font-size-md)] text-[var(--color-text-subtle)]">
          {isRegister ? (
            <>
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-[var(--color-text-brand)] hover:underline"
              >
                Sign in
              </Link>
            </>
          ) : (
            <>
              New to DevSync?{" "}
              <Link
                href="/register"
                className="font-medium text-[var(--color-text-brand)] hover:underline"
              >
                Create an account
              </Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
