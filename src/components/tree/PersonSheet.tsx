"use client";
import { Crosshair, Pencil, Plus, Trash2, GitMerge } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { lifespan } from "@/lib/tree-filter";
import type { FamilyData, Person } from "@/lib/types";

function relatives(data: FamilyData, id: string) {
  const byId = new Map(data.persons.map((p) => [p.person_id, p]));
  const pick = (f: (r: FamilyData["relationships"][number]) => string | undefined) =>
    data.relationships.map(f).filter((x): x is string => !!x).map((x) => byId.get(x)!).filter(Boolean);
  return {
    parents: pick((r) => (r.type === "parent_of" && r.person_b_id === id ? r.person_a_id : undefined)),
    spouses: pick((r) =>
      r.type === "spouse_of" ? (r.person_a_id === id ? r.person_b_id : r.person_b_id === id ? r.person_a_id : undefined) : undefined,
    ),
    children: pick((r) => (r.type === "parent_of" && r.person_a_id === id ? r.person_b_id : undefined)),
  };
}

const Row = ({ k, v }: { k: string; v?: string }) =>
  v ? (
    <div className="flex justify-between gap-4 border-b border-border/60 py-2 text-sm last:border-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  ) : null;

export function PersonSheet({
  data,
  person,
  onClose,
  onCentre,
}: {
  data: FamilyData;
  person?: Person;
  onClose: () => void;
  onCentre: (id: string) => void;
}) {
  const rel = person ? relatives(data, person.person_id) : undefined;
  const names = (ps?: Person[]) => (ps?.length ? ps.map((p) => p.name_roman).join(", ") : undefined);
  return (
    <Sheet open={!!person} onClose={onClose} title={person?.name_roman}>
      {person && rel && (
        <div>
          <h2 className="font-display text-xl font-semibold leading-tight">{person.name_roman}</h2>
          {person.name_devanagari && <p className="text-muted-foreground">{person.name_devanagari}</p>}
          <p className="mt-0.5 text-sm text-muted-foreground">
            {person.gender === "female" ? "Female" : person.gender === "male" ? "Male" : "Other"}
            {lifespan(person) ? ` · ${lifespan(person)}` : ""}
            {person.is_living ? " · living" : ""}
          </p>

          <dl className="mt-3">
            <Row k="Gotra" v={person.gotra} />
            <Row k="Mool" v={person.mool} />
            <Row k="Pravara" v={person.pravara} />
            <Row k="Lives in" v={person.current_village} />
            <Row k="Parents" v={names(rel.parents)} />
            <Row k="Spouse" v={names(rel.spouses)} />
            <Row k="Children" v={names(rel.children)} />
          </dl>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              className="col-span-2"
              onClick={() => {
                onCentre(person.person_id);
                onClose();
              }}
            >
              <Crosshair /> Centre tree on {person.name_roman.split(" ")[0]}
            </Button>
            {/* Editing arrives with persistence (Day 2) — present but disabled so the layout is reviewable. */}
            <Button variant="outline" disabled><Pencil /> Edit</Button>
            <Button variant="outline" disabled><Plus /> Add parent</Button>
            <Button variant="outline" disabled><Plus /> Add spouse</Button>
            <Button variant="outline" disabled><Plus /> Add child</Button>
            <Button variant="outline" disabled><GitMerge /> Merge with…</Button>
            <Button variant="outline" disabled className="text-destructive"><Trash2 /> Delete</Button>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">Editing is wired up on Day 2 (needs persistence).</p>
        </div>
      )}
    </Sheet>
  );
}
