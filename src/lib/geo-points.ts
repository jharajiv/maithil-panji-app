/**
 * Where a place name is on the map — at the level of a city, a Bihar district, a state or a country. Never a street, never a village's exact spot:
 * "Where we are today" is meant to show how far a family has spread, and a living relative must not be locatable from a shared picture.
 * Every row: names (separated by |, lower case, no accents), latitude, longitude.
 */
type Row = [string, number, number];

/** countries (centre of the country) */
export const COUNTRIES: Row[] = [
  ["india|bharat", 22.5, 79], ["nepal", 28.2, 84.1], ["bangladesh", 23.8, 90.3], ["pakistan", 30.4, 69.3], ["sri lanka", 7.6, 80.7], ["bhutan", 27.4, 90.4],
  ["united states|usa|us|u.s.a|u.s.|america|united states of america", 39.8, -98.6], ["canada", 56.1, -106.3], ["mexico", 23.6, -102.5],
  ["united kingdom|uk|u.k.|england|britain|great britain|scotland|wales", 54.0, -2.5], ["ireland", 53.2, -8.1], ["germany|deutschland", 51.2, 10.4], ["france", 46.6, 2.5],
  ["switzerland|schweiz|suisse", 46.8, 8.2], ["netherlands|holland", 52.2, 5.3], ["belgium", 50.6, 4.7], ["italy", 42.8, 12.6], ["spain", 40.2, -3.6], ["portugal", 39.6, -8.0],
  ["sweden", 62.0, 15.0], ["norway", 61.0, 8.7], ["denmark", 56.0, 10.0], ["finland", 64.0, 26.0], ["austria", 47.6, 14.1], ["poland", 52.1, 19.4], ["russia", 60.0, 90.0],
  ["united arab emirates|uae|u.a.e|emirates", 24.3, 54.3], ["saudi arabia|ksa", 24.0, 45.0], ["qatar", 25.3, 51.2], ["kuwait", 29.3, 47.6], ["oman", 21.0, 57.0], ["bahrain", 26.0, 50.5],
  ["singapore", 1.35, 103.82], ["malaysia", 4.2, 102.0], ["thailand", 15.0, 101.0], ["indonesia", -2.5, 118.0], ["japan", 36.2, 138.2], ["south korea|korea", 36.5, 127.9], ["china", 35.0, 103.0], ["hong kong", 22.3, 114.2],
  ["australia", -25.3, 134.0], ["new zealand", -41.0, 174.0], ["south africa", -29.0, 24.0], ["kenya", 0.2, 37.9], ["nigeria", 9.1, 8.7], ["mauritius", -20.3, 57.6], ["fiji", -17.7, 178.0],
  ["trinidad and tobago|trinidad", 10.5, -61.3], ["guyana", 4.9, -58.9], ["suriname", 3.9, -56.0], ["brazil", -10.0, -52.0], ["argentina", -34.0, -64.0], ["turkey", 39.0, 35.0], ["israel", 31.5, 34.9], ["egypt", 26.8, 30.8],
];

/** Indian states and union territories (centre of the state) */
export const STATES: Row[] = [
  ["bihar", 25.6, 85.6], ["jharkhand", 23.6, 85.3], ["uttar pradesh|up", 26.8, 80.9], ["west bengal", 23.0, 87.9], ["odisha|orissa", 20.5, 84.5], ["delhi|new delhi|nct of delhi|ncr", 28.61, 77.21],
  ["maharashtra", 19.5, 76.0], ["gujarat", 22.3, 71.7], ["rajasthan", 26.6, 73.8], ["madhya pradesh|mp", 23.5, 78.5], ["chhattisgarh", 21.3, 81.9], ["haryana", 29.0, 76.1], ["punjab", 31.0, 75.3],
  ["himachal pradesh", 31.9, 77.2], ["uttarakhand|uttaranchal", 30.1, 79.2], ["jammu and kashmir|j&k|jammu", 33.7, 76.5], ["ladakh", 34.2, 77.6], ["chandigarh", 30.73, 76.78],
  ["karnataka", 14.5, 75.7], ["tamil nadu", 11.0, 78.4], ["kerala", 10.5, 76.5], ["andhra pradesh", 15.9, 79.7], ["telangana", 17.9, 79.0], ["goa", 15.3, 74.0], ["puducherry|pondicherry", 11.9, 79.8],
  ["assam", 26.4, 92.9], ["meghalaya", 25.5, 91.4], ["manipur", 24.7, 93.9], ["mizoram", 23.2, 92.8], ["nagaland", 26.1, 94.5], ["tripura", 23.8, 91.7], ["arunachal pradesh", 28.0, 94.7], ["sikkim", 27.6, 88.5],
  ["andaman and nicobar islands|andaman", 11.7, 92.7],
];

