// Static metadata for the 66-book Protestant canon. book_id 1..66, Gen=1 ... Rev=66,
// matching the WEB source's `nr` field exactly (verified during ingest).
//
// osisId follows the OSIS book-abbreviation convention (also what OpenBible's
// cross-reference dataset mostly uses, mapped explicitly in xref-book-map.ts).

export type Testament = "OT" | "NT";

export interface BookMeta {
  bookId: number;
  osisId: string;
  name: string;
  abbreviation: string;
  testament: Testament;
  canonSection: string;
  genre: string[];
  chapterCount: number;
}

// chapterCount is filled in from the WEB source at ingest time (source of truth),
// not hardcoded here — see ingest.ts. This table supplies everything else.
export const BOOKS: Omit<BookMeta, "chapterCount">[] = [
  { bookId: 1, osisId: "Gen", name: "Genesis", abbreviation: "Gen", testament: "OT", canonSection: "Torah", genre: ["law", "narrative"] },
  { bookId: 2, osisId: "Exod", name: "Exodus", abbreviation: "Exod", testament: "OT", canonSection: "Torah", genre: ["law", "narrative"] },
  { bookId: 3, osisId: "Lev", name: "Leviticus", abbreviation: "Lev", testament: "OT", canonSection: "Torah", genre: ["law"] },
  { bookId: 4, osisId: "Num", name: "Numbers", abbreviation: "Num", testament: "OT", canonSection: "Torah", genre: ["law", "narrative"] },
  { bookId: 5, osisId: "Deut", name: "Deuteronomy", abbreviation: "Deut", testament: "OT", canonSection: "Torah", genre: ["law"] },
  { bookId: 6, osisId: "Josh", name: "Joshua", abbreviation: "Josh", testament: "OT", canonSection: "Historical", genre: ["narrative"] },
  { bookId: 7, osisId: "Judg", name: "Judges", abbreviation: "Judg", testament: "OT", canonSection: "Historical", genre: ["narrative"] },
  { bookId: 8, osisId: "Ruth", name: "Ruth", abbreviation: "Ruth", testament: "OT", canonSection: "Historical", genre: ["narrative"] },
  { bookId: 9, osisId: "1Sam", name: "1 Samuel", abbreviation: "1 Sam", testament: "OT", canonSection: "Historical", genre: ["narrative"] },
  { bookId: 10, osisId: "2Sam", name: "2 Samuel", abbreviation: "2 Sam", testament: "OT", canonSection: "Historical", genre: ["narrative"] },
  { bookId: 11, osisId: "1Kgs", name: "1 Kings", abbreviation: "1 Kgs", testament: "OT", canonSection: "Historical", genre: ["narrative"] },
  { bookId: 12, osisId: "2Kgs", name: "2 Kings", abbreviation: "2 Kgs", testament: "OT", canonSection: "Historical", genre: ["narrative"] },
  { bookId: 13, osisId: "1Chr", name: "1 Chronicles", abbreviation: "1 Chr", testament: "OT", canonSection: "Historical", genre: ["narrative"] },
  { bookId: 14, osisId: "2Chr", name: "2 Chronicles", abbreviation: "2 Chr", testament: "OT", canonSection: "Historical", genre: ["narrative"] },
  { bookId: 15, osisId: "Ezra", name: "Ezra", abbreviation: "Ezra", testament: "OT", canonSection: "Historical", genre: ["narrative"] },
  { bookId: 16, osisId: "Neh", name: "Nehemiah", abbreviation: "Neh", testament: "OT", canonSection: "Historical", genre: ["narrative"] },
  { bookId: 17, osisId: "Esth", name: "Esther", abbreviation: "Esth", testament: "OT", canonSection: "Historical", genre: ["narrative"] },
  { bookId: 18, osisId: "Job", name: "Job", abbreviation: "Job", testament: "OT", canonSection: "Wisdom", genre: ["poetry", "wisdom"] },
  { bookId: 19, osisId: "Ps", name: "Psalms", abbreviation: "Ps", testament: "OT", canonSection: "Wisdom", genre: ["poetry"] },
  { bookId: 20, osisId: "Prov", name: "Proverbs", abbreviation: "Prov", testament: "OT", canonSection: "Wisdom", genre: ["wisdom"] },
  { bookId: 21, osisId: "Eccl", name: "Ecclesiastes", abbreviation: "Eccl", testament: "OT", canonSection: "Wisdom", genre: ["wisdom"] },
  { bookId: 22, osisId: "Song", name: "Song of Songs", abbreviation: "Song", testament: "OT", canonSection: "Wisdom", genre: ["poetry"] },
  { bookId: 23, osisId: "Isa", name: "Isaiah", abbreviation: "Isa", testament: "OT", canonSection: "Prophets", genre: ["prophecy"] },
  { bookId: 24, osisId: "Jer", name: "Jeremiah", abbreviation: "Jer", testament: "OT", canonSection: "Prophets", genre: ["prophecy"] },
  { bookId: 25, osisId: "Lam", name: "Lamentations", abbreviation: "Lam", testament: "OT", canonSection: "Prophets", genre: ["poetry"] },
  { bookId: 26, osisId: "Ezek", name: "Ezekiel", abbreviation: "Ezek", testament: "OT", canonSection: "Prophets", genre: ["prophecy"] },
  { bookId: 27, osisId: "Dan", name: "Daniel", abbreviation: "Dan", testament: "OT", canonSection: "Prophets", genre: ["prophecy", "narrative"] },
  { bookId: 28, osisId: "Hos", name: "Hosea", abbreviation: "Hos", testament: "OT", canonSection: "Prophets", genre: ["prophecy"] },
  { bookId: 29, osisId: "Joel", name: "Joel", abbreviation: "Joel", testament: "OT", canonSection: "Prophets", genre: ["prophecy"] },
  { bookId: 30, osisId: "Amos", name: "Amos", abbreviation: "Amos", testament: "OT", canonSection: "Prophets", genre: ["prophecy"] },
  { bookId: 31, osisId: "Obad", name: "Obadiah", abbreviation: "Obad", testament: "OT", canonSection: "Prophets", genre: ["prophecy"] },
  { bookId: 32, osisId: "Jonah", name: "Jonah", abbreviation: "Jonah", testament: "OT", canonSection: "Prophets", genre: ["prophecy", "narrative"] },
  { bookId: 33, osisId: "Mic", name: "Micah", abbreviation: "Mic", testament: "OT", canonSection: "Prophets", genre: ["prophecy"] },
  { bookId: 34, osisId: "Nah", name: "Nahum", abbreviation: "Nah", testament: "OT", canonSection: "Prophets", genre: ["prophecy"] },
  { bookId: 35, osisId: "Hab", name: "Habakkuk", abbreviation: "Hab", testament: "OT", canonSection: "Prophets", genre: ["prophecy"] },
  { bookId: 36, osisId: "Zeph", name: "Zephaniah", abbreviation: "Zeph", testament: "OT", canonSection: "Prophets", genre: ["prophecy"] },
  { bookId: 37, osisId: "Hag", name: "Haggai", abbreviation: "Hag", testament: "OT", canonSection: "Prophets", genre: ["prophecy"] },
  { bookId: 38, osisId: "Zech", name: "Zechariah", abbreviation: "Zech", testament: "OT", canonSection: "Prophets", genre: ["prophecy"] },
  { bookId: 39, osisId: "Mal", name: "Malachi", abbreviation: "Mal", testament: "OT", canonSection: "Prophets", genre: ["prophecy"] },
  { bookId: 40, osisId: "Matt", name: "Matthew", abbreviation: "Matt", testament: "NT", canonSection: "Gospels", genre: ["narrative"] },
  { bookId: 41, osisId: "Mark", name: "Mark", abbreviation: "Mark", testament: "NT", canonSection: "Gospels", genre: ["narrative"] },
  { bookId: 42, osisId: "Luke", name: "Luke", abbreviation: "Luke", testament: "NT", canonSection: "Gospels", genre: ["narrative"] },
  { bookId: 43, osisId: "John", name: "John", abbreviation: "John", testament: "NT", canonSection: "Gospels", genre: ["narrative"] },
  { bookId: 44, osisId: "Acts", name: "Acts", abbreviation: "Acts", testament: "NT", canonSection: "Historical", genre: ["narrative"] },
  { bookId: 45, osisId: "Rom", name: "Romans", abbreviation: "Rom", testament: "NT", canonSection: "Pauline", genre: ["epistle"] },
  { bookId: 46, osisId: "1Cor", name: "1 Corinthians", abbreviation: "1 Cor", testament: "NT", canonSection: "Pauline", genre: ["epistle"] },
  { bookId: 47, osisId: "2Cor", name: "2 Corinthians", abbreviation: "2 Cor", testament: "NT", canonSection: "Pauline", genre: ["epistle"] },
  { bookId: 48, osisId: "Gal", name: "Galatians", abbreviation: "Gal", testament: "NT", canonSection: "Pauline", genre: ["epistle"] },
  { bookId: 49, osisId: "Eph", name: "Ephesians", abbreviation: "Eph", testament: "NT", canonSection: "Pauline", genre: ["epistle"] },
  { bookId: 50, osisId: "Phil", name: "Philippians", abbreviation: "Phil", testament: "NT", canonSection: "Pauline", genre: ["epistle"] },
  { bookId: 51, osisId: "Col", name: "Colossians", abbreviation: "Col", testament: "NT", canonSection: "Pauline", genre: ["epistle"] },
  { bookId: 52, osisId: "1Thess", name: "1 Thessalonians", abbreviation: "1 Thess", testament: "NT", canonSection: "Pauline", genre: ["epistle"] },
  { bookId: 53, osisId: "2Thess", name: "2 Thessalonians", abbreviation: "2 Thess", testament: "NT", canonSection: "Pauline", genre: ["epistle"] },
  { bookId: 54, osisId: "1Tim", name: "1 Timothy", abbreviation: "1 Tim", testament: "NT", canonSection: "Pauline", genre: ["epistle"] },
  { bookId: 55, osisId: "2Tim", name: "2 Timothy", abbreviation: "2 Tim", testament: "NT", canonSection: "Pauline", genre: ["epistle"] },
  { bookId: 56, osisId: "Titus", name: "Titus", abbreviation: "Titus", testament: "NT", canonSection: "Pauline", genre: ["epistle"] },
  { bookId: 57, osisId: "Phlm", name: "Philemon", abbreviation: "Phlm", testament: "NT", canonSection: "Pauline", genre: ["epistle"] },
  { bookId: 58, osisId: "Heb", name: "Hebrews", abbreviation: "Heb", testament: "NT", canonSection: "General", genre: ["epistle"] },
  { bookId: 59, osisId: "Jas", name: "James", abbreviation: "Jas", testament: "NT", canonSection: "General", genre: ["epistle"] },
  { bookId: 60, osisId: "1Pet", name: "1 Peter", abbreviation: "1 Pet", testament: "NT", canonSection: "General", genre: ["epistle"] },
  { bookId: 61, osisId: "2Pet", name: "2 Peter", abbreviation: "2 Pet", testament: "NT", canonSection: "General", genre: ["epistle"] },
  { bookId: 62, osisId: "1John", name: "1 John", abbreviation: "1 John", testament: "NT", canonSection: "General", genre: ["epistle"] },
  { bookId: 63, osisId: "2John", name: "2 John", abbreviation: "2 John", testament: "NT", canonSection: "General", genre: ["epistle"] },
  { bookId: 64, osisId: "3John", name: "3 John", abbreviation: "3 John", testament: "NT", canonSection: "General", genre: ["epistle"] },
  { bookId: 65, osisId: "Jude", name: "Jude", abbreviation: "Jude", testament: "NT", canonSection: "General", genre: ["epistle"] },
  { bookId: 66, osisId: "Rev", name: "Revelation", abbreviation: "Rev", testament: "NT", canonSection: "Apocalyptic", genre: ["prophecy", "apocalyptic"] },
];
