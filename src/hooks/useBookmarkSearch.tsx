import { getPreferenceValues } from "@raycast/api";
import { useSQL } from "@raycast/utils";
import { existsSync } from "fs";
import { ReactElement, useState } from "react";
import { NotInstalledError } from "../components/error/NotInstalledError";
import { HistoryEntry, Preferences, SearchResult } from "../interfaces";
import { getHistoryDbPath } from "../util";

const whereClauses = (terms: string[]) => {
  return terms.map((t) => `b.title LIKE '%${t}%'`).join(" AND ");
};

const getBookmarkQuery = (query?: string) => {
  const preferences = getPreferenceValues<Preferences>();
  const terms = query ? query.trim().split(" ") : [];
  const whereClause = terms.length > 0 ? `AND ${whereClauses(terms)}` : "";

  return `WITH BookmarkEntries AS (
    SELECT
      b.*,
      p.url,
      datetime(b.lastModified/1000000,'unixepoch') as lastModified,
      ROW_NUMBER() OVER (PARTITION BY b.fk ORDER BY b.id) as rn
    FROM moz_bookmarks b
    JOIN moz_places p ON b.fk = p.id
    WHERE b.type = 1 ${whereClause}
  )
  SELECT id, url, title, lastModified
  FROM BookmarkEntries
  WHERE rn = 1
  ORDER BY lastModified DESC
  LIMIT ${preferences.limitResults};`;
};

export function useBookmarkSearch(query: string | undefined): SearchResult<HistoryEntry> {
  const inQuery = getBookmarkQuery(query);
  const dbPath = getHistoryDbPath();
  const [retryCount, setRetryCount] = useState(0);

  // Dizin veya dosya yoksa hata bileşeni döndür
  if (!dbPath || !existsSync(dbPath)) {
    return { data: [], isLoading: false, errorView: <NotInstalledError /> };
  }

  const { isLoading, data, permissionView } = useSQL<HistoryEntry>(dbPath, inQuery, {
    onError: (error) => {
      const isRetryableError =
        error.message?.includes("database is locked") || error.message?.includes("disk image is malformed");

      if (isRetryableError && retryCount < 5) {
        setTimeout(
          () => {
            setRetryCount(retryCount + 1);
          },
          Math.pow(2, retryCount) * 250,
        );
      }
    },
  });

  return {
    data,
    isLoading,
    errorView: permissionView as ReactElement,
  };
}
