/**
 * The questions people ask about gotra, mool and the Panji way of recording a family — one list, written once, in English and Hindi.
 * It is used in three places so the answers can never drift apart:
 *   1. the /faq page,
 *   2. the chat: a typed question that matches an entry is answered with the text below (not made up by the AI), then the chat
 *      repeats the question it was on,
 *   3. the AI interviewer's instructions (faqPromptBlock), so it can also answer a differently-worded version of the same question.
 * NOTE for a native reviewer: the Hindi has not yet been read by a Maithil speaker. Edit the text here and every place changes.
 */
export type FaqLang = "en" | "hi";
type Both = { en: string; hi: string };

export interface Faq {
  id: string;
  group: "gotra" | "app" | "privacy";
  q: Both;
  a: Both;
  /** patterns (English, Hinglish, Devanagari) tested on the lower-cased question; the first entry that matches wins */
  m: RegExp[];
}

export const FAQ_GROUPS: { id: Faq["group"]; title: Both }[] = [
  { id: "gotra", title: { en: "Gotra, mool and the Panji way", hi: "गोत्र, मूल और पंजी की रीति" } },
  { id: "app", title: { en: "Using the app", hi: "ऐप का उपयोग" } },
  { id: "privacy", title: { en: "Your tree and your privacy", hi: "आपकी वंशावली और गोपनीयता" } },
];

const G = "gotra|gotr|gotar|gotro|गोत्र";
const M = "mool|moola|मूल";
const GM = `${G}|${M}`;
/** both a word from `a` and a word from `b` somewhere in the text, in either order */
const both = (a: string, b: string) => new RegExp(`(?:${a}).*(?:${b})|(?:${b}).*(?:${a})`, "i");

const WOMAN = "woman|women|girl|lady|ladies|female|wife|wives|daughter|sister|mother|married|after marriage|shaadi|shadi|vivah|beti|ladki|bahan|patni|bahu|mahila|father'?s|husband'?s|in-?laws?|pita|pati|maike|sasural|महिला|लड़की|बेटी|बहन|पत्नी|बहू|माता|विवाह|शादी|पिता|पति|मायके|ससुराल|विवाहित";
const WHAT = "what is|what's|what does|what are|meaning|mean|explain|define|matlab|kya hai|kya hota|kya hoti|क्या है|क्या होता|क्या होती|मतलब|अर्थ";
const FIND = "where|how|find|know|locate|look up|kahan|kaise|pata|कहाँ|कहां|कैसे|पता|जान|मिल";

