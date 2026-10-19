import type { DPerson } from "./family";

/** someone who has not been recorded as passed away is treated as living — when in doubt, protect.
 *  The one exception: no status recorded and born 100+ years ago, so certainly not living. */
export const isLiving = (p: Pick<DPerson, "status" | "birth" | "death">): boolean => {
  if (p.status === "deceased" || p.death) return false;
  if (p.status === "living") return true;
  const year = Number(/^\d{4}/.exec(p.birth ?? "")?.[0]);
  return !(year && year <= new Date().getFullYear() - 100);
};
