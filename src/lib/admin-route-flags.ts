type EnvLike = Record<string, string | undefined>;

export function isFlagEnabled(name: string, env: EnvLike = process.env) {
  return env[name]?.trim().toLowerCase() === "true";
}

export function isAdminMaintenanceRouteEnabled(env: EnvLike = process.env) {
  return (
    env.NODE_ENV !== "production" ||
    isFlagEnabled("ENABLE_ADMIN_MAINTENANCE_ROUTES", env)
  );
}

export function isAdminDebugRouteEnabled(env: EnvLike = process.env) {
  return (
    env.NODE_ENV !== "production" ||
    isFlagEnabled("ENABLE_ADMIN_DEBUG_ROUTES", env)
  );
}
