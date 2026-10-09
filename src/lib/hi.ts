/**
 * The interview in Hindi (Devanagari). The fixed questions are rebuilt from the same facts the English ones use (what the question is,
 * who it is about, how they are related to the user), so the two languages cannot drift apart. The few free-text replies the app
 * writes itself ("Noted.", "Added Ram.") are translated by pattern. The AI interviewer is simply told to write in Hindi.
 * Maithili needs a native speaker to review before it is offered; Hindi first.
 * NOTE for a native reviewer: product word for a family tree is वंशावली.
 */
import { generation, type Goal } from "./interview";
import { labels, type DFamily, type DPerson } from "./family";

export type Lang = "en" | "hi";

/* ───────────────────────── relationship words ───────────────────────── */

const TERM: Record<string, [string, "m" | "f"]> = {
  father: ["पिता", "m"], mother: ["माता", "f"], grandfather: ["दादा", "m"], grandmother: ["दादी", "f"],
  "great-grandfather": ["परदादा", "m"], "great-grandmother": ["परदादी", "f"],
  "great-great-grandfather": ["लकड़दादा", "m"], "great-great-grandmother": ["लकड़दादी", "f"],
  brother: ["भाई", "m"], sister: ["बहन", "f"], sibling: ["भाई-बहन", "m"], wife: ["पत्नी", "f"], husband: ["पति", "m"],
  son: ["बेटा", "m"], daughter: ["बेटी", "f"], child: ["संतान", "f"], relative: ["रिश्तेदार", "m"],
};
const termOf = (w: string): [string, "m" | "f"] => TERM[w] ?? (/great/.test(w) ? ["पूर्वज", "m"] : ["रिश्तेदार", "m"]);

/** "father’s brother" → "आपके पिता के भाई"; "your sister" → "आपकी बहन" */
export function hiRel(label: string | undefined): string {
  let l = (label ?? "relative").replace(/’/g, "'").trim();
  if (l === "you") return "आप";
  l = l.replace(/^your\s+/, "");
  const parts = l.split("'s ").map((x) => x.trim()).filter(Boolean);
  if (!parts.length) return "रिश्तेदार";
  const [t0, g0] = termOf(parts[0]!);
  let out = `${g0 === "f" ? "आपकी" : "आपके"} ${t0}`;
  for (const w of parts.slice(1)) { const [t, g] = termOf(w); out += ` ${g === "f" ? "की" : "के"} ${t}`; }
  return out;
}
const upTerm = (g: number, mother = false) => termOf(g === 1 ? (mother ? "mother" : "father") : g === 2 ? (mother ? "grandmother" : "grandfather") : g === 3 ? (mother ? "great-grandmother" : "great-grandfather") : g === 4 ? (mother ? "great-great-grandmother" : "great-great-grandfather") : "ancestor")[0];

/* ───────────────────────── the questions ───────────────────────── */

const nm = (p: DPerson) => (p.placeholder ? "(नाम ज्ञात नहीं)" : p.name_dev || p.name_roman);
const first = (p: DPerson) => nm(p).split(" ")[0]!;

export interface HiGoal { question: string; section: string; quick: string[] }

export const QUICK_HI: Record<string, string> = {
  "No brothers": "कोई भाई नहीं", "No sisters": "कोई बहन नहीं", "Not married": "अविवाहित", "No sons": "कोई पुत्र नहीं", "No daughters": "कोई पुत्री नहीं",
  Skip: "छोड़ें", "I don’t know": "पता नहीं", "Skip the rest of this step": "इस चरण के बाकी प्रश्न छोड़ें",
  "I don’t know my gotra": "मुझे अपना गोत्र नहीं पता", "I don’t know my mool": "मुझे अपना मूल नहीं पता",
  "I don’t remember": "याद नहीं", "I don’t know any further": "इससे आगे पता नहीं",
  Male: "पुरुष", Female: "महिला", "Male (son / brother)": "पुरुष (बेटा / भाई)", "Female (daughter / sister)": "महिला (बेटी / बहन)", Yes: "हाँ", No: "नहीं",
};
/** what a quick-reply button shows (what it SENDS stays the English word, which the rest of the app already understands) */
export const quickLabel = (q: string, lang: Lang) => (lang === "hi" ? QUICK_HI[q] ?? q : q);