export const FAQ: Faq[] = [
  {
    id: "gotra-women", group: "gotra",
    q: { en: "I am a woman (or I am adding a wife, mother, sister or daughter). Should I use my father’s gotra or my husband’s?", hi: "मैं महिला हूँ (या पत्नी, माता, बहन, बेटी को जोड़ रहा/रही हूँ)। पिता का गोत्र लिखूँ या पति का?" },
    a: {
      en: "Please use the father’s gotra — the family you were born into — and the father’s mool. The Panji follows the father’s line, so a daughter stays in her father’s family there. Many families count a wife in her husband’s gotra for puja after marriage; his gotra is already recorded in his own family’s tree. Using the father’s gotra here keeps every record consistent. The same goes for a wife, mother, sister or daughter you add: her father’s gotra and mool.",
      hi: "कृपया पिता का गोत्र (जिस कुल में आपका जन्म हुआ) और पिता का मूल ही लिखिए। पंजी पिता की वंश-परंपरा से चलती है, इसलिए बेटी वहाँ अपने पिता के कुल में ही दर्ज रहती है। कई परिवारों में विवाह के बाद पूजा आदि में स्त्री को पति के गोत्र का माना जाता है; वह गोत्र उसके पति के अपने परिवार की वंशावली में पहले से दर्ज होता है। इसलिए यहाँ पिता का गोत्र लिखने से पूरा रिकॉर्ड एक-सा रहता है। पत्नी, माता, बहन या बेटी के लिए भी उसके पिता का गोत्र और मूल ही मानिए।",
    },
    m: [both(WOMAN, GM)],
  },
  {
    id: "children-gotra", group: "gotra",
    q: { en: "What gotra and mool do the children get?", hi: "बच्चों को कौन-सा गोत्र और मूल मिलता है?" },
    a: {
      en: "Sons and daughters get their father’s gotra and mool, and the app fills them in for you — you do not have to type them again for each child.",
      hi: "बेटे-बेटियों को पिता का गोत्र और मूल मिलता है, और ऐप उन्हें अपने-आप भर देता है — हर बच्चे के लिए दोबारा लिखने की ज़रूरत नहीं।",
    },
    m: [both("child|children|kids|son|sons|bachche|bachhe|बच्चे|बच्चों|बेटे", GM)],
  },
  {
    id: "marriage-check", group: "gotra",
    q: { en: "Does the app tell me whether two families can marry (same gotra, mool)?", hi: "क्या ऐप बताता है कि दो परिवारों में विवाह हो सकता है या नहीं (एक गोत्र, मूल)?" },
    a: {
      en: "No. This app only records a family’s lineage. It does not say whether two families may marry. For that, please ask your elders, your purohit or a panjikar.",
      hi: "नहीं। यह ऐप केवल परिवार की वंशावली दर्ज करता है। दो परिवारों में विवाह हो सकता है या नहीं, यह नहीं बताता। इसके लिए कृपया अपने बड़ों, पुरोहित जी या पंजीकार से पूछिए।",
    },
    m: [/sagotra|same gotra|same mool|one gotra|एक ही गोत्र|समान गोत्र|सगोत्र|एक ही मूल/i, both("marry|marriage|compatib|eligib|rishta|match making|matchmaking|विवाह योग्य|रिश्ता", "app|tool|check|tell|decide|can two|can we|हो सकता|क्या ऐप")],
  },
  {
    id: "not-in-list", group: "gotra",
    q: { en: "My gotra or mool is not in your list. What do I do?", hi: "मेरा गोत्र या मूल आपकी सूची में नहीं है। क्या करूँ?" },
    a: {
      en: "No problem. Type it exactly as your family writes it. It is saved as you typed it and noted as a new entry for the Panji team to review — the reference list came from a single panjikar, so new names are expected.",
      hi: "कोई बात नहीं। इसे ठीक वैसा लिखिए जैसा आपके परिवार में लिखा जाता है। वह वैसा ही दर्ज हो जाएगा और पंजी टीम की समीक्षा के लिए नए नाम के रूप में लिख लिया जाएगा — सूची एक ही पंजीकार से बनी है, इसलिए नए नाम मिलना स्वाभाविक है।",
    },
    m: [both("list|dataset|not found|missing|isn'?t there|not there|not in|doesn'?t (?:show|appear)|nahi mil|नहीं मिल|सूची|नहीं दिख", GM)],
  },
  {
    id: "gotra-vs-mool", group: "gotra",
    q: { en: "What is the difference between gotra and mool?", hi: "गोत्र और मूल में क्या अंतर है?" },
    a: {
      en: "A gotra is the line of an ancient rishi that a family traces itself to; it passes from father to children. A mool is different: it is a lineage named after the family’s ancestral village. Both come from the father, and together they are a family’s Panji identity.",
      hi: "गोत्र उस प्राचीन ऋषि की परंपरा है जिससे परिवार अपनी वंश-धारा जोड़ता है; यह पिता से संतान को मिलता है। मूल इससे अलग है — वह पूर्वजों के गाँव के नाम पर चलने वाली कुल-पहचान है। दोनों पिता से मिलते हैं और साथ मिलकर परिवार की पंजी-पहचान बनाते हैं।",
    },
    m: [both(G, M)],
  },
  {
    id: "gotra-what", group: "gotra",
    q: { en: "What is a gotra?", hi: "गोत्र क्या होता है?" },
    a: {
      en: "A gotra is the line of an ancient rishi that a family traces itself to. It passes from father to children, so a father and all his children share it.",
      hi: "गोत्र उस प्राचीन ऋषि की परंपरा है जिससे परिवार अपनी वंश-धारा जोड़ता है। यह पिता से संतान को मिलता है, इसलिए पिता और उसकी सभी संतानों का गोत्र एक ही होता है।",
    },
    m: [both(WHAT, G)],
  },
  {
    id: "mool-what", group: "gotra",
    q: { en: "What is a mool?", hi: "मूल क्या होता है?" },
    a: {
      en: "A mool is a lineage named after a Maithil family’s ancestral village, for example Sarisaba, Sodarapura or Khandabala. Together with the gotra it is part of the family’s Panji identity. Like the gotra, it comes from the father.",
      hi: "मूल मैथिल परिवार के पूर्वजों के गाँव के नाम पर चलने वाली कुल-पहचान है, जैसे सरिसब, सोदरपुर या खण्डबला। गोत्र के साथ यह परिवार की पंजी-पहचान का हिस्सा है। गोत्र की तरह यह भी पिता से मिलता है।",
    },
    m: [both(WHAT, M)],
  },
  {
    id: "gotra-find", group: "gotra",
    q: { en: "I don’t know my gotra. Where can I find it?", hi: "मुझे अपना गोत्र नहीं पता। कहाँ से पता चलेगा?" },
    a: {
      en: "A gotra is usually written or known in: your Kundli or janam patri, your parents and elders, your family purohit or pandit, or old papers such as a Panji extract or a puja sankalp. Not sure? Tap “I don’t know my gotra” and fill it in later from “Still to fill in”.",
      hi: "गोत्र आमतौर पर यहाँ लिखा या पता मिलता है: आपकी कुंडली या जन्म-पत्री, माता-पिता और परिवार के बड़े-बुज़ुर्ग, कुल के पुरोहित या पंडित जी, या पुराने काग़ज़ जैसे पंजी का उद्धरण या पूजा का संकल्प। पक्का नहीं पता? “मुझे अपना गोत्र नहीं पता” दबाइए और बाद में “अभी भरना बाकी” से भर दीजिए।",
    },
    m: [both(FIND, G)],
  },
  {
    id: "mool-find", group: "gotra",
    q: { en: "I don’t know my mool. Where can I find it?", hi: "मुझे अपना मूल नहीं पता। कहाँ से पता चलेगा?" },
    a: {
      en: "Your mool is tied to your ancestral village. Ask an elder or your purohit, or look at old Panji papers. You can also search Google for your gotra and mool. Not sure? Skip it and fill it in later.",
      hi: "आपका मूल आपके पूर्वजों के गाँव से जुड़ा है। किसी बड़े-बुज़ुर्ग या पुरोहित जी से पूछिए, या पुराने पंजी के काग़ज़ देखिए। आप Google पर अपना गोत्र और मूल भी खोज सकते हैं। पक्का नहीं पता? छोड़ दीजिए और बाद में भर दीजिए।",
    },
    m: [both(FIND, M)],
  },
  {
    id: "women-by-name", group: "gotra",
    q: { en: "Why do you not ask about my wife’s, sister’s or daughter’s family?", hi: "आप पत्नी, बहन या बेटी के परिवार के बारे में क्यों नहीं पूछते?" },
    a: {
      en: "The Panji follows the father’s line. A wife, sister or daughter is recorded by name only. Her own family belongs in her father’s tree, and her husband’s family and children in his tree. This avoids writing the same people twice. When both families have trees here, the app can connect them through her.",
      hi: "पंजी पिता की वंश-परंपरा से चलती है। पत्नी, बहन या बेटी का केवल नाम दर्ज होता है। उसका अपना परिवार उसके पिता की वंशावली में होता है, और उसके पति का परिवार व बच्चे पति की वंशावली में। इससे एक ही लोग दो जगह नहीं लिखे जाते। जब दोनों परिवारों की वंशावली यहाँ बन जाती है, तो ऐप उसी महिला के सहारे दोनों को जोड़ सकता है।",
    },
    m: [both("why|kyon|kyu|kyun|क्यों|क्यूँ", "wife|wives|sister|daughter|woman|women|in-?laws?|husband|parents|bahan|beti|patni|पत्नी|बहन|बेटी|पति|ससुराल|मायके|माता-पिता")],
  },
  {
    id: "mothers-side", group: "gotra",
    q: { en: "What about my mother’s side (nana, mama, maternal relatives)?", hi: "मेरे ननिहाल (नाना, मामा) की तरफ़ का क्या?" },
    a: {
      en: "Your mother’s side belongs to her father’s family tree, so it is not asked here. If that family also builds a tree, the app can connect the two through your mother.",
      hi: "ननिहाल की तरफ़ का परिवार आपकी माता के पिता की वंशावली में आता है, इसलिए यहाँ नहीं पूछा जाता। अगर वह परिवार भी वंशावली बनाए, तो ऐप आपकी माता के सहारे दोनों को जोड़ सकता है।",
    },
    m: [/mother'?s side|maternal|nanihal|nana|nani|mama\b|mausi|mother'?s (?:family|father|parents|relatives)|नाना|नानी|ननिहाल|मामा|मौसी|माता के (?:परिवार|पिता|मायके)|माँ की तरफ़|माँ की तरफ/i],
  },
  {
    id: "skip", group: "app",
    q: { en: "I don’t know some answers. Can I skip?", hi: "मुझे कुछ उत्तर नहीं पता। क्या छोड़ सकता/सकती हूँ?" },
    a: {
      en: "Yes. Almost every question can be skipped — say “skip” or “I don’t know”. A tree with a few gaps is better than none. You can fill the gaps later from “Still to fill in”.",
      hi: "हाँ। लगभग हर प्रश्न छोड़ा जा सकता है — “छोड़ें” या “पता नहीं” कहिए। कुछ खाली जगहों वाली वंशावली भी न होने से बेहतर है। खाली जगहें बाद में “अभी भरना बाकी” से भरी जा सकती हैं।",
    },
    m: [/skip|don'?t know|do not know|not sure|unsure|forgot|don'?t remember|pata nahi|yaad nahi|छोड़|पता नहीं|याद नहीं|भूल/i],
  },
  {
    id: "dates", group: "app",
    q: { en: "Do I need the exact date of birth?", hi: "क्या जन्म-तिथि बिल्कुल सही चाहिए?" },
    a: {
      en: "No. The year alone is fine. If you only know roughly, give the year you think is closest, or skip. The full date is best when you have it.",
      hi: "नहीं। केवल साल भी चलेगा। अगर अंदाज़ा ही है तो सबसे नज़दीकी साल लिख दीजिए, या छोड़ दीजिए। पूरी तारीख़ हो तो सबसे अच्छा।",
    },
    m: [both("date|year|birth|dob|janm|tarikh|तारीख|जन्म|साल|वर्ष", "exact|approx|roughly|only year|just year|exactly|सही|अंदाज़|अंदाज|बिल्कुल")],
  },
  {
    id: "language", group: "app",
    q: { en: "Can I type in Hindi or Hinglish? Is there Maithili?", hi: "क्या मैं हिन्दी या हिंग्लिश में लिख सकता/सकती हूँ? क्या मैथिली है?" },
    a: {
      en: "Yes — type in English, Hindi (Devanagari) or Hinglish; names get their Devanagari spelling automatically. Use the language button at the top to see the questions in Hindi. Maithili is not available yet.",
      hi: "हाँ — अंग्रेज़ी, हिन्दी (देवनागरी) या हिंग्लिश में लिखिए; नामों की देवनागरी वर्तनी अपने-आप भर जाती है। प्रश्न हिन्दी में देखने के लिए ऊपर भाषा का बटन दबाइए। मैथिली अभी उपलब्ध नहीं है।",
    },
    m: [/hindi|devanagari|hinglish|maithili|language|bhasha|हिंदी|हिन्दी|देवनागरी|मैथिली|भाषा|हिंग्लिश/i],
  },
  {
    id: "correct", group: "app",
    q: { en: "I made a mistake. How do I correct it?", hi: "मुझसे ग़लती हो गई। कैसे सुधारूँ?" },
    a: {
      en: "Tap the person in the tree to correct anything, add a photo or remove them. To fix an earlier answer, reply to that chat message (right-click, or long-press on a phone). “Undo my last answer” takes back the last step.",
      hi: "वंशावली में उस व्यक्ति पर दबाइए — वहाँ कुछ भी सुधार सकते हैं, फ़ोटो जोड़ सकते हैं या उन्हें हटा सकते हैं। पिछला उत्तर बदलने के लिए चैट के उसी संदेश का उत्तर दीजिए (कंप्यूटर पर राइट-क्लिक, फ़ोन पर देर तक दबाइए)। “मेरा पिछला उत्तर वापस लीजिए” आख़िरी चरण वापस ले लेता है।",
    },
    m: [/correct|edit|fix|wrong|mistake|undo|delete|remove|change (?:the|a|my|his|her)|galti|ghalat|सुधार|ग़लत|गलत|बदल|हटा|मिटा/i],
  },
  {
    id: "share", group: "app",
    q: { en: "How do I invite relatives or show the tree to family?", hi: "रिश्तेदारों को कैसे बुलाऊँ या वंशावली परिवार को कैसे दिखाऊँ?" },
    a: {
      en: "Use the Share button. You can invite relatives from other households on WhatsApp so they add their own branches, or send a view-only link or picture to show the tree. Nothing is shared until you do it.",
      hi: "“Share” बटन का उपयोग कीजिए। दूसरे घरों के रिश्तेदारों को WhatsApp पर बुला सकते हैं ताकि वे अपनी शाखाएँ जोड़ें, या वंशावली दिखाने के लिए “सिर्फ़ देखने वाला” लिंक या चित्र भेज सकते हैं। जब तक आप ख़ुद न करें, कुछ भी साझा नहीं होता।",
    },
    m: [/invite|share|relatives?|rishtedar|whatsapp|family members?|send the tree|show the tree|रिश्तेदार|साझा|शेयर|बुला/i],
  },
  {
    id: "pdf", group: "app",
    q: { en: "How do I download or print the family tree?", hi: "वंशावली डाउनलोड या प्रिंट कैसे करूँ?" },
    a: {
      en: "When the interview is done, tap Download. You get a PDF — the whole family chart or just your own line, from A4 up to a poster — and an Excel list of everyone in the tree.",
      hi: "प्रश्न पूरे होने पर “Download” दबाइए। आपको PDF मिलेगा — पूरा परिवार-चार्ट या केवल आपकी अपनी वंश-रेखा, A4 से लेकर पोस्टर तक — और पूरे परिवार की एक Excel सूची।",
    },
    m: [/pdf|print|download|poster|excel|डाउनलोड|प्रिंट|पोस्टर/i],
  },
  {
    id: "lose-data", group: "app",
    q: { en: "Will I lose my tree?", hi: "क्या मेरी वंशावली खो जाएगी?" },
    a: {
      en: "Until you save it online, the tree lives only on this phone or computer, so clearing the browser’s data could remove it. Sign in with your email or Google and choose to save it online to keep it safe and open it from any phone.",
      hi: "जब तक आप इसे ऑनलाइन सेव नहीं करते, वंशावली सिर्फ़ इसी फ़ोन या कंप्यूटर में रहती है, इसलिए ब्राउज़र का डेटा मिटाने से यह जा सकती है। अपने ईमेल या Google से साइन-इन करके ऑनलाइन सेव कर लीजिए — तब यह सुरक्षित रहेगी और किसी भी फ़ोन से खुल जाएगी।",
    },
    m: [/\blose\b|\blost\b|saved|save|clear(?:ing)? (?:the )?(?:browser|data|cache)|safe online|खो|सेव|सहेज|खत्म/i],
  },
  {
    id: "cost", group: "app",
    q: { en: "Is it free?", hi: "क्या यह मुफ़्त है?" },
    a: {
      en: "Yes, building your tree is free. When you download, there is an optional contribution to support the project; you can always skip it.",
      hi: "हाँ, वंशावली बनाना मुफ़्त है। डाउनलोड करते समय परियोजना की मदद के लिए वैकल्पिक योगदान का विकल्प आता है; आप उसे हमेशा छोड़ सकते हैं।",
    },
    m: [/\bfree\b|cost|price|charge|fee\b|paid|donat|contribut|how much|मुफ़्त|मुफ्त|फ्री|शुल्क|दान|कितने पैसे|पैसे/i],
  },
  {
    id: "what-panji", group: "app",
    q: { en: "What is a Panji, and what is PAAG Foundation?", hi: "पंजी क्या है, और PAAG Foundation क्या है?" },
    a: {
      en: "A Panji is the traditional genealogical record of Maithil families, kept by panjikars. PAAG Foundation (Panji Ancestry & Graph) helps families record their lineage in that tradition. The paag is the cap worn in Mithila as a mark of honour.",
      hi: "पंजी मैथिल परिवारों की परंपरागत वंश-वृत्तांत की पोथी है, जिसे पंजीकार रखते हैं। PAAG Foundation (Panji Ancestry & Graph) परिवारों को उसी परंपरा में अपनी वंशावली दर्ज करने में मदद करता है। पाग मिथिला में सम्मान के प्रतीक के रूप में पहनी जाने वाली टोपी है।",
    },
    m: [both("panji|panjikar|paag|foundation|पंजी|पञ्जी|पंजीकार|पाग|who are you|who made|about", "what|who|meaning|mean|kya|kaun|क्या|कौन|मतलब")],
  },
  {
    id: "privacy", group: "privacy",
    q: { en: "Is my family information private and safe?", hi: "क्या मेरे परिवार की जानकारी निजी और सुरक्षित है?" },
    a: {
      en: "Your tree is yours. Until you choose to save it online it stays on your own phone or computer. We do not sell data or show advertising. View-only links never show phone numbers. You can delete your online copy at any time. Details are on the Privacy page.",
      hi: "आपकी वंशावली आपकी है। जब तक आप ऑनलाइन सेव नहीं चुनते, वह सिर्फ़ आपके फ़ोन या कंप्यूटर में रहती है। हम जानकारी बेचते नहीं और विज्ञापन नहीं दिखाते। “सिर्फ़ देखने वाले” लिंक में फ़ोन नंबर कभी नहीं दिखते। आप जब चाहें अपनी ऑनलाइन प्रति मिटा सकते हैं। पूरा ब्योरा “Privacy” पृष्ठ पर है।",
    },
    m: [/private|privacy|safe|secure|who can see|who sees|visible|my data|sell|surakshit|सुरक्षित|कौन देख|गोपनीय|निजी|डेटा/i],
  },
];

