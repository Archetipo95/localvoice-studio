export interface PhoneticCharItem {
  char: string;
  name: string;
  description: string;
  aliases?: string[];
  example?: string;
}

export type PhoneticCharGroup = {
  label: string;
  items: PhoneticCharItem[];
};

export const PRIMARY_STRESS = "ˈ";
export const SECONDARY_STRESS = "ˌ";

const SUPRASEGMENTALS: PhoneticCharItem[] = [
  {
    char: PRIMARY_STRESS,
    name: "Primary stress",
    description: "Main syllable stress marker.",
    aliases: ["stress"],
    example: "ˈdɑɡ",
  },
  {
    char: SECONDARY_STRESS,
    name: "Secondary stress",
    description: "Secondary syllable stress marker.",
    aliases: ["stress"],
    example: "ˌriːˈækt",
  },
  {
    char: "ː",
    name: "Length mark",
    description: "Long vowel or consonant.",
    aliases: ["long", "duration"],
    example: "uː",
  },
  {
    char: "ˑ",
    name: "Half-length mark",
    description: "Half-long segment.",
    aliases: ["half long"],
    example: "eˑ",
  },
  {
    char: "‿",
    name: "Linking mark",
    description: "Links adjacent words or syllables.",
    aliases: ["tie", "linking"],
    example: "go‿on",
  },
];

const VOWELS: PhoneticCharItem[] = [
  {
    char: "ə",
    name: "Schwa",
    description: "Mid-central unstressed vowel.",
    aliases: ["schwa"],
    example: "sofə",
  },
  {
    char: "ɛ",
    name: "Open e",
    description: "Open-mid front unrounded vowel.",
    aliases: ["open e", "epsilon"],
    example: "bɛt",
  },
  {
    char: "ɪ",
    name: "Small capital i",
    description: "Near-close front vowel.",
    aliases: ["near-close i"],
    example: "bɪt",
  },
  {
    char: "ɔ",
    name: "Open o",
    description: "Open-mid back rounded vowel.",
    aliases: ["open o"],
    example: "lɔt",
  },
  {
    char: "ʊ",
    name: "Small capital u",
    description: "Near-close back rounded vowel.",
    aliases: ["near-close u"],
    example: "fʊt",
  },
  {
    char: "ʌ",
    name: "Turned v",
    description: "Open-mid back unrounded vowel.",
    aliases: ["caret vowel"],
    example: "strʌt",
  },
  {
    char: "æ",
    name: "Ash",
    description: "Near-open front vowel.",
    aliases: ["ash"],
    example: "træp",
  },
  {
    char: "ɑ",
    name: "Script a",
    description: "Open back unrounded vowel.",
    aliases: ["open a"],
    example: "fɑðɚ",
  },
  {
    char: "ɒ",
    name: "Turned script a",
    description: "Open back rounded vowel.",
    aliases: ["rounded open a"],
    example: "nɒt",
  },
  {
    char: "ɚ",
    name: "R-colored schwa",
    description: "Rhotic mid-central vowel.",
    aliases: ["rhotic schwa"],
    example: "wɚd",
  },
  {
    char: "ɝ",
    name: "R-colored stressed vowel",
    description: "Stressed rhotic central vowel.",
    aliases: ["rhotic vowel"],
    example: "bɝd",
  },
  {
    char: "ɜ",
    name: "Reversed epsilon",
    description: "Open-mid central vowel.",
    aliases: ["reversed epsilon"],
    example: "nɜːs",
  },
  {
    char: "ɐ",
    name: "Turned a",
    description: "Near-open central vowel.",
    aliases: ["turned a"],
    example: "ɐ",
  },
  {
    char: "ɨ",
    name: "Barred i",
    description: "Close central unrounded vowel.",
    aliases: ["barred i"],
    example: "ɨ",
  },
  {
    char: "ʉ",
    name: "Barred u",
    description: "Close central rounded vowel.",
    aliases: ["barred u"],
    example: "ʉ",
  },
  {
    char: "ɯ",
    name: "Turned m",
    description: "Close back unrounded vowel.",
    aliases: ["turned m"],
    example: "ɯ",
  },
  {
    char: "ʏ",
    name: "Small capital y",
    description: "Near-close front rounded vowel.",
    aliases: ["rounded i"],
    example: "ʏ",
  },
  {
    char: "ø",
    name: "Slashed o",
    description: "Close-mid front rounded vowel.",
    aliases: ["o slash"],
    example: "ø",
  },
  {
    char: "œ",
    name: "Ligature oe",
    description: "Open-mid front rounded vowel.",
    aliases: ["oe ligature"],
    example: "œ",
  },
  {
    char: "ɞ",
    name: "Closed reversed epsilon",
    description: "Open-mid central rounded vowel.",
    aliases: ["rounded central vowel"],
    example: "ɞ",
  },
  {
    char: "ɶ",
    name: "Capital oe",
    description: "Open front rounded vowel.",
    aliases: ["capital oe"],
    example: "ɶ",
  },
];

