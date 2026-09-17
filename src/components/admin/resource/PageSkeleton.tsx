/** Suspense fallback shared by the admin pages (they read the query string). */
export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="skeleton mb-2 h-9 w-56" />
      <div className="skeleton mb-6 h-4 w-80 max-w-full" />
      <div className="skeleton mb-3 h-11 w-full" />
      <div className="skeleton h-72 w-full" />
    </div>
  );
}
