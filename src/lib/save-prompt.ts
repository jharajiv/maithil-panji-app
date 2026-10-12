import type { Lang } from "./hi";

/**
 * When to remind someone that their tree lives only on this phone — never blocking, always dismissible.
 *  stage 1: about 3 people (you, father, mother)      "Save your tree so you do not lose it"
 *  stage 2: 8 people                                  "this much work should not be lost"
 *  stage 3: the tree is complete                      save + share + PDF with a QR code
 *  back:    someone returns to an unsaved tree        "welcome back"
 * "Later" remembers the stage, so the same reminder is not shown twice; the next one comes at the next stage.
 */
export type SaveKind = "first" | "more" | "done" | "back";
export const STAGE_AT = { first: 3, more: 8 } as const;

export const stageOf = (people: number, complete: boolean): 0 | 1 | 2 | 3 =>
  people >= STAGE_AT.first && complete ? 3 : people >= STAGE_AT.more ? 2 : people >= STAGE_AT.first ? 1 : 0;

export interface SaveCardIn { people: number; complete: boolean; dismissed: number; /** this tree was already on the phone when the page opened */ returning: boolean; welcomed: boolean }
export function pickSaveCard(i: SaveCardIn): { kind: SaveKind; stage: 1 | 2 | 3 } | null {
  const stage = stageOf(i.people, i.complete);
  if (stage === 0) return null;
  if (i.returning && !i.welcomed) return { kind: "back", stage };
  if (stage > i.dismissed) return { kind: stage === 3 ? "done" : stage === 2 ? "more" : "first", stage };
  return null;
}

export interface SaveText { title: string; body: string; cta: string; later: string }
export function saveCardText(lang: Lang, kind: SaveKind, people: number, signedIn: boolean): SaveText {
  const hi = lang === "hi";
  const how = hi ? "Google या ईमेल से मुफ़्त सहेजिए" : "Save it free with Google or email";
  if (hi) {
    const cta = signedIn ? "मेरे खाते में सहेजिए" : "वंशावली सहेजिए";
    const later = "बाद में";
    switch (kind) {
      case "first": return { title: "अपनी वंशावली सहेज लीजिए", body: `अभी यह सिर्फ़ इसी फ़ोन में रखी है। ${how} — फिर किसी भी फ़ोन पर खोल सकेंगे और रिश्तेदारों को जोड़ सकेंगे।`, cta, later };
      case "more": return { title: `${people} लोग जुड़ चुके हैं`, body: "इतनी मेहनत कहीं खो न जाए — इसे ऑनलाइन सहेज लीजिए। यह अभी सिर्फ़ इसी फ़ोन में है।", cta, later };
      case "done": return { title: "आपकी वंशावली तैयार है!", body: "इसे ऑनलाइन सहेजिए, WhatsApp पर परिवार को भेजिए, और QR कोड वाली PDF पाइए।", cta, later };
      case "back": return { title: "फिर स्वागत है!", body: `आपकी वंशावली (${people} लोग) अब भी सिर्फ़ इसी फ़ोन में है। इसे सहेज लीजिए ताकि कभी खोए नहीं।`, cta, later };
    }
  }
  const cta = signedIn ? "Save to my account" : "Save my tree";
  const later = "Later";
  switch (kind) {
    case "first": return { title: "Save your tree so you do not lose it", body: `Right now it is kept only on this phone. ${how} — then you can open it on any phone and invite relatives to help.`, cta, later };
    case "more": return { title: `${people} people so far`, body: "This much work should not be lost. Save it online — it is kept only on this phone right now.", cta, later };
    case "done": return { title: "Your tree is ready!", body: "Save it online to keep it safe, share it with your family on WhatsApp, and get a PDF with a QR code.", cta, later };
    case "back": return { title: "Welcome back!", body: `Your tree (${people} ${people === 1 ? "person" : "people"}) is still only on this phone. Save it so it is never lost.`, cta, later };
  }
}