const CONSONANTS: PhoneticCharItem[] = [
  { char: "ŋ", name: "Eng", description: "Velar nasal.", aliases: ["eng", "ng"], example: "sɪŋ" },
  {
    char: "θ",
    name: "Theta",
    description: "Voiceless dental fricative.",
    aliases: ["theta"],
    example: "θɪŋk",
  },
  {
    char: "ð",
    name: "Eth",
    description: "Voiced dental fricative.",
    aliases: ["eth"],
    example: "ðɪs",
  },
  {
    char: "ʃ",
    name: "Esh",
    description: "Voiceless postalveolar fricative.",
    aliases: ["esh", "sh"],
    example: "ʃiː",
  },
  {
    char: "ʒ",
    name: "Ezh",
    description: "Voiced postalveolar fricative.",
    aliases: ["ezh", "zh"],
    example: "ʒɑːnrə",
  },
  {
    char: "ʔ",
    name: "Glottal stop",
    description: "Glottal stop consonant.",
    aliases: ["glottal"],
    example: "ʔoʊ",
  },
  {
    char: "ɹ",
    name: "Turned r",
    description: "English-style alveolar approximant.",
    aliases: ["american r", "turned r"],
    example: "ɹed",
  },
  {
    char: "ɾ",
    name: "Tap",
    description: "Alveolar tap or flap.",
    aliases: ["flap", "tap"],
    example: "bɛɾɚ",
  },
  {
    char: "ɫ",
    name: "Dark l",
    description: "Velarized l.",
    aliases: ["dark l", "velarized l"],
    example: "fɫuː",
  },
  {
    char: "ɲ",
    name: "Palatal nasal",
    description: "Palatal nasal consonant.",
    aliases: ["palatal nasal"],
    example: "ɲ",
  },
  {
    char: "ç",
    name: "C cedilla",
    description: "Voiceless palatal fricative.",
    aliases: ["palatal fricative"],
    example: "ç",
  },
  {
    char: "ʝ",
    name: "J crossed-tail",
    description: "Voiced palatal fricative.",
    aliases: ["voiced palatal fricative"],
    example: "ʝ",
  },
  {
    char: "x",
    name: "Voiceless velar fricative",
    description: "Like German ach-Laut.",
    aliases: ["velar fricative"],
    example: "x",
  },
  {
    char: "ɣ",
    name: "Gamma",
    description: "Voiced velar fricative.",
    aliases: ["gamma"],
    example: "ɣ",
  },
  {
    char: "ʁ",
    name: "Uvular r",
    description: "Voiced uvular fricative.",
    aliases: ["uvular r"],
    example: "ʁ",
  },
  {
    char: "ħ",
    name: "H barred",
    description: "Voiceless pharyngeal fricative.",
    aliases: ["pharyngeal h"],
    example: "ħ",
  },
  {
    char: "ʕ",
    name: "Reversed glottal stop",
    description: "Voiced pharyngeal approximant/fricative.",
    aliases: ["ayn"],
    example: "ʕ",
  },
  {
    char: "ʎ",
    name: "Turned y",
    description: "Palatal lateral approximant.",
    aliases: ["palatal lateral"],
    example: "ʎ",
  },
  {
    char: "t͡ʃ",
    name: "Ch affricate",
    description: "Voiceless postalveolar affricate.",
    aliases: ["ch", "affricate"],
    example: "t͡ʃɪp",
  },
  {
    char: "d͡ʒ",
    name: "J affricate",
    description: "Voiced postalveolar affricate.",
    aliases: ["j", "affricate"],
    example: "d͡ʒɑb",
  },
];

const DIACRITICS: PhoneticCharItem[] = [
  {
    char: "̃",
    name: "Nasalization",
    description: "Combining tilde for nasalized vowels.",
    aliases: ["nasalized", "tilde"],
    example: "ã",
  },
  {
    char: "̩",
    name: "Syllabic mark",
    description: "Combining vertical line below for syllabic consonants.",
    aliases: ["syllabic"],
    example: "n̩",
  },
  {
    char: "ʰ",
    name: "Aspiration",
    description: "Aspirated release.",
    aliases: ["aspirated"],
    example: "pʰ",
  },
  {
    char: "ʲ",
    name: "Palatalized",
    description: "Secondary palatal articulation.",
    aliases: ["palatalized"],
    example: "tʲ",
  },
  {
    char: "ʷ",
    name: "Labialized",
    description: "Secondary lip rounding.",
    aliases: ["labialized"],
    example: "kʷ",
  },
];

const PHONETIC_CHAR_GROUPS: PhoneticCharGroup[] = [
  { label: "Stress and Timing", items: SUPRASEGMENTALS },
  { label: "Vowels", items: VOWELS },
  { label: "Consonants", items: CONSONANTS },
  { label: "Diacritics", items: DIACRITICS },
];

export function toPhoneticCharKind(char: string): string {
  const codepoints = [...char].map((value) => value.codePointAt(0)?.toString(16) ?? "0");
  return `phoneticChar_${codepoints.join("_")}`;
}

export function getPhoneticCharGroups() {
  return PHONETIC_CHAR_GROUPS.map((group) => [
    { type: "label" as const, label: group.label },
    ...group.items.map((item) => ({
      kind: toPhoneticCharKind(item.char),
      label: `${item.char}  ${item.name}`,
      description: item.description,
      char: item.char,
      aliases: item.aliases,
      example: item.example,
    })),
  ]);
}

export function getAllPhoneticChars(): PhoneticCharItem[] {
  return PHONETIC_CHAR_GROUPS.flatMap((group) => group.items);
}
