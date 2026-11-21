/**
 * Where "Load older episodes" carries on in a paged feed (RFC 5005), kept in
 * `feeds.next_page_url`:
 * - NULL: not paged yet; a refresh may set it from page 1's next link.
 * - a URL: the next older page to fetch.
 * - '' (`PAGES_DONE`): every older page has been fetched.
 *
 * A normal refresh only reads page 1, so it must not move a cursor that
 * paging has already advanced, or the same pages would be fetched again. A
 * full refresh ("Refresh complete podcast") starts the walk over.
 */
export const PAGES_DONE = '';

/** Params: full refresh (1 or 0), page 1's next link (or null), feed id. */
export const REFRESH_PAGE_CURSOR = `UPDATE feeds
    SET next_page_url = CASE WHEN ? = 1 OR next_page_url IS NULL THEN ? ELSE next_page_url END
  WHERE id = ?`;

/** Params: the fetched page's next link (or `PAGES_DONE`), feed id. */
export const ADVANCE_PAGE_CURSOR = 'UPDATE feeds SET next_page_url = ? WHERE id = ?';

/** The cursor after fetching a page whose next link is `nextPageUrl`. */
export function cursorAfterPage(nextPageUrl: string | null | undefined): string {
  return nextPageUrl || PAGES_DONE;
}
