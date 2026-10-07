import { applyOps, emptyFamily, type DFamily, type Op } from "@/lib/family";

/**
 * A real, public lineage used as the "sample family" on the home page: the Khandavala dynasty of Raj Darbhanga.
 * Compiled from public sources — rajputs.net (Darbhanga page) and Wikipedia (Raj Darbhanga and the pages of the rulers) —
 * which agree on the line of rulers but do not always say who was whose son, so some links follow the order of succession.
 * Living descendants are shown by first name only — no dates, places, spouses or notes — as the app does for any private tree. Dates are years; where a source gave a reign, it is in the note.
 */
export const SAMPLE_NOTICE = "This is only a sample, shown so you can see how a Maithil family tree looks and works. It is not an official or actual representation of the family tree of Raj Darbhanga or of any family.";
export const SAMPLE_CREDIT = "Compiled from public sources: rajputs.net and Wikipedia. It may contain errors, and some links follow the order of succession. Some branches were added from family details supplied to us. Living descendants appear by first name only.";

interface N { ref: string; en: string; dev: string; f?: string; g?: "male" | "female"; live?: boolean; b?: string; d?: string; note?: string; gotra?: string }
const LINE: N[] = [
  { ref: "chandrapati", en: "Chandrapati Thakur", dev: "चन्द्रपति ठाकुर", note: "Rajpandit (royal priest) at Akbar’s court; father of Mahesh Thakur." },
  { ref: "mahesh", en: "Mahesh Thakur", dev: "महेश ठाकुर", f: "chandrapati", d: "1558", gotra: "Shandilya", note: "Founder of Raj Darbhanga (about 1557), given the charge of Tirhut by the Mughal emperor Akbar." },
  { ref: "ramchandra", en: "Ramchandra Thakur", dev: "रामचन्द्र ठाकुर", f: "mahesh", note: "Son of Mahesh Thakur." },
  { ref: "gopal", en: "Gopal Thakur", dev: "गोपाल ठाकुर", f: "mahesh", note: "Son of Mahesh Thakur; ruled briefly." },
  { ref: "achyut", en: "Achyut Thakur", dev: "अच्युत ठाकुर", f: "mahesh", note: "Son of Mahesh Thakur." },
  { ref: "parmanand", en: "Parmanand Thakur", dev: "परमानन्द ठाकुर", f: "mahesh", note: "Son of Mahesh Thakur; ruled briefly." },
  { ref: "subhankar", en: "Subhankar Thakur", dev: "शुभंकर ठाकुर", f: "mahesh", d: "1607", note: "Son of Mahesh Thakur; ruler until 1607." },
  { ref: "purushottam", en: "Purushottam Thakur", dev: "पुरुषोत्तम ठाकुर", f: "subhankar", d: "1642", note: "Ruled 1607–1642." },
  { ref: "sundar", en: "Sundar Thakur", dev: "सुन्दर ठाकुर", f: "purushottam", d: "1662", note: "Ruled 1642–1662." },
  { ref: "mahinath", en: "Mahinath Thakur", dev: "महिनाथ ठाकुर", f: "sundar", d: "1684", note: "Ruled 1662–1684." },
  { ref: "nirpat", en: "Nirpat Thakur", dev: "नृपत ठाकुर", f: "mahinath", d: "1700", note: "Ruled 1684–1700." },
  { ref: "raghu", en: "Raghu Singh", dev: "रघु सिंह", f: "nirpat", d: "1736", note: "Ruled 1700–1736." },
  { ref: "bishnu", en: "Bishnu Singh", dev: "विष्णु सिंह", f: "raghu", d: "1740", note: "Ruled 1736–1740." },
  { ref: "narendra", en: "Narendra Singh", dev: "नरेन्द्र सिंह", f: "raghu", d: "1760", note: "Ruled 1740–1760. Son of Raghu Singh. He had no son and adopted Pratap Singh as his heir." },
  { ref: "pratap", en: "Pratap Singh", dev: "प्रताप सिंह", f: "narendra", d: "1776", note: "Ruled 1760–1776. Adopted heir of Narendra Singh." },
  { ref: "madho", en: "Madho Singh", dev: "माधव सिंह", f: "pratap", d: "1808", note: "Ruled 1776–1808. Shown under Pratap Singh as his successor; the sources do not state the relationship." },
  { ref: "kishan", en: "Kishan Singh", dev: "कुँवर किशन सिंह", f: "madho", note: "Kunwar. Younger son of Madho Singh." },
  { ref: "chhatra", en: "Chhatra Singh", dev: "छत्र सिंह", f: "madho", d: "1839", note: "Maharaja. Ruled 1808–1839." },
  { ref: "bisdeo", en: "Bisdeo Singh", dev: "राजकुमार बिसदेव सिंह", f: "chhatra", note: "Rajkumar. Younger son of Chhatra Singh." },
  { ref: "rudra", en: "Rudra Singh", dev: "रुद्र सिंह", f: "chhatra", d: "1850", note: "Ruled 1839–1850." },
  { ref: "ganeshwar", en: "Ganeshwar Singh", dev: "राजकुमार गणेश्वर सिंह", f: "rudra", note: "Rajkumar. Son of Rudra Singh; also known as Babu Ghunpat." },
  { ref: "nitreshwar", en: "Nitreshwar Singh", dev: "राजकुमार नित्रेश्वर सिंह", f: "rudra", note: "Rajkumar. Son of Rudra Singh." },
  { ref: "gopeshwar", en: "Gopeshwar Singh", dev: "राजकुमार गोपेश्वर सिंह", f: "rudra", note: "Rajkumar. Son of Rudra Singh." },
  { ref: "ekradeswar", en: "Babu Ekradeswar Singh", dev: "बाबू एकरदेश्वर सिंह", f: "nitreshwar", note: "Son of Nitreshwar Singh." },
  { ref: "janeswar", en: "Babu Janeswar Singh", dev: "बाबू जनेश्वर सिंह", f: "nitreshwar", d: "1906", note: "Son of Nitreshwar Singh. Married Musammat Janeswari Babuain. Died without children on 18 April 1906." },
  { ref: "maheshwar", en: "Maheshwar Singh", dev: "महेश्वर सिंह", f: "rudra", d: "1860", note: "Maharaja. Ruled 1850–1860 (died 20 October 1860)." },
  { ref: "lakshmeshwar", en: "Lakshmeshwar Singh", dev: "लक्ष्मीश्वर सिंह", f: "maheshwar", b: "1858", d: "1898", note: "Maharaja. Ruled 1860–1898. Had no children; succeeded by his brother." },
  { ref: "rameshwar", en: "Rameshwar Singh", dev: "रामेश्वर सिंह", f: "maheshwar", b: "1860", d: "1929", note: "Maharajadhiraja. Ruled 1898–1929. Joined the Indian Civil Service in 1878." },
  { ref: "kameshwar", en: "Kameshwar Singh", dev: "कामेश्वर सिंह", f: "rameshwar", b: "1907", d: "1962", note: "Last ruling Maharajadhiraja (from 1929). Member of the Constituent Assembly and of the Rajya Sabha. Sources give different dates in 1962 for his death." },
  { ref: "vishweshwar", en: "Vishweshwar Singh", dev: "विश्वेश्वर सिंह", f: "rameshwar", b: "1908", note: "Raja Bahadur; younger brother of Kameshwar Singh." },
  { ref: "daughter", en: "Lakshmi Daiji", dev: "लक्ष्मी दाईजी", f: "rameshwar", g: "female", b: "1905", note: "Sister of Kameshwar Singh. One source names her; another lists a Maharajkumari born 1905 without a name — to be verified." },
  { ref: "jeeveshwar", en: "Jeeveshwar Singh", dev: "जीवेश्वर सिंह", f: "vishweshwar", d: "1988", note: "Babu Saheb. Son of Vishweshwar Singh." },
  { ref: "subheshwar", en: "Subheshwar Singh", dev: "शुभेश्वर सिंह", f: "vishweshwar", d: "2006", note: "Head of the family 1962–2006. Shown as a son of Vishweshwar Singh, as one of the sources lists him." },
  { ref: "yajneshwar", en: "Yajneshwar", dev: "", f: "vishweshwar", live: true },
  { ref: "ratneshwar", en: "Ratneshwar", dev: "", f: "yajneshwar", live: true },
  { ref: "rashmeshwar", en: "Rashmeshwar Singh", dev: "कुमार रश्मेश्वर सिंह", f: "yajneshwar", note: "Kumar. Son of Yajneshwar; has passed away." },
  { ref: "rajneshwar", en: "Rajneshwar", dev: "", f: "yajneshwar", live: true },
  { ref: "rajeshwar", en: "Rajeshwar", dev: "", f: "subheshwar", live: true },
  { ref: "kapileshwar", en: "Kapileshwar", dev: "", f: "subheshwar", live: true },
];
const WIVES = [
  { ref: "w1", en: "Kameshwari Priya", dev: "कामेश्वरी प्रिया", of: "kameshwar", note: "Maharani, of Mangrauni; first wife of Kameshwar Singh." },
  { ref: "w2", en: "Kamsundari Kalyani", dev: "कामसुन्दरी कल्याणी", of: "kameshwar", note: "Maharani; wife of Kameshwar Singh." },
  { ref: "w3", en: "Janeswari Babuain", dev: "मुसम्मात जनेश्वरी बबुआइन", of: "janeswar", note: "Musammat. Wife of Babu Janeswar Singh." },
];

