import { clsx } from "./clsx";

/* ─── Button ────────────────────────────────────────────────────────── */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  const base = [
    "inline-flex items-center justify-center gap-1.5",
    "font-medium whitespace-nowrap",
    "transition-colors",
    "disabled:opacity-40 disabled:cursor-not-allowed",
    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-border-focused)]",
    "cursor-pointer",
  ].join(" ");

  const sizes: Record<string, string> = {
    sm: "h-7 px-2.5 text-[var(--font-size-sm)] rounded-[var(--radius-sm)]",
    md: "h-8 px-3 text-[var(--font-size-md)] rounded-[var(--radius-md)]",
  };

  const variants: Record<string, string> = {
    primary: [
      "bg-[var(--color-bg-brand)] text-[var(--color-text-inverse)]",
      "hover:bg-[var(--color-bg-brand-hover)]",
      "active:bg-[var(--ds-blue-900)]",
    ].join(" "),
    secondary: [
      "bg-[var(--color-bg-surface)] text-[var(--color-text-default)]",
      "border border-[var(--color-border-default)]",
      "hover:bg-[var(--color-bg-input-hover)]",
      "active:bg-[var(--ds-neutral-200)]",
    ].join(" "),
    danger: [
      "bg-[var(--color-bg-danger)] text-[var(--color-text-inverse)]",
      "hover:bg-[var(--color-bg-danger-hover)]",
    ].join(" "),
    ghost: [
      "text-[var(--color-text-subtle)]",
      "hover:bg-[var(--ds-neutral-100)] hover:text-[var(--color-text-default)]",
      "active:bg-[var(--ds-neutral-200)]",
    ].join(" "),
  };

  return (
    <button
      className={clsx(base, sizes[size], variants[variant], className)}
      {...props}
    />
  );
}

/* ─── Input ─────────────────────────────────────────────────────────── */

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "w-full h-8 rounded-[var(--radius-md)]",
        "border border-[var(--color-border-input)] bg-[var(--color-bg-input)]",
        "px-2.5 text-[var(--font-size-base)] text-[var(--color-text-default)]",
        "placeholder:text-[var(--color-text-subtlest)]",
        "hover:bg-[var(--color-bg-input-hover)]",
        "focus:border-[var(--color-border-focused)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-focused)]",
        "transition-colors",
        className
      )}
      {...props}
    />
  );
}

/* ─── Textarea ──────────────────────────────────────────────────────── */

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={clsx(
        "w-full rounded-[var(--radius-md)]",
        "border border-[var(--color-border-input)] bg-[var(--color-bg-input)]",
        "px-2.5 py-1.5 text-[var(--font-size-base)] text-[var(--color-text-default)]",
        "placeholder:text-[var(--color-text-subtlest)]",
        "hover:bg-[var(--color-bg-input-hover)]",
        "focus:border-[var(--color-border-focused)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-focused)]",
        "transition-colors resize-y",
        className
      )}
      {...props}
    />
  );
}

/* ─── Select ────────────────────────────────────────────────────────── */

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={clsx(
        "h-8 rounded-[var(--radius-md)]",
        "border border-[var(--color-border-input)] bg-[var(--color-bg-input)]",
        "px-2 text-[var(--font-size-md)] text-[var(--color-text-default)]",
        "hover:bg-[var(--color-bg-input-hover)]",
        "focus:border-[var(--color-border-focused)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-focused)]",
        "transition-colors cursor-pointer",
        className
      )}
      {...props}
    />
  );
}

/* ─── Card ──────────────────────────────────────────────────────────── */

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]",
        className
      )}
      {...props}
    />
  );
}

/* ─── Priority Badge ────────────────────────────────────────────────── */

const priorityConfig: Record<string, { dot: string; bg: string; text: string }> = {
  LOW: {
    dot: "bg-[var(--ds-neutral-400)]",
    bg: "bg-[var(--ds-neutral-100)]",
    text: "text-[var(--ds-neutral-600)]",
  },
  MEDIUM: {
    dot: "bg-[var(--ds-blue-600)]",
    bg: "bg-[var(--ds-blue-50)]",
    text: "text-[var(--ds-blue-700)]",
  },
  HIGH: {
    dot: "bg-[var(--ds-yellow-600)]",
    bg: "bg-[var(--ds-yellow-50)]",
    text: "text-[var(--ds-yellow-700)]",
  },
  URGENT: {
    dot: "bg-[var(--ds-red-600)]",
    bg: "bg-[var(--ds-red-50)]",
    text: "text-[var(--ds-red-700)]",
  },
};

export function PriorityBadge({ priority }: { priority: string }) {
  const config = priorityConfig[priority] ?? priorityConfig.MEDIUM;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-1.5 py-0.5",
        "text-[var(--font-size-xs)] font-medium uppercase tracking-wide",
        config.bg,
        config.text
      )}
    >
      <span className={clsx("h-1.5 w-1.5 rounded-full", config.dot)} />
      {priority}
    </span>
  );
}

/* ─── Avatar ────────────────────────────────────────────────────────── */

const avatarColors = [
  "bg-[var(--ds-blue-600)]",
  "bg-[var(--ds-purple-600)]",
  "bg-[var(--ds-green-600)]",
  "bg-[var(--ds-red-600)]",
  "bg-[var(--ds-yellow-700)]",
  "bg-[var(--ds-neutral-600)]",
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export function Avatar({
  name,
  email,
  size = "sm",
}: {
  name: string | null;
  email: string;
  size?: "sm" | "md";
}) {
  const label = (name ?? email).trim();
  const initials = label
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const colorIndex = hashString(email) % avatarColors.length;
  const colorClass = avatarColors[colorIndex];

  const sizeClasses: Record<string, string> = {
    sm: "h-6 w-6 text-[10px]",
    md: "h-8 w-8 text-[var(--font-size-xs)]",
  };

  return (
    <span
      title={email}
      className={clsx(
        "inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0",
        colorClass,
        sizeClasses[size]
      )}
    >
      {initials || email[0]?.toUpperCase()}
    </span>
  );
}

/* ─── Label ─────────────────────────────────────────────────────────── */

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={clsx(
        "block text-[var(--font-size-sm)] font-medium text-[var(--color-text-subtle)] mb-1",
        className
      )}
      {...props}
    />
  );
}

/* ─── Spinner ───────────────────────────────────────────────────────── */

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={clsx("animate-spin h-4 w-4 text-[var(--color-text-subtlest)]", className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

/* ─── Empty State ───────────────────────────────────────────────────── */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && (
        <div className="mb-3 text-[var(--color-icon-subtle)]">{icon}</div>
      )}
      <p className="text-[var(--font-size-base)] font-medium text-[var(--color-text-default)]">
        {title}
      </p>
      {description && (
        <p className="mt-1 text-[var(--font-size-md)] text-[var(--color-text-subtlest)] max-w-xs">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
