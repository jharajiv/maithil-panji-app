import { applyOps, emptyFamily, type DFamily } from "./family";
import { romanToDevanagari } from "./translit";

/** a new tree that already contains the person who is filling it in */
export const familyFor = (name: string): DFamily =>
  applyOps(emptyFamily(), [{ op: "add_person", name_roman: name, name_dev: romanToDevanagari(name) }]).family;
