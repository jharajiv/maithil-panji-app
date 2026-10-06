import { searchMools, searchGotras, searchVillages, classify, plainRoman } from "../src/lib/lookup";
const t = (q: string, f: (q: string) => any) => { const h = f(q); console.log(q.padEnd(14), classify(h).status.padEnd(9), h.slice(0, 3).map((x: any) => `${plainRoman(x.item.roman)}(${x.score.toFixed(2)})`).join(", ")); };
for (const q of ["sarisab", "Sarisaba", "सरिसब", "sodarpur", "khandbala", "Dirdhosh", "mahua", "pali", "xyzq"]) t(q, (x) => searchMools(x));
for (const q of ["kashyap", "Shandilya", "bharadwaj", "vats", "savarna", "katyayan", "gautam", "kaushik"]) t(q, searchGotras);
for (const q of ["karion", "madhepur", "benipatti"]) t(q, searchVillages);