/** the 38 districts of Bihar (the HQ town) — most Maithil families start here */
export const BIHAR: Row[] = [
  ["madhubani", 26.35, 86.07], ["darbhanga", 26.15, 85.9], ["samastipur", 25.86, 85.78], ["sitamarhi", 26.59, 85.49], ["muzaffarpur", 26.12, 85.39], ["supaul", 26.12, 86.6], ["saharsa", 25.88, 86.6],
  ["madhepura", 25.92, 86.79], ["araria", 26.15, 87.47], ["purnia|purnea", 25.78, 87.47], ["katihar", 25.54, 87.57], ["kishanganj", 26.1, 87.95], ["begusarai", 25.42, 86.13], ["khagaria", 25.5, 86.47],
  ["vaishali|hajipur", 25.69, 85.21], ["sheohar", 26.52, 85.3], ["east champaran|motihari|purvi champaran", 26.65, 84.92], ["west champaran|bettiah|paschim champaran", 27.0, 84.5], ["gopalganj", 26.47, 84.44],
  ["siwan", 26.22, 84.36], ["saran|chapra", 25.78, 84.75], ["patna", 25.6, 85.14], ["nalanda|bihar sharif", 25.2, 85.52], ["bhojpur|arrah", 25.56, 84.66], ["buxar", 25.57, 83.98], ["rohtas|sasaram", 24.95, 84.03],
  ["kaimur|bhabua", 25.04, 83.61], ["gaya", 24.8, 85.0], ["jehanabad", 25.21, 84.99], ["arwal", 25.25, 84.67], ["aurangabad", 24.75, 84.37], ["nawada", 24.88, 85.54], ["sheikhpura", 25.14, 85.84],
  ["lakhisarai", 25.17, 86.1], ["munger|monghyr", 25.38, 86.47], ["jamui", 24.92, 86.22], ["bhagalpur", 25.24, 87.0], ["banka", 24.89, 86.92],
];

/** cities (India first, then where Maithil families live around the world) */
export const CITIES: Row[] = [
  ["kolkata|calcutta", 22.57, 88.36], ["mumbai|bombay|navi mumbai|thane", 19.08, 72.88], ["pune", 18.52, 73.86], ["nagpur", 21.15, 79.09], ["bengaluru|bangalore", 12.97, 77.59], ["hyderabad|secunderabad", 17.39, 78.49],
  ["chennai|madras", 13.08, 80.27], ["ahmedabad", 23.02, 72.57], ["surat", 21.17, 72.83], ["vadodara|baroda", 22.31, 73.18], ["jaipur", 26.91, 75.79], ["lucknow", 26.85, 80.95], ["kanpur", 26.45, 80.33],
  ["varanasi|banaras|kashi", 25.32, 83.01], ["prayagraj|allahabad", 25.44, 81.85], ["gorakhpur", 26.76, 83.37], ["noida|greater noida", 28.54, 77.39], ["gurgaon|gurugram", 28.46, 77.03], ["ghaziabad", 28.67, 77.42],
  ["faridabad", 28.41, 77.31], ["chandigarh", 30.73, 76.78], ["dehradun", 30.32, 78.03], ["bhopal", 23.26, 77.41], ["indore", 22.72, 75.86], ["raipur", 21.25, 81.63], ["ranchi", 23.34, 85.31],
  ["jamshedpur", 22.8, 86.2], ["dhanbad", 23.8, 86.43], ["bokaro", 23.67, 86.15], ["deoghar", 24.48, 86.7], ["bhubaneswar", 20.3, 85.82], ["guwahati", 26.14, 91.74], ["visakhapatnam|vizag", 17.69, 83.22],
  ["kochi|cochin", 9.93, 76.27], ["thiruvananthapuram|trivandrum", 8.52, 76.94], ["coimbatore", 11.0, 76.96], ["mysuru|mysore", 12.3, 76.65], ["goa|panaji", 15.5, 73.83], ["jamnagar", 22.47, 70.07],
  ["kota", 25.18, 75.84], ["jodhpur", 26.24, 73.02], ["amritsar", 31.63, 74.87], ["ludhiana", 30.9, 75.86], ["shimla", 31.1, 77.17], ["srinagar", 34.08, 74.8], ["patna", 25.6, 85.14],
  ["dubai", 25.2, 55.27], ["abu dhabi", 24.45, 54.38], ["sharjah", 25.35, 55.4], ["doha", 25.29, 51.53], ["riyadh", 24.71, 46.68], ["jeddah", 21.54, 39.17], ["kuwait city", 29.38, 47.99], ["muscat", 23.59, 58.41], ["manama", 26.23, 50.59],
  ["london", 51.51, -0.13], ["manchester", 53.48, -2.24], ["birmingham", 52.49, -1.89], ["leicester", 52.64, -1.13], ["edinburgh", 55.95, -3.19], ["dublin", 53.35, -6.26],
  ["zurich|zürich|opfikon|zuerich", 47.38, 8.54], ["geneva|geneve", 46.2, 6.14], ["basel", 47.56, 7.59], ["berlin", 52.52, 13.4], ["munich|muenchen", 48.14, 11.58], ["frankfurt", 50.11, 8.68], ["hamburg", 53.55, 9.99], ["stuttgart", 48.78, 9.18],
  ["paris", 48.86, 2.35], ["amsterdam", 52.37, 4.9], ["brussels", 50.85, 4.35], ["vienna", 48.21, 16.37], ["milan", 45.46, 9.19], ["rome", 41.9, 12.5], ["madrid", 40.42, -3.7], ["barcelona", 41.39, 2.17], ["stockholm", 59.33, 18.07],
  ["copenhagen", 55.68, 12.57], ["oslo", 59.91, 10.75], ["helsinki", 60.17, 24.94], ["warsaw", 52.23, 21.01], ["moscow", 55.76, 37.62],
  ["new york|nyc|new jersey|jersey city|edison", 40.71, -74.01], ["washington|washington dc|dc", 38.9, -77.04], ["boston", 42.36, -71.06], ["philadelphia", 39.95, -75.17], ["atlanta", 33.75, -84.39], ["miami", 25.76, -80.19],
  ["chicago", 41.88, -87.63], ["detroit", 42.33, -83.05], ["houston", 29.76, -95.37], ["dallas", 32.78, -96.8], ["austin", 30.27, -97.74], ["denver", 39.74, -104.99], ["seattle", 47.61, -122.33],
  ["san francisco|bay area|san jose|sunnyvale|fremont|santa clara|mountain view|palo alto", 37.55, -122.1], ["los angeles|la", 34.05, -118.24], ["san diego", 32.72, -117.16], ["phoenix", 33.45, -112.07], ["charlotte", 35.23, -80.84], ["raleigh", 35.78, -78.64],
  ["toronto|mississauga|brampton", 43.65, -79.38], ["vancouver", 49.28, -123.12], ["montreal", 45.5, -73.57], ["calgary", 51.05, -114.07], ["ottawa", 45.42, -75.7],
  ["sydney", -33.87, 151.21], ["melbourne", -37.81, 144.96], ["brisbane", -27.47, 153.03], ["perth", -31.95, 115.86], ["canberra", -35.28, 149.13], ["auckland", -36.85, 174.76], ["wellington", -41.29, 174.78],
  ["singapore", 1.35, 103.82], ["kuala lumpur", 3.14, 101.69], ["bangkok", 13.76, 100.5], ["jakarta", -6.2, 106.85], ["tokyo", 35.68, 139.69], ["seoul", 37.57, 126.98], ["shanghai", 31.23, 121.47], ["beijing", 39.9, 116.4], ["hong kong", 22.3, 114.17],
  ["kathmandu", 27.7, 85.32], ["janakpur|janakpurdham", 26.73, 85.93], ["biratnagar", 26.45, 87.28], ["birgunj", 27.01, 84.88], ["dhaka", 23.81, 90.41], ["colombo", 6.93, 79.86], ["karachi", 24.86, 67.0], ["lahore", 31.55, 74.34],
  ["johannesburg", -26.2, 28.05], ["cape town", -33.92, 18.42], ["nairobi", -1.29, 36.82], ["lagos", 6.52, 3.38], ["port louis", -20.16, 57.5], ["toronto", 43.65, -79.38],
];

