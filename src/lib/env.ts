/** Public, build-time configuration. Nothing secret may ever be read here. */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
} as const;

export const backendConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);

/** Prefix a root-relative asset path with the GitHub Pages base path. */
export const asset = (path: string) => `${env.basePath}${path.startsWith("/") ? path : `/${path}`}`;

export const absoluteUrl = (path = "/") => `${env.siteUrl}${env.basePath}${path.startsWith("/") ? path : `/${path}`}`;
