import { ReactElement } from "react";
import { existsSync } from "fs";
import { useSQL } from "@raycast/utils";
import { SearchResult, HistoryEntry } from "../interfaces";
import { getHistoryDbPath } from "../util";
import { NotInstalledError } from "../components/error/NotInstalledError";
import { getPreferenceValues } from "@raycast/api";
import { Preferences } from "../interfaces";

const whereClauses = (terms: string[]) => {
  return terms.map((t) => `moz_places.title LIKE '%${t}%'`).join(" AND ");
};

const getHistoryQuery = (query?: string) => {
  const preferences = getPreferenceValues<Preferences>();
  const terms = query ? query.trim().split(" ") : [];
  const whereClause = terms.length > 0 ? `WHERE ${whereClauses(terms)}` : "";

  return `SELECT
            id, url, title,
            datetime(last_visit_date/1000000,'unixepoch') as lastVisited
          FROM moz_places
          ${whereClause}
          ORDER BY last_visit_date DESC LIMIT ${preferences.limitResults};`;
};

export function useHistorySearch(query: string | undefined): SearchResult<HistoryEntry> {
  const inQuery = getHistoryQuery(query);
  const dbPath = getHistoryDbPath();

  // Dizin veya dosya yoksa hata bileşeni döndür
  if (!dbPath || !existsSync(dbPath)) {
    return { data: [], isLoading: false, errorView: <NotInstalledError /> };
  }
  const { isLoading, data, permissionView } = useSQL<HistoryEntry>(dbPath, inQuery);
  return { data, isLoading, errorView: permissionView as ReactElement };
}
