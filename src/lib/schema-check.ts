/** The tables and columns the app needs in Supabase, and which section of supabase/schema.sql creates each. Used by Admin → Setup status. */
export interface SchemaNeed { table: string; select: string; section: number; what: string }
export const SCHEMA_NEEDS: SchemaNeed[] = [
  { table: "trees", select: "id,title,people_count", section: 1, what: "saved trees" },
  { table: "accounts", select: "id,email,profile", section: 8, what: "accounts and profiles" },
  { table: "persons", select: "tree_id", section: 2, what: "people (for search)" },
  { table: "relations", select: "tree_id", section: 2, what: "relations (for the graph)" },
  { table: "consents", select: "tree_id", section: 3, what: "consent log" },
  { table: "custom_refs", select: "kind,key,status", section: 4, what: "new gotra and mool spellings" },
  { table: "events", select: "name,at", section: 6, what: "usage counts" },
  { table: "suggestions", select: "id", section: 7, what: "suggested corrections" },
  { table: "newsletter", select: "email", section: 9, what: "newsletter" },
  { table: "stories", select: "id", section: 10, what: "stories and photos" },
  { table: "ai_calls", select: "id,model,cache_read", section: 11, what: "AI token counts" },
  { table: "chat_feedback", select: "id,at", section: 12, what: "chat feedback" },
];
