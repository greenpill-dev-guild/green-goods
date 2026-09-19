/** The IndexedDB name the admin reading cache persists under, one record per query. */
export const ADMIN_QUERY_PERSISTENCE_DB = "gg-admin-query-cache";
/** The whole-snapshot store earlier admin builds wrote; copied in once, then deleted. */
export const ADMIN_LEGACY_QUERY_PERSISTENCE = {
  dbName: "gg-admin-react-query",
  storeName: "rq",
} as const;
