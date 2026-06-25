"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { CmsCallMeter } from "@/components/dev/cms-call-meter";

// Local-dev only (statically dropped from deployed builds).
const isDev = process.env.NODE_ENV === "development";

const schema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or username."),
  password: z.string().min(1, "Enter your password."),
});

type LoginValues = z.infer<typeof schema>;

// Shown by LoginGateShell in place of the site when no editor session exists on
// staging. Self-contained: posts credentials to /api/auth/login (which sets the
// httpOnly session cookies), then refreshes so the server gate re-renders the
// site. Does not read Strapi itself, so it works before any token exists.
export function LoginScreen() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit } = useForm<LoginValues>({
    defaultValues: { identifier: "", password: "" },
  });

  const onSubmit = handleSubmit((values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input.");
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        });
        const data = (await res.json().catch(() => null)) as
          | { ok?: boolean; error?: string }
          | null;

        if (res.ok && data?.ok) {
          toast.success("Signed in");
          router.refresh();
          return;
        }

        const message = data?.error ?? "Sign in failed.";
        setError(message);
        toast.error(message);
      } catch {
        const message = "Could not reach the server.";
        setError(message);
        toast.error(message);
      }
    });
  });

  return (
    <>
      {isDev ? (
        <div className="fixed left-4 top-4 z-50">
          <CmsCallMeter />
        </div>
      ) : null}
      <main className="flex min-h-dvh items-center justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-sm rounded-xl border border-border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">Editor sign in</h1>
        <p className="mt-1 text-sm text-muted">
          Log in with your Strapi account to edit this staging site.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label
              htmlFor="identifier"
              className="block text-sm font-medium text-foreground"
            >
              Email
            </label>
            <input
              id="identifier"
              type="email"
              autoComplete="username"
              autoFocus
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm text-foreground focus:border-dark focus:outline-none focus:ring-1 focus:ring-dark"
              {...register("identifier")}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-foreground"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm text-foreground focus:border-dark focus:outline-none focus:ring-1 focus:ring-dark"
              {...register("password")}
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-dark px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
      </main>
    </>
  );
}