/* ───────────────────────── recognising a question ───────────────────────── */

const QUESTION_WORD = /\b(?:what|why|how|which|whose|who|where|should|shall|can|could|may|do|does|did|is|are|am|will|would|or|kya|kyon|kyun|kaise|kaun|kis|kisse|kitna|kahan|kaunsa|konsa|ya)\b|क्या|क्यों|कैसे|कौन|किस|कहाँ|कहां|चाहिए|चाहिये|सकता|सकती|या/i;
const STARTS_LIKE_QUESTION = /^(?:what|why|how|which|whose|who|where|should|shall|can|could|do|does|is|are|will|would|kya|kyon|kyun|kaise|kaun|kis|kahan|kaunsa|konsa)(?:\s|$)|^(?:क्या|क्यों|कैसे|कौन|किस|कहाँ|कहां)/i;

/** does this look like a question (not an answer such as a gotra, a name or a place)? */
export function isQuestion(text: string): boolean {
  const t = text.trim();
  if (t.length < 6 || t.length > 300) return false;
  const mark = /[?？]/.test(t);
  if (mark) return QUESTION_WORD.test(t) || /[ऀ-ॿ]/.test(t);
  return STARTS_LIKE_QUESTION.test(t) && t.split(/\s+/).length >= 3;
}

/** the entry that answers a typed question, or null. Only questions are matched, so names, gotras and places typed as answers are never taken for one. */
export function faqMatch(text: string): Faq | null {
  if (!isQuestion(text)) return null;
  const t = text.toLowerCase().replace(/[’‘]/g, "'");
  return FAQ.find((f) => f.m.some((rx) => rx.test(t))) ?? null;
}

export const faqAnswer = (f: Faq, lang: FaqLang) => f.a[lang];
export const faqById = (id: string) => FAQ.find((f) => f.id === id);

/** the same answers for the AI interviewer's instructions (English; it answers in the user's language) */
export const faqPromptBlock = () => FAQ.map((f) => `Q: ${f.q.en}\nA: ${f.a.en}`).join("\n\n");

/** a tappable chat suggestion shown under the gotra / mool question for women (what it SENDS is matched by the entry above) */
export const WOMAN_GOTRA_QUICK = "Why father’s gotra?";