/** lower case, no accents, no punctuation, one space between words */
export const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9& ]+/g, " ").replace(/\s+/g, " ").trim();

type Index = Map<string, { label: string; lat: number; lon: number }>;
const build = (rows: Row[]): Index => {
  const m: Index = new Map();
  for (const [names, lat, lon] of rows) {
    const list = names.split("|");
    const label = list[0]!.replace(/\b\w/g, (c) => c.toUpperCase());
    for (const n of list) if (!m.has(plain(n))) m.set(plain(n), { label, lat, lon });
  }
  return m;
};
const idx = { city: build(CITIES), district: build(BIHAR), state: build(STATES), country: build(COUNTRIES) };

export type GeoLevel = "city" | "district" | "state" | "country";
export interface GeoHit { key: string; label: string; lat: number; lon: number; level: GeoLevel }

/** the words a place was written with: "Jaynagar, Madhubani District, Bihar" → ["jaynagar", "madhubani", "bihar"] */
const tokens = (place: string) => place.split(/[,;/\n]| - | – /).map((t) => plain(t).replace(/\b(district|dist|zila|city|town|division)\b/g, "").replace(/\s+/g, " ").trim()).filter(Boolean);

/** the most precise level we know for a written place, or null when none of its words is known */
export function locate(place: string | undefined): GeoHit | null {
  if (!place) return null;
  const ts = tokens(place);
  if (!ts.length) return null;
  for (const level of ["city", "district", "state", "country"] as const) {
    // later words (state, country) are the more reliable ones, but a city anywhere in the text wins over a state
    for (const t of level === "city" ? ts : [...ts].reverse()) {
      const h = idx[level].get(t);
      if (h) return { key: `${level}:${plain(h.label)}`, label: h.label, lat: h.lat, lon: h.lon, level };
    }
  }
  return null;
}
