export const WORKSPACE_SUMMARY_TTL_SECONDS = 60;
export const WORKSPACE_DASHBOARD_TTL_SECONDS = 30;

export const workspaceSummaryKey = (workspaceId: string) =>
  `ws:summary:${workspaceId}`;

export const workspaceDashboardKey = (workspaceId: string) =>
  `ws:dashboard:${workspaceId}`;

export const workspaceCacheKeys = (workspaceId: string) => [
  workspaceSummaryKey(workspaceId),
  workspaceDashboardKey(workspaceId)
];

