import { writeFileSync } from "node:fs";
import { applyOps, emptyFamily, type DFamily } from "../src/lib/family";

/** a made-up five-generation Maithil family of 200+ people, for testing big charts */
export function bigFamily(): { family: DFamily; meId: string } {
  let f = emptyFamily();
  const add = (ops: Parameters<typeof applyOps>[1]) => { const r = applyOps(f, ops); f = r.family; return r.results[0]!.id!; };
  let n = 0;
  const first = ["Harinath", "Ramesh", "Suresh", "Mahesh", "Dinesh", "Ganesh", "Umesh", "Nitesh", "Rakesh", "Mukesh", "Satish", "Girish", "Lalit", "Mohan", "Sohan", "Kishan", "Pawan", "Raman", "Shyam", "Vishnu"];
  const nm = () => `${first[n++ % first.length]} Jha`;
  const place = "Behta, Madhubani, Bihar";
  const apex = add([{ op: "add_person", name_roman: "Harinath Jha", gender: "male", place, gotra: { roman: "Bharadvaja" }, mool: { roman: "Ekhare" } }]);
  const wifeNames = ["Sita", "Gita", "Radha", "Uma", "Lata", "Mala", "Rekha", "Sunita"];
  let w = 0;
  const grow = (id: string, depth: number) => {
    add([{ op: "add_person", name_roman: `${wifeNames[w++ % wifeNames.length]} Devi`, gender: "female", relation: { type: "spouse_of", to: id } }]);
    if (depth >= 4) return;
    const sons = depth < 3 ? 3 : 2;
    for (let i = 0; i < sons; i++) { const s = add([{ op: "add_person", name_roman: nm(), gender: "male", birth: String(1900 + depth * 25 + i), relation: { type: "child_of", to: id } }]); grow(s, depth + 1); }
    add([{ op: "add_person", name_roman: `${wifeNames[w++ % wifeNames.length]} Kumari`, gender: "female", relation: { type: "child_of", to: id } }]);
  };
  grow(apex, 0);
  // the user is a great-grandson: re-mark "me"
  const males = f.persons.filter((p) => p.gender === "male" && p.id !== apex);
  const me = males[males.length - 5]!;
  for (const p of f.persons) delete p.is_me;
  me.is_me = true;
  return { family: f, meId: me.id };
}
if (process.argv[2]) {
  const { family } = bigFamily();
  writeFileSync(process.argv[2], JSON.stringify({ family, messages: [{ id: "m1", role: "assistant", text: "Welcome back.", quick: [] }], repeats: 0, template: "madhubani" }));
  console.log("people", family.persons.length);
}
