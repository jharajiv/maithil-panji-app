/** only ever follow in-site paths after sign-in (shared by the browser and the server) */
export const safeNextPath = (n: string | null | undefined, fallback = "/app") => (n && /^\/(?!\/)[\w\-./?=&%]*$/.test(n) ? n : fallback);
