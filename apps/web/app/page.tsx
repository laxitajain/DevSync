import Link from "next/link";
import {
  Zap,
  Users,
  Columns3,
  Shield,
  ArrowRight,
  MessageSquare,
  Globe,
  Bell,
  CheckCircle2,
  Clock,
  LayoutGrid,
} from "lucide-react";

/* ─── Inline Kanban Preview (replaces needing an image) ─────────────── */

function KanbanPreview() {
  const columns = [
    {
      name: "Backlog",
      count: 3,
      tasks: [
        { title: "Audit information architecture", priority: "MEDIUM", assignees: ["M"] },
        { title: "Migrate blog to MDX", priority: "LOW", assignees: [] },
      ],
    },
    {
      name: "In Progress",
      count: 2,
      tasks: [
        { title: "Build component library", priority: "HIGH", assignees: ["M", "A"] },
        { title: "Implement offline cache", priority: "MEDIUM", assignees: ["M"] },
      ],
    },
    {
      name: "Review",
      count: 1,
      tasks: [
        { title: "Ship new homepage", priority: "URGENT", assignees: ["A"] },
      ],
    },
    {
      name: "Done",
      count: 4,
      tasks: [
        { title: "Set up CI pipeline", priority: "HIGH", assignees: ["A"] },
      ],
    },
  ];

  const priorityDot: Record<string, string> = {
    LOW: "bg-[var(--ds-neutral-400)]",
    MEDIUM: "bg-[var(--ds-blue-600)]",
    HIGH: "bg-[var(--ds-yellow-600)]",
    URGENT: "bg-[var(--ds-red-600)]",
  };

  const avatarColors = [
    "bg-[var(--ds-blue-600)]",
    "bg-[var(--ds-purple-600)]",
    "bg-[var(--ds-green-600)]",
  ];

  return (
    <div className="flex gap-2.5 overflow-hidden px-1 py-1">
      {columns.map((col) => (
        <div key={col.name} className="w-[200px] shrink-0 rounded-[var(--radius-lg)] bg-[var(--ds-neutral-100)] p-2">
          <div className="flex items-center justify-between px-1 py-1">
            <span className="text-[10px] font-semibold text-[var(--color-text-subtle)] uppercase tracking-wider">
              {col.name}
            </span>
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--ds-neutral-200)] px-1 text-[9px] font-medium text-[var(--color-text-subtle)]">
              {col.count}
            </span>
          </div>
          <div className="mt-1 space-y-1.5">
            {col.tasks.map((task) => (
              <div
                key={task.title}
                className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-white p-2"
              >
                <p className="text-[11px] font-medium text-[var(--color-text-default)] leading-snug">
                  {task.title}
                </p>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className={`h-1.5 w-1.5 rounded-full ${priorityDot[task.priority]}`} />
                  <div className="flex -space-x-1">
                    {task.assignees.map((a, i) => (
                      <span
                        key={i}
                        className={`flex h-4 w-4 items-center justify-center rounded-full text-[7px] font-bold text-white ring-1 ring-white ${avatarColors[i % avatarColors.length]}`}
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Feature Card ──────────────────────────────────────────────────── */

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-6 transition-shadow hover:shadow-[var(--shadow-card-hover)]">
      <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--ds-blue-50)] text-[var(--ds-blue-700)] mb-4 transition-colors group-hover:bg-[var(--ds-blue-700)] group-hover:text-white">
        {icon}
      </div>
      <h3 className="text-[var(--font-size-lg)] font-semibold text-[var(--color-text-default)]">
        {title}
      </h3>
      <p className="mt-2 text-[var(--font-size-base)] text-[var(--color-text-subtle)] leading-relaxed">
        {description}
      </p>
    </div>
  );
}

/* ─── Step Card ─────────────────────────────────────────────────────── */

function StepCard({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--ds-blue-700)] text-white text-[var(--font-size-lg)] font-bold mb-4">
        {number}
      </div>
      <h3 className="text-[var(--font-size-lg)] font-semibold text-[var(--color-text-default)]">
        {title}
      </h3>
      <p className="mt-2 text-[var(--font-size-base)] text-[var(--color-text-subtle)] max-w-xs mx-auto leading-relaxed">
        {description}
      </p>
    </div>
  );
}

/* ─── Stat ──────────────────────────────────────────────────────────── */

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-[2rem] font-bold text-[var(--ds-blue-700)]">{value}</p>
      <p className="mt-1 text-[var(--font-size-md)] text-[var(--color-text-subtle)]">{label}</p>
    </div>
  );
}

/* ─── Main Landing Page ─────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-[var(--color-bg-body)]">
      {/* ── Navigation ─────────────────────────────────────────── */}
      <nav className="sticky top-0 z-[var(--z-sticky)] border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 h-14">
          <Link href="/" className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="DevSync Logo"
              className="h-8 w-8 object-contain"
            />
            <span className="text-[var(--font-size-lg)] font-bold text-[var(--color-text-default)]">
              DevSync
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-[var(--font-size-md)] font-medium text-[var(--color-text-subtle)] hover:text-[var(--color-text-default)] transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-[var(--font-size-md)] font-medium text-[var(--color-text-subtle)] hover:text-[var(--color-text-default)] transition-colors">
              How it works
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-[var(--font-size-md)] font-medium text-[var(--color-text-subtle)] hover:text-[var(--color-text-default)] transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center h-8 px-4 rounded-[var(--radius-md)] bg-[var(--ds-blue-700)] text-white text-[var(--font-size-md)] font-medium hover:bg-[var(--ds-blue-800)] transition-colors"
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="mx-auto max-w-6xl px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--ds-blue-200)] bg-[var(--ds-blue-50)] px-3.5 py-1 mb-6">
            <span className="flex h-2 w-2 rounded-full bg-[var(--ds-blue-600)] animate-pulse" />
            <span className="text-[var(--font-size-sm)] font-medium text-[var(--ds-blue-700)]">
              Gather. Stash. Sync in real-time.
            </span>
          </div>

          <h1
            className="mx-auto max-w-3xl text-[clamp(2.25rem,5vw,3.75rem)] font-bold text-[var(--color-text-default)] leading-[1.1] tracking-tight"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            Project management that keeps your team in sync
          </h1>

          <p
            className="mx-auto mt-5 max-w-2xl text-[var(--font-size-lg)] text-[var(--color-text-subtle)] leading-relaxed"
            style={{ textWrap: "pretty" } as React.CSSProperties}
          >
            A friendly, high-performance Kanban and live presence tool designed
            to help engineering teams stash, track, and ship tasks without the bloat.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-[var(--radius-md)] bg-[var(--ds-blue-700)] text-white text-[var(--font-size-base)] font-semibold hover:bg-[var(--ds-blue-800)] transition-colors shadow-[var(--shadow-raised)]"
            >
              Start gathering free
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-default)] text-[var(--font-size-base)] font-semibold hover:bg-[var(--ds-neutral-50)] transition-colors"
            >
              Sign in to your workspace
            </Link>
          </div>

          {/* Product preview */}
          <div className="mt-14 mx-auto max-w-4xl rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] shadow-[var(--shadow-overlay)] overflow-hidden">
            {/* Fake browser chrome */}
            <div className="flex items-center gap-2 border-b border-[var(--color-border-default)] bg-[var(--ds-neutral-50)] px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--ds-red-500)]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--ds-yellow-500)]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--ds-green-500)]" />
              <span className="ml-3 flex-1 rounded-[var(--radius-sm)] bg-[var(--ds-neutral-100)] px-3 py-1 text-[10px] text-[var(--color-text-subtlest)] font-mono">
                app.devsync.dev/boards/main
              </span>
            </div>
            <div className="flex">
              {/* Fake sidebar */}
              <div className="hidden md:block w-[180px] shrink-0 border-r border-[var(--color-border-default)] bg-[var(--ds-neutral-100)] p-3">
                <div className="flex items-center gap-2 px-1.5 py-1.5 mb-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--ds-blue-700)] text-white text-[8px] font-bold">
                    A
                  </span>
                  <span className="text-[11px] font-semibold text-[var(--color-text-default)]">
                    Acme Inc
                  </span>
                </div>
                {[
                  { label: "Dashboard", active: false },
                  { label: "Projects", active: true },
                  { label: "Members", active: false },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`rounded-[var(--radius-sm)] px-2 py-1 mb-0.5 text-[10px] font-medium ${
                      item.active
                        ? "bg-[var(--ds-blue-50)] text-[var(--ds-blue-700)]"
                        : "text-[var(--color-text-subtle)]"
                    }`}
                  >
                    {item.label}
                  </div>
                ))}
              </div>
              {/* Fake board */}
              <div className="flex-1 p-4 overflow-x-auto">
                <KanbanPreview />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Grid ──────────────────────────────────────── */}
      <section id="features" className="py-20 bg-[var(--color-bg-surface)]">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-12">
            <h2
              className="text-[clamp(1.5rem,3vw,2.25rem)] font-bold text-[var(--color-text-default)] tracking-tight"
              style={{ textWrap: "balance" } as React.CSSProperties}
            >
              Everything you need to ship
            </h2>
            <p className="mt-3 text-[var(--font-size-lg)] text-[var(--color-text-subtle)] max-w-xl mx-auto">
              Built for engineering teams who value speed and clarity.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<Columns3 size={20} />}
              title="Kanban Boards"
              description="Drag tasks across columns, set priorities, assign teammates. The board updates for everyone in real time."
            />
            <FeatureCard
              icon={<Users size={20} />}
              title="Live Presence"
              description="See who's online in your workspace right now. Green dots, real-time cursors, no guessing."
            />
            <FeatureCard
              icon={<MessageSquare size={20} />}
              title="Threaded Comments"
              description="Discuss tasks inline with typing indicators. Context stays with the work, not lost in chat."
            />
            <FeatureCard
              icon={<Shield size={20} />}
              title="Role-Based Access"
              description="Owner, Admin, Member, Viewer — fine-grained permissions so the right people see the right things."
            />
            <FeatureCard
              icon={<Globe size={20} />}
              title="Workspace Isolation"
              description="Each workspace is a clean boundary. Separate teams, separate projects, zero cross-talk."
            />
            <FeatureCard
              icon={<Bell size={20} />}
              title="Instant Notifications"
              description="Get notified when you're assigned, mentioned, or when a task you're watching moves. WebSocket-powered."
            />
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────── */}
      <section id="how-it-works" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-14">
            <h2
              className="text-[clamp(1.5rem,3vw,2.25rem)] font-bold text-[var(--color-text-default)] tracking-tight"
              style={{ textWrap: "balance" } as React.CSSProperties}
            >
              Up and running in minutes
            </h2>
            <p className="mt-3 text-[var(--font-size-lg)] text-[var(--color-text-subtle)] max-w-xl mx-auto">
              No lengthy onboarding. No enterprise sales calls.
            </p>
          </div>

          <div className="grid gap-10 md:grid-cols-3">
            <StepCard
              number={1}
              title="Create a workspace"
              description="Sign up, name your workspace, and you're in. It takes about 30 seconds."
            />
            <StepCard
              number={2}
              title="Invite your team"
              description="Send invite links to your teammates. They join with one click."
            />
            <StepCard
              number={3}
              title="Start shipping"
              description="Create projects, set up boards, and start moving tasks. Everything syncs live."
            />
          </div>
        </div>
      </section>

      {/* ── Stats Bar ──────────────────────────────────────────── */}
      <section className="py-14 bg-[var(--color-bg-surface)] border-y border-[var(--color-border-default)]">
        <div className="mx-auto max-w-4xl px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          <Stat value="< 50ms" label="Real-time latency" />
          <Stat value="∞" label="Boards & projects" />
          <Stat value="4" label="Permission levels" />
          <Stat value="100%" label="Open source" />
        </div>
      </section>

      {/* ── Built With ─────────────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-10">
            <h2 className="text-[var(--font-size-xl)] font-semibold text-[var(--color-text-default)]">
              Built on a modern stack
            </h2>
            <p className="mt-2 text-[var(--font-size-base)] text-[var(--color-text-subtle)]">
              The tools you already know and trust.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {[
              "Next.js",
              "NestJS",
              "Prisma",
              "PostgreSQL",
              "Socket.io",
              "Redis",
              "TypeScript",
              "Tailwind CSS",
            ].map((tech) => (
              <span
                key={tech}
                className="text-[var(--font-size-base)] font-medium text-[var(--color-text-subtlest)]"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────── */}
      <section className="py-20 bg-[var(--ds-blue-700)]">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2
            className="text-[clamp(1.5rem,3vw,2.25rem)] font-bold text-white tracking-tight"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            Ready to keep your team in sync?
          </h2>
          <p className="mt-4 text-[var(--font-size-lg)] text-[var(--ds-blue-200)] max-w-lg mx-auto leading-relaxed">
            Create your workspace in 30 seconds. No credit card, no BS.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-[var(--radius-md)] bg-white text-[var(--ds-blue-700)] text-[var(--font-size-base)] font-semibold hover:bg-[var(--ds-blue-50)] transition-colors"
            >
              Get started free
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center h-11 px-6 rounded-[var(--radius-md)] border border-[var(--ds-blue-500)] text-white text-[var(--font-size-base)] font-semibold hover:bg-[var(--ds-blue-800)] transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <img
                src="/logo.png"
                alt="DevSync Logo"
                className="h-6 w-6 object-contain"
              />
              <span className="text-[var(--font-size-md)] font-semibold text-[var(--color-text-default)]">
                DevSync
              </span>
            </div>

            <div className="flex items-center gap-6">
              <a href="#features" className="text-[var(--font-size-sm)] text-[var(--color-text-subtle)] hover:text-[var(--color-text-default)] transition-colors">
                Features
              </a>
              <a href="#how-it-works" className="text-[var(--font-size-sm)] text-[var(--color-text-subtle)] hover:text-[var(--color-text-default)] transition-colors">
                How it works
              </a>
              <Link href="/login" className="text-[var(--font-size-sm)] text-[var(--color-text-subtle)] hover:text-[var(--color-text-default)] transition-colors">
                Sign in
              </Link>
              <Link href="/register" className="text-[var(--font-size-sm)] text-[var(--color-text-subtle)] hover:text-[var(--color-text-default)] transition-colors">
                Get started
              </Link>
            </div>

            <p className="text-[var(--font-size-xs)] text-[var(--color-text-subtlest)]">
              © {new Date().getFullYear()} DevSync. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
