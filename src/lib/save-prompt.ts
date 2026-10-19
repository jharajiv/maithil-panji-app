import type { Lang } from "./hi";

/**
 * When to remind someone that their tree lives only on this phone — never blocking, always dismissible.
 *  stage 1: about 3 people (you, father, mother)      "Save your tree so you do not lose it"
 *  stage 2: 8 people                                  "this much work should not be lost"
 *  stage 3: the tree is complete                      save + share + PDF with a QR code
 *  back:    someone returns to an unsaved tree        "welcome back"
 * "Later" remembers the stage, so the same reminder is not shown twice; the next one comes at the next stage.
 */
export type SaveKind = "first" | "more" | "done" | "back" | "paused";
export const STAGE_AT = { first: 3, more: 8 } as const;
/** the AI helper works for a tree that is not saved only up to this many named people; after that it works for saved trees (the simple questions carry on for everyone) */
export const AI_FREE_PEOPLE = 8;
/** from this many named people the chat says, once, how many more the AI helper will work for — so the pause is never a surprise */
export const AI_WARN_AT = 6;
/** how many more people the AI helper will work for, when it is time to say so (null = not yet / not needed) */
export const aiPeopleLeft = (named: number): number | null => (named >= AI_WARN_AT && named < AI_FREE_PEOPLE ? AI_FREE_PEOPLE - named : null);

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
      case "first": return { title: "अपनी वंशावली सहेज लीजिए", body: `अभी यह सिर्फ़ इसी फ़ोन में रखी है। ${how} — फिर किसी भी फ़ोन पर खोल सकेंगे और रिश्तेदारों को जोड़ सकेंगे। AI सहायक लगभग ${AI_FREE_PEOPLE} लोगों के बाद सिर्फ़ सहेजी हुई वंशावली के लिए चलता है।`, cta, later };
      case "more": return { title: `${people} लोग जुड़ चुके हैं`, body: "इतनी मेहनत कहीं खो न जाए — इसे ऑनलाइन सहेज लीजिए। यह अभी सिर्फ़ इसी फ़ोन में है।", cta, later };
      case "done": return { title: "आपकी वंशावली तैयार है!", body: "इसे ऑनलाइन सहेजिए, WhatsApp पर परिवार को भेजिए, और QR कोड वाली PDF पाइए।", cta, later };
      case "paused": return { title: "AI सहायक रुका है", body: "AI सहायक उन्हीं वंशावलियों के लिए चलता है जो खाते में सहेजी गई हों। जब तक सहेजेंगे नहीं, सरल सवाल पूछे जाते रहेंगे — आपके जवाब उसी तरह दर्ज होंगे। वंशावली सहेजते ही AI सहायक वापस आ जाएगा। Google या ईमेल से सहेजना मुफ़्त है।", cta, later: "अभी नहीं" };
      case "back": return { title: "फिर स्वागत है!", body: `आपकी वंशावली (${people} लोग) अब भी सिर्फ़ इसी फ़ोन में है। इसे सहेज लीजिए ताकि कभी खोए नहीं।`, cta, later };
    }
  }
  const cta = signedIn ? "Save to my account" : "Save my tree";
  const later = "Later";
  switch (kind) {
    case "first": return { title: "Save your tree so you do not lose it", body: `Right now it is kept only on this phone. ${how} — then you can open it on any phone and invite relatives to help. The AI helper keeps working after about ${AI_FREE_PEOPLE} people only for saved trees.`, cta, later };
    case "more": return { title: `${people} people so far`, body: "This much work should not be lost. Save it online — it is kept only on this phone right now.", cta, later };
    case "done": return { title: "Your tree is ready!", body: "Save it online to keep it safe, share it with your family on WhatsApp, and get a PDF with a QR code.", cta, later };
    case "paused": return { title: "The AI helper is paused", body: "The AI helper works for trees that are saved to an account. Until you save, I will keep asking simple questions — your answers are recorded the same way. Save your tree and the AI helper comes back. It is free, with Google or email.", cta, later: "Not now" };
    case "back": return { title: "Welcome back!", body: `Your tree (${people} ${people === 1 ? "person" : "people"}) is still only on this phone. Save it so it is never lost.`, cta, later };
  }
}

/** the line put at the top of the chat message the first time the AI helper steps aside (see /api/chat, "gate") */
export const pausedLine = (lang: Lang) => lang === "hi"
  ? "AI सहायक के साथ आगे बढ़ने के लिए पहले अपनी वंशावली सहेज लीजिए — Google या ईमेल से मुफ़्त है। तब तक सरल सवालों से काम चलेगा, और आपके जवाब उसी तरह दर्ज होते रहेंगे।"
  : "To keep going with the AI helper, please save your tree first — it is free, with Google or email. Until then I will ask simple questions instead, and your answers are recorded just the same.";

/** the one-time heads-up put at the top of a chat message a little before the AI helper steps aside (see /api/chat, "left") */
export const headsUpLine = (lang: Lang, left: number) => lang === "hi"
  ? `ध्यान दीजिए: ${left === 1 ? "एक और व्यक्ति" : `${left} और लोग`} जुड़ने के बाद AI सहायक आपसे वंशावली सहेजने को कहेगा (Google या ईमेल से मुफ़्त)। सहेजने में एक मिनट लगता है, और सब कुछ सुरक्षित रहता है।`
  : `Heads up: after ${left === 1 ? "one more person" : `${left} more people`} the AI helper will ask you to save your tree (free, with Google or email). It takes a minute and keeps everything safe.`;
