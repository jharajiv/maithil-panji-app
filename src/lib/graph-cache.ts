import { isDiscoverable } from "./connect-server";
import { buildGraph, type Graph } from "./graph";
import { getStore } from "./store";

/** the whole graph (admin) and the graph of trees that agreed to be found (everyone else), each rebuilt at most once a minute */
const cache: { all?: { at: number; g: Graph }; open?: { at: number; g: Graph } } = {};

export async function graphOf(kind: "all" | "open", fresh = false): Promise<Graph | null> {
  const store = getStore();
  if (!store) return null;
  const hit = cache[kind];
  if (!fresh && hit && Date.now() - hit.at < 60_000) return hit.g;
  const rows = await store.listAllTrees(5000);
  const g = buildGraph(kind === "open" ? rows.filter(isDiscoverable) : rows);
  cache[kind] = { at: Date.now(), g };
  return g;
}
export const forgetGraphs = () => { cache.all = undefined; cache.open = undefined; };