const SECTION_HI: Record<string, string> = {
  "About you": "आपके बारे में", "Your Panji identity": "आपकी पंजी-पहचान", "Your parents": "आपके माता-पिता", "Your ancestors": "आपके पूर्वज",
  "Your family": "आपका परिवार", "Your brothers’ families": "आपके भाइयों के परिवार", "Earlier answer": "पिछला उत्तर",
};
const STEP_TITLE: Record<string, string> = {
  brothers: "भाई", sisters: "बहनें", "brothers’ wives": "भाइयों की पत्नियाँ", "sisters’ husbands": "बहनों के पति", "brothers’ children": "भाइयों के बच्चे",
};
export function hiSection(s: string): string {
  if (SECTION_HI[s]) return SECTION_HI[s]!;
  const m = /^Step (\d+) of (\d+) · (.+)$/.exec(s);
  if (!m) return s;
  const rest = m[3]!.replace(/’/g, "'");
  const mm = /^Your (?:(.+)'s )?(brothers|sisters|brothers' wives|sisters' husbands|brothers' children)$/.exec(rest);
  if (!mm) return s;
  const title = STEP_TITLE[mm[2]!.replace(/'/g, "’")] ?? mm[2]!;
  const who = mm[1] ? hiRel(mm[1]).replace(/^आपके /, "आपके ").replace(/^आपकी /, "आपकी ") : "";
  return `चरण ${m[1]}/${m[2]} · ${who ? `${who} के ` : "आपके "}${title}`.replace("आपके आपके", "आपके");
}

/** the Hindi question for a goal, or null when there is none (the English one is used) */
export function hiGoal(f: DFamily, goal: Goal): HiGoal | null {
  const sub = f.persons.find((p) => p.id === goal.subjects[0]);
  const lab = labels(f);
  const quick = goal.quick.map((q) => QUICK_HI[q] ?? q);
  const out = (question: string): HiGoal => ({ question, section: hiSection(goal.section), quick });
  switch (goal.kind) {
    case "self_name": return out("आइए आपसे शुरू करते हैं। आपका पूरा नाम क्या है?");
    case "self_gender": return out(`धन्यवाद${sub ? `, ${first(sub)}` : ""}। क्या आप पुरुष हैं या महिला?`);
    case "self_gotra": return out("आपका गोत्र क्या है? (जैसे शाण्डिल्य, कश्यप, वत्स)");
    case "self_mool": return out("आपका मूल क्या है? आप अंग्रेज़ी या देवनागरी में लिख सकते हैं।");
    case "self_birth": return out("आपकी जन्म-तिथि क्या है? दिन, महीना और साल पता हो तो बताइए — या केवल साल। (वैकल्पिक)");
    case "self_place": return out("आप अभी कहाँ रहते हैं? कृपया गाँव या शहर, ज़िला और राज्य बताइए (विदेश में हों तो शहर और देश)।");
  }
  if (!sub) return null;
  const g = generation(f, sub.id);
  const isMe = !!sub.is_me;
  const you = isMe ? "आप" : `${first(sub)} (${hiRel(lab[sub.id])})`;
  switch (goal.kind) {
    case "father":
      return out(g <= 0 ? "आपके पिता का नाम क्या है?" : `${first(sub)} के पिता (आपके ${upTerm(g + 1)}) का नाम क्या था? इससे आगे का पता न हो तो बस यही कह दीजिए।`);
    case "mother":
      return out(g <= 0 ? "आपकी माताजी का नाम क्या है?" : `${first(sub)} की माता (आपकी ${upTerm(g + 1, true)}) का नाम क्या आपको याद है? केवल नाम ही काफ़ी है।`);
    case "details": return out(`क्या ${nm(sub)} जीवित हैं? और क्या आपको उनकी जन्म-तिथि (केवल साल भी चलेगा) और उनका गाँव (ज़िले सहित) पता है?`);
    case "gender": return out(`क्या ${nm(sub)} पुरुष (बेटा या भाई) हैं या महिला (बेटी या बहन)?`);
    case "brothers": return out(isMe
      ? "क्या आपके भाई हैं? कृपया अपने सभी भाइयों (अपने पिता के पुत्रों) के नाम अल्पविराम से अलग करके लिखिए — या “कोई भाई नहीं” दबाइए। बहनों के बारे में अगले चरण में पूछेंगे।"
      : `क्या ${you} के भाई थे? कृपया उनके सभी भाइयों के नाम अल्पविराम से अलग करके लिखिए — या “कोई भाई नहीं” दबाइए। बहनों के बारे में अगले चरण में पूछेंगे।`);
    case "sisters": return out(isMe
      ? "क्या आपकी बहनें हैं? कृपया अपनी सभी बहनों के नाम अल्पविराम से अलग करके लिखिए — या “कोई बहन नहीं” दबाइए।"
      : `क्या ${you} की बहनें थीं? कृपया उनकी सभी बहनों के नाम अल्पविराम से अलग करके लिखिए — या “कोई बहन नहीं” दबाइए।`);
    case "wife": return out(isMe
      ? "क्या आपका विवाह हो चुका है? कृपया अपनी पत्नी का नाम लिखिए — या “अविवाहित” दबाइए।"
      : `क्या ${you} का विवाह हुआ था? कृपया उनकी पत्नी का नाम लिखिए — या “अविवाहित” दबाइए।`);
    case "husband": return out(`क्या आपको पता है कि ${first(sub)} (${hiRel(lab[sub.id])}) का विवाह किससे हुआ है? उनके पति का नाम और गाँव एक ही पंक्ति में लिखिए, जैसे “राजेश झा, दरभंगा” — यह उनके कार्ड पर छोटे नोट के रूप में रहेगा, और उनके पति का अपना परिवार उनकी अपनी वंशावली में दर्ज होगा। या “छोड़ें” दबाइए।`);
    case "sons": return out(isMe
      ? "क्या आपके पुत्र हैं? कृपया उनके नाम अल्पविराम से अलग करके लिखिए — या “कोई पुत्र नहीं” दबाइए। पुत्रियों के बारे में आगे पूछेंगे।"
      : `क्या ${you} के पुत्र हैं? कृपया उनके नाम अल्पविराम से अलग करके लिखिए — या “कोई पुत्र नहीं” दबाइए। पुत्रियों के बारे में आगे पूछेंगे।`);
    case "daughters": return out(isMe
      ? "क्या आपकी पुत्रियाँ हैं? कृपया उनके नाम अल्पविराम से अलग करके लिखिए — या “कोई पुत्री नहीं” दबाइए।"
      : `क्या ${you} की पुत्रियाँ हैं? कृपया उनके नाम अल्पविराम से अलग करके लिखिए — या “कोई पुत्री नहीं” दबाइए।`);
  }
  return null;
}

/* ───────────────────────── the app's own replies ───────────────────────── */

const DONE_HI = "धन्यवाद! आपकी वंशावली तैयार है। किसी पर भी टैप करके विवरण सुधारिए या फ़ोटो जोड़िए, शैली बदलिए और अपनी PDF डाउनलोड कीजिए। दूसरे घरों के रिश्तेदारों को अपनी-अपनी शाखाएँ जोड़ने के लिए बुलाने हेतु “Share” का उपयोग कीजिए।";
const HINT_HI = "पहले कही कोई बात सुधारनी हो तो उस संदेश को दबाकर “Reply” चुनिए, या वंशावली में उस व्यक्ति पर टैप कीजिए।";

const EXACT: [string, string][] = [
  ["Thank you! Your family tree is ready. Tap anyone in the tree to correct details or add a photo, change the style, and download your PDF. Use Share to invite relatives from other households to add their own branches.", DONE_HI],
  ["Thank you — your family tree is ready to review.", "धन्यवाद — आपकी वंशावली देखने के लिए तैयार है।"],
  ["To fix something you told me earlier, tap that message and choose Reply, or tap the person in the tree.", HINT_HI],
  ["Let’s move on — you can come back to this any time by tapping that person in the tree.", "आगे बढ़ते हैं — इसे आप कभी भी वंशावली में उस व्यक्ति पर टैप करके भर सकते हैं।"],
  ["Okay, I have skipped the rest of this step.", "ठीक है, इस चरण के बाकी प्रश्न छोड़ दिए हैं।"],
  ["Those are already in your tree.", "ये पहले से आपकी वंशावली में हैं।"],
  ["Sorry, I did not catch that.", "क्षमा कीजिए, मैं समझ नहीं पाया।"],
  ["Please write his name (and village, if you know it).", "कृपया उनके पति का नाम (और पता हो तो गाँव) लिखिए।"],
  ["What are their names?", "उनके नाम क्या हैं?"], ["What is her name?", "उनका नाम क्या है?"],
  ["Back to where we were.", "अब वहीं लौटते हैं जहाँ थे।"],
  ["Okay — nothing was changed.", "ठीक है — कुछ नहीं बदला।"],
  ["I did not catch the name.", "मैं नाम समझ नहीं पाया।"], ["I could not read that date.", "मैं वह तारीख़ पढ़ नहीं पाया।"], ["I did not catch that.", "मैं समझ नहीं पाया।"],
  ["That one can be changed by tapping the person in the tree.", "इसे वंशावली में उस व्यक्ति पर टैप करके बदला जा सकता है।"],
  ["Nice to meet you.", "आपसे मिलकर अच्छा लगा।"], ["Thank you.", "धन्यवाद।"], ["Okay.", "ठीक है।"], ["Noted.", "ठीक है, लिख लिया।"],
  ["No problem.", "कोई बात नहीं।"], ["That’s fine.", "कोई बात नहीं।"], ["Let’s move on.", "आगे बढ़ते हैं।"],
];
const KIND_HI: Record<string, string> = { gotra: "गोत्र", mool: "मूल" };
const PATTERNS: [RegExp, (m: RegExpExecArray) => string][] = [
  [/Added (.+?)\./g, (m) => `जोड़ा गया: ${m[1]!.replace(/ and /g, " और ")}।`],
  [/Noted: (gotra|mool) ([^.]+?)\./g, (m) => `ठीक है, ${KIND_HI[m[1]!]}: ${m[2]}।`],
  [/Noted — ([^.]+?)\./g, (m) => `ठीक है — ${m[1]}।`],
  [/Updated (.+?)\./g, () => "बदल दिया गया है।"],
  [/Did you mean (.+?)\? Please answer Yes, or type it again\./g, (m) => `क्या आपका आशय ${m[1]} से है? कृपया “हाँ” कहिए, या दोबारा लिखिए।`],
  [/No problem — please type your (gotra|mool) exactly as you want it recorded\./g, (m) => `कोई बात नहीं — कृपया अपना ${KIND_HI[m[1]!]} ठीक वैसा लिखिए जैसा आप दर्ज कराना चाहते हैं।`],
  [/I have noted “(.+?)” as a new (gotra|mool) — our team will review it\. Thank you\./g, (m) => `मैंने “${m[1]}” को नए ${KIND_HI[m[2]!]} के रूप में लिख लिया है — हमारी टीम इसे देखेगी। धन्यवाद।`],
  [/(.+?) sounds like (a sister or daughter|a brother or son), so I have not added (them|this person) here — that comes in its own step\./g, (m) => `${m[1]} शायद ${m[2] === "a brother or son" ? "भाई या पुत्र" : "बहन या पुत्री"} हैं, इसलिए मैंने उन्हें यहाँ नहीं जोड़ा — उसका अलग चरण आएगा।`],
];

/** Hindi version of a reply the app wrote itself. `goals` are the questions whose English text may appear in it. */
export function hiReply(reply: string, f: DFamily, goals: (Goal | null | undefined)[]): string {
  let t = reply;
  const seen = new Set<string>();
  for (const g of goals) {
    if (!g || seen.has(g.question)) continue;
    seen.add(g.question);
    const h = hiGoal(f, g);
    if (h && t.includes(g.question)) t = t.split(g.question).join(h.question);
  }
  for (const [en, hi] of EXACT) if (t.includes(en)) t = t.split(en).join(hi);
  for (const [rx, fn] of PATTERNS) t = t.replace(rx, (...a) => fn(a as unknown as RegExpExecArray));
  return t.replace(/\s+/g, " ").trim();
}

/* ───────────────────────── small pieces of the chat screen ───────────────────────── */

const UI_HI: Record<string, string> = {
  "Don’t know your gotra? Where to find it": "अपना गोत्र नहीं पता? कहाँ मिलेगा",
  "your Kundli or janam patri (birth chart)": "आपकी कुंडली या जन्म-पत्री",
  "your parents or elders in the family": "आपके माता-पिता या परिवार के बड़े-बुज़ुर्ग",
  "your family purohit or pandit": "आपके कुल के पुरोहित या पंडित जी",
  "older relatives — or their old papers, such as a Panji extract or a puja sankalp": "बड़े रिश्तेदार — या उनके पुराने काग़ज़, जैसे पंजी का उद्धरण या पूजा का संकल्प",
  "Your mool is tied to your ancestral village. Not sure? Ask an elder, or": "आपका मूल आपके पूर्वजों के गाँव से जुड़ा है। पक्का नहीं पता? किसी बड़े से पूछिए, या",
  "search for your mool on Google": "Google पर अपना मूल खोजिए",
  "Ask a relative on WhatsApp": "WhatsApp पर किसी रिश्तेदार से पूछिए",
  "Answer later": "बाद में बताऊँगा",
  "Still to fill in:": "अभी भरना बाकी:",
  Gotra: "गोत्र", Mool: "मूल", "Birth date": "जन्म-तिथि", "Where you live": "आप कहाँ रहते हैं",
  "Undo my last answer": "मेरा पिछला उत्तर वापस लीजिए",
  "Writing…": "लिख रहा हूँ…",
};
export const tr = (lang: Lang, en: string) => (lang === "hi" ? UI_HI[en] ?? en : en);

export const GOTRA_HELP_HI = (sources: string[]) => `कोई बात नहीं — इसे आप बाद में भी भर सकते हैं। गोत्र आमतौर पर यहाँ लिखा या पता मिलता है:\n\n${sources.map((x) => `• ${tr("hi", x)}`).join("\n")}\n\nजब मिल जाए, नीचे “अभी भरना बाकी” में उस पर टैप कीजिए।`;
export const ASK_RELATIVE_HI = (question: string) => `नमस्ते! मैं PAAG Foundation पर हमारी वंशावली तैयार कर रहा/रही हूँ। क्या आप इसमें मेरी मदद कर सकते हैं?\n\n${question}\n\nधन्यवाद!`;
