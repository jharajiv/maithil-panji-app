import type { FamilyData, Person, Relationship } from "@/lib/types";

/**
 * FICTIONAL sample family used for Day 1 only (no persistence yet).
 * Names, dates, gotras, mools and villages are invented for demonstration.
 * Four generations, both sides of the root person (Rohan Jha).
 */
const p = (
  id: string,
  name_roman: string,
  name_devanagari: string,
  gender: Person["gender"],
  dob: string,
  dod: string | undefined,
  gotra: string,
  mool: string,
  current_village?: string,
): Person => ({
  person_id: id,
  name_roman,
  name_devanagari,
  gender,
  dob,
  dod,
  is_living: !dod,
  gotra,
  mool,
  current_village,
  source: "user_input",
});

const persons: Person[] = [
  // Paternal great-grandparents
  p("baidyanath", "Baidyanath Jha", "बैद्यनाथ झा", "male", "1902", "1976", "Kashyap", "Sodarpur"),
  p("savitri", "Savitri Devi", "सावित्री देवी", "female", "1908", "1985", "Bharadwaj", "Pali"),
  // Paternal grandparents + siblings
  p("harinath", "Harinath Jha", "हरिनाथ झा", "male", "1930", "2008", "Kashyap", "Sodarpur"),
  p("kamla", "Kamla Devi", "कमला देवी", "female", "1936", undefined, "Vatsa", "Bahera", "Madhubani"),
  p("shivnath", "Shivnath Jha", "शिवनाथ झा", "male", "1935", "2003", "Kashyap", "Sodarpur"),
  // Father's generation (paternal)
  p("ramakant", "Ramakant Jha", "रमाकांत झा", "male", "1958", undefined, "Kashyap", "Sodarpur", "Patna"),
  p("mahesh", "Mahesh Jha", "महेश झा", "male", "1955", undefined, "Kashyap", "Sodarpur", "Darbhanga"),
  p("rekha", "Rekha Devi", "रेखा देवी", "female", "1960", undefined, "Gautam", "Majhaura", "Darbhanga"),
  p("sunita", "Sunita Jha", "सुनीता झा", "female", "1962", undefined, "Kashyap", "Sodarpur", "Samastipur"),
  // Maternal side
  p("gopal", "Gopal Mishra", "गोपाल मिश्र", "male", "1932", "2015", "Shandilya", "Khandbala"),
  p("radha", "Radha Devi", "राधा देवी", "female", "1938", "2019", "Parashar", "Pali"),
  p("meena", "Meena Jha", "मीना झा", "female", "1963", undefined, "Shandilya", "Khandbala", "Patna"),
  // Root generation
  p("rohan", "Rohan Jha", "रोहन झा", "male", "1990", undefined, "Kashyap", "Sodarpur", "Zurich, Switzerland"),
  p("nisha", "Nisha Jha", "निशा झा", "female", "1994", undefined, "Kashyap", "Sodarpur", "Bengaluru"),
  p("vikram", "Vikram Jha", "विक्रम झा", "male", "1984", undefined, "Kashyap", "Sodarpur", "Delhi"),
  p("anjali", "Anjali Jha", "अंजलि झा", "female", "1992", undefined, "Kaushik", "Bahera", "Zurich, Switzerland"),
  // Next generation
  p("aarav", "Aarav Jha", "आरव झा", "male", "2020", undefined, "Kashyap", "Sodarpur", "Zurich, Switzerland"),
];

let n = 0;
const rel = (type: Relationship["type"], a: string, b: string): Relationship => ({
  rel_id: `r${++n}`,
  person_a_id: a,
  person_b_id: b,
  type,
  confidence: "confirmed",
});
const parentOf = (a: string, b: string) => rel("parent_of", a, b);
const spouseOf = (a: string, b: string) => rel("spouse_of", a, b);

const relationships: Relationship[] = [
  spouseOf("baidyanath", "savitri"),
  parentOf("baidyanath", "harinath"), parentOf("savitri", "harinath"),
  parentOf("baidyanath", "shivnath"), parentOf("savitri", "shivnath"),

  spouseOf("harinath", "kamla"),
  parentOf("harinath", "mahesh"), parentOf("kamla", "mahesh"),
  parentOf("harinath", "ramakant"), parentOf("kamla", "ramakant"),
  parentOf("harinath", "sunita"), parentOf("kamla", "sunita"),

  spouseOf("mahesh", "rekha"),
  parentOf("mahesh", "vikram"), parentOf("rekha", "vikram"),

  spouseOf("gopal", "radha"),
  parentOf("gopal", "meena"), parentOf("radha", "meena"),

  spouseOf("ramakant", "meena"),
  parentOf("ramakant", "rohan"), parentOf("meena", "rohan"),
  parentOf("ramakant", "nisha"), parentOf("meena", "nisha"),

  spouseOf("rohan", "anjali"),
  parentOf("rohan", "aarav"), parentOf("anjali", "aarav"),
];

export const sampleFamily: FamilyData = {
  persons,
  relationships,
  root_person_id: "rohan",
};
