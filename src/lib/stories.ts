/**
 * Story board: photos and short memories that family members add to a person on a shared tree.
 *
 *  - A LIVING person's story is shown only after that person has approved it. Who approves: the person themselves when they
 *    have joined the tree; otherwise the tree owner, on their behalf (the screen says so, and it is one deliberate tap).
 *  - A story about someone who has passed away is shown at once. The tree owner can remove any story; anyone can flag one.
 *  - Only people who have access to the tree (owner and helpers) can add, read or flag stories. Nothing here is on the
 *    public view-only pages.
 *
 * This file holds the rules only (no storage, no network), so they can be tested on their own.
 */
import { isLiving } from "./living";
import type { DPerson } from "./family";
import type { Member, TreeRow } from "./store";

export const MAX_STORY_TEXT = 800;
export const MAX_STORY_PHOTO = 70_000;
export const MAX_STORIES_PER_PERSON = 30;
export const MAX_PHOTOS_PER_PERSON = 8;
export const MAX_STORIES_PER_TREE = 300;

export interface Story {
  id: string; tree_id: string; person_id: string;
  text?: string;
  /** a small picture (data address) */
  photo?: string;
  by_member: string; by_name: string;
  created_at: string;
  status: "pending" | "shown";
  /** member ids of people who flagged this story as not appropriate */
  flags: string[];
}

const strip = (v: string) => v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

/** what a browser sent when adding a story → clean parts, or an error to show */
export function cleanStory(input: unknown): { ok: true; person: string; text?: string; photo?: string } | { ok: false; error: string } {
  const b = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const person = typeof b.person === "string" ? b.person.slice(0, 20) : "";
  if (!person) return { ok: false, error: "Please choose a person." };
  const text = typeof b.text === "string" ? strip(b.text).slice(0, MAX_STORY_TEXT) : "";
  const photo = typeof b.photo === "string" && b.photo ? b.photo : undefined;
  if (photo && (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo) || photo.length > MAX_STORY_PHOTO)) return { ok: false, error: "That photo could not be used. Please choose a smaller one." };
  if (!text && !photo) return { ok: false, error: "Please write a few words or add a photo." };
  return { ok: true, person, text: text || undefined, photo };
}

/** the member who must approve stories about this person: the person themselves (living, joined), otherwise the owner */
export function approverOf(row: Pick<TreeRow, "members">, person: DPerson): { member: Member; onBehalf: boolean } | undefined {
  const owner = row.members.find((m) => m.role === "owner");
  if (isLiving(person)) {
    const self = row.members.find((m) => m.person_id === person.id && m.status !== "invited");
    if (self) return { member: self, onBehalf: false };
    return owner ? { member: owner, onBehalf: true } : undefined;
  }
  return owner ? { member: owner, onBehalf: false } : undefined;
}

/** a story starts "shown" when it is about someone who has passed away or when the person wrote it about themselves */
export function startStatus(person: DPerson, author: Pick<Member, "person_id">): "pending" | "shown" {
  if (!isLiving(person)) return "shown";
  return author.person_id === person.id ? "shown" : "pending";
}

/** may this member see the story? Pending ones only the writer and the approver can read. */
export function canSee(row: Pick<TreeRow, "members" | "family">, me: Member, s: Story): boolean {
  if (s.status === "shown") return true;
  if (s.by_member === me.id) return true;
  const person = row.family.persons.find((p) => p.id === s.person_id);
  return !!person && approverOf(row, person)?.member.id === me.id;
}

/** may this member approve (or turn down) a waiting story? */
export function canApprove(row: Pick<TreeRow, "members" | "family">, me: Member, s: Story): boolean {
  if (s.status !== "pending") return false;
  const person = row.family.persons.find((p) => p.id === s.person_id);
  return !!person && approverOf(row, person)?.member.id === me.id;
}

/** may this member take a story down? The writer, the owner, and the person it is about. */
export function canRemove(row: Pick<TreeRow, "members" | "family">, me: Member, s: Story): boolean {
  if (s.by_member === me.id || me.role === "owner") return true;
  const person = row.family.persons.find((p) => p.id === s.person_id);
  return !!person && isLiving(person) && me.person_id === person.id;
}

/** what the browser gets for one story */
export function storyView(row: Pick<TreeRow, "members" | "family">, me: Member, s: Story) {
  const person = row.family.persons.find((p) => p.id === s.person_id);
  const ap = person ? approverOf(row, person) : undefined;
  return {
    id: s.id, person_id: s.person_id, text: s.text, photo: s.photo, by: s.by_name, mine: s.by_member === me.id, at: s.created_at, status: s.status,
    flagged: s.flags.length, flaggedByMe: s.flags.includes(me.id),
    canApprove: canApprove(row, me, s), onBehalf: s.status === "pending" && !!ap?.onBehalf,
    waitingFor: s.status === "pending" ? ap?.member.name : undefined,
    canRemove: canRemove(row, me, s),
    canFlag: s.status === "shown" && s.by_member !== me.id,
  };
}
export type StoryView = ReturnType<typeof storyView>;
