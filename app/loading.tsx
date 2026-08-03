// Root loading boundary. Besides showing instant feedback on navigation, its
// presence changes what <Link> prefetching does for the dynamic routes: the
// prefetch stops at this boundary instead of fully rendering the target page
// on the server. Without it, loading the dashboard prefetched every linked
// page — each of which read its collections from Google Drive — and the burst
// tripped Drive's per-user rate limit (403 "User rate limit exceeded").
export default function Loading() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent dark:border-brand-300 dark:border-t-transparent"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}