/**
 * Portraits of rulers — only photographs that are public domain or openly licensed, each with its credit.
 * To add one: put the image in public/sample/portraits/ (a small JPG, about 300 px wide) and add a line here:
 *   kameshwar: { file: "kameshwar.jpg", credit: "Photographer or source, licence — Wikimedia Commons file name" },
 * The key is the person's ref from LINE above. People without a line here simply have no portrait.
 */
export const PORTRAITS: Record<string, { file: string; credit: string }> = {
};

export function darbhangaSample(): DFamily {
  const ops: Op[] = [];
  for (const n of LINE) {
    const op: Op = {
      op: "add_person", ref: n.ref, name_roman: n.en, name_dev: n.dev, gender: n.g ?? "male",
      ...(n.f ? { relation: { type: "child_of" as const, to: n.f } } : {}),
    } as Op;
    ops.push(op);
  }
  for (const w of WIVES) ops.push({ op: "add_person", ref: w.ref, name_roman: w.en, name_dev: w.dev, gender: "female", relation: { type: "spouse_of", to: w.of } } as Op);
  let f = applyOps(emptyFamily(), ops).family;
  // refs resolve to ids only inside one batch, so details go in a second pass by name
  const byName = new Map(f.persons.map((p) => [p.name_roman, p.id]));
  const upd: Op[] = [];
  for (const n of LINE) upd.push({ op: "update_person", id: byName.get(n.en)!, set: n.live ? { status: "living" } : { birth: n.b ?? "", death: n.d ?? "", status: "deceased", notes: n.note ?? "" } } as Op);
  for (const w of WIVES) upd.push({ op: "update_person", id: byName.get(w.en)!, set: { status: "deceased", notes: w.note } } as Op);
  f = applyOps(f, upd).family;
  // the chart is drawn from one "root" person (it walks up to the first ancestor and down again): the last ruler is the natural one
  f = { ...f, persons: f.persons.map((p) => {
    const { is_me: _m, ...rest } = p; void _m;
    const q = p.name_roman === "Mahesh Thakur" ? { ...rest, gotra: { roman: "Shandilya", dev: "शाण्डिल्य" } } : rest;
    return p.name_roman === "Kameshwar Singh" ? { ...q, is_me: true } : q;
  }) };
  return f;
}

/** the person ids that have a portrait → their file and credit (ids are only known once the family is built) */
export function portraitFor(f: DFamily): { id: string; name: string; file: string; credit: string }[] {
  const byRef = new Map(LINE.map((n) => [n.ref, n.en]));
  return Object.entries(PORTRAITS).flatMap(([ref, p]) => {
    const name = byRef.get(ref);
    const id = f.persons.find((x) => x.name_roman === name)?.id;
    return id && name ? [{ id, name, ...p }] : [];
  });
}
