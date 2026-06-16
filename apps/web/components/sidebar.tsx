"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import {
  LayoutGrid,
  FolderKanban,
  Users,
  ChevronDown,
  LogOut,
  Menu,
  X,
  Plus,
} from "lucide-react";
import { authApi } from "../lib/api/endpoints";
import { useWorkspaces, useBoard } from "../lib/query/hooks";
import { useAuthStore } from "../lib/store/auth-store";
import { Avatar, Spinner } from "./ui";

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  match?: (pathname: string) => boolean;
};

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ workspaceId?: string; boardId?: string }>();
  const user = useAuthStore((state) => state.user);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clear = useAuthStore((state) => state.clear);
  const { data: workspaces, isLoading: loadingWorkspaces } = useWorkspaces();
  const { data: board } = useBoard(params?.boardId ?? "");

  const [mobileOpen, setMobileOpen] = useState(false);
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);

  const currentWorkspaceId = params?.workspaceId || board?.project.workspaceId;
  const currentWorkspace = workspaces?.find((w) => w.id === currentWorkspaceId);

  async function logout() {
    if (refreshToken) {
      await authApi.logout(refreshToken).catch(() => undefined);
    }
    clear();
    router.replace("/login");
  }

  const navItems: NavItem[] = [
    {
      label: "Dashboard",
      href: "/app",
      icon: <LayoutGrid size={18} />,
      match: (p) => p === "/app",
    },
  ];

  if (currentWorkspaceId) {
    navItems.push(
      {
        label: "Projects",
        href: `/app/workspaces/${currentWorkspaceId}`,
        icon: <FolderKanban size={18} />,
        match: (p) =>
          p === `/app/workspaces/${currentWorkspaceId}` ||
          p.startsWith("/app/boards/"),
      },
      {
        label: "Members",
        href: `/app/workspaces/${currentWorkspaceId}/members`,
        icon: <Users size={18} />,
        match: (p) => p.includes("/members"),
      }
    );
  }

  function isActive(item: NavItem) {
    return item.match ? item.match(pathname) : pathname === item.href;
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Workspace switcher */}
      <div className="px-3 pt-4 pb-2">
        <button
          onClick={() => setWsDropdownOpen(!wsDropdownOpen)}
          className="w-full flex items-center gap-2.5 rounded-[var(--radius-md)] px-2 py-2 text-left hover:bg-[var(--color-bg-sidebar-hover)] transition-colors cursor-pointer"
        >
          {currentWorkspace ? (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--ds-blue-700)] text-white text-[var(--font-size-sm)] font-bold">
              {currentWorkspace.name[0]?.toUpperCase()}
            </span>
          ) : (
            <img
              src="/logo.png"
              alt="DevSync Logo"
              className="h-8 w-8 shrink-0 object-contain"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[var(--font-size-md)] font-semibold text-[var(--color-text-default)] truncate">
              {currentWorkspace?.name ?? "DevSync"}
            </p>
            {currentWorkspace && (
              <p className="text-[var(--font-size-xs)] text-[var(--color-text-subtlest)] truncate">
                /{currentWorkspace.slug}
              </p>
            )}
          </div>
          <ChevronDown
            size={14}
            className={`text-[var(--color-text-subtlest)] shrink-0 transition-transform ${
              wsDropdownOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Workspace dropdown */}
        {wsDropdownOpen && (
          <div className="mt-1 rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] shadow-[var(--shadow-overlay)] overflow-hidden">
            <div className="px-3 py-2">
              <p className="text-[var(--font-size-xs)] font-medium text-[var(--color-text-subtlest)] uppercase tracking-wider">
                Workspaces
              </p>
            </div>
            {loadingWorkspaces ? (
              <div className="flex items-center justify-center py-3">
                <Spinner />
              </div>
            ) : (
              <div className="py-1">
                {workspaces?.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => {
                      router.push(`/app/workspaces/${ws.id}`);
                      setWsDropdownOpen(false);
                      setMobileOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-[var(--font-size-md)] transition-colors cursor-pointer ${
                      ws.id === currentWorkspaceId
                        ? "bg-[var(--color-bg-sidebar-active)] text-[var(--color-text-sidebar-active)] font-medium"
                        : "text-[var(--color-text-default)] hover:bg-[var(--color-bg-sidebar-hover)]"
                    }`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--ds-blue-700)] text-white text-[10px] font-bold">
                      {ws.name[0]?.toUpperCase()}
                    </span>
                    <span className="truncate">{ws.name}</span>
                    <span className="ml-auto text-[var(--font-size-xs)] text-[var(--color-text-subtlest)]">
                      {ws.role}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="border-t border-[var(--color-border-default)]">
              <button
                onClick={() => {
                  router.push("/app");
                  setWsDropdownOpen(false);
                  setMobileOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[var(--font-size-md)] text-[var(--color-text-subtle)] hover:bg-[var(--color-bg-sidebar-hover)] transition-colors cursor-pointer"
              >
                <Plus size={14} />
                Create workspace
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const active = isActive(item);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-[var(--font-size-md)] font-medium transition-colors ${
                    active
                      ? "bg-[var(--color-bg-sidebar-active)] text-[var(--color-text-sidebar-active)]"
                      : "text-[var(--color-text-sidebar)] hover:bg-[var(--color-bg-sidebar-hover)] hover:text-[var(--color-text-default)]"
                  }`}
                >
                  <span
                    className={
                      active
                        ? "text-[var(--color-text-sidebar-active)]"
                        : "text-[var(--color-icon-default)]"
                    }
                  >
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User section */}
      <div className="border-t border-[var(--color-border-default)] px-3 py-3">
        <div className="flex items-center gap-2.5">
          {user && <Avatar name={user.name} email={user.email} size="md" />}
          <div className="flex-1 min-w-0">
            <p className="text-[var(--font-size-md)] font-medium text-[var(--color-text-default)] truncate">
              {user?.name ?? user?.email}
            </p>
            {user?.name && (
              <p className="text-[var(--font-size-xs)] text-[var(--color-text-subtlest)] truncate">
                {user.email}
              </p>
            )}
          </div>
          <button
            onClick={logout}
            title="Log out"
            className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-icon-subtle)] hover:text-[var(--color-text-default)] hover:bg-[var(--color-bg-sidebar-hover)] transition-colors cursor-pointer"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-[var(--z-sticky)] p-2 rounded-[var(--radius-md)] bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] shadow-[var(--shadow-raised)] text-[var(--color-text-default)] lg:hidden cursor-pointer"
        aria-label="Open navigation"
      >
        <Menu size={18} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[var(--z-overlay-backdrop)] bg-[var(--ds-neutral-900)]/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-[var(--z-overlay)] h-dvh w-[var(--sidebar-width)]
          bg-[var(--color-bg-sidebar)] border-r border-[var(--color-border-default)]
          transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out)]
          lg:static lg:translate-x-0
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Mobile close */}
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-3 right-3 p-1 rounded-[var(--radius-sm)] text-[var(--color-icon-subtle)] hover:text-[var(--color-text-default)] lg:hidden cursor-pointer"
          aria-label="Close navigation"
        >
          <X size={16} />
        </button>

        {sidebarContent}
      </aside>
    </>
  );
}
