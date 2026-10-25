/** Small, dependency-free English/Somali UI dictionary. Learning-course language is separate. */
export type InterfaceLanguage = 'en' | 'so';

const SO: Record<string, string> = {
  'Home': 'Hoyga', 'Explore': 'Baadh', 'Speak': 'Hadal', 'Words': 'Erayo', 'You': 'Adiga',
  'Settings': 'Dejinta', 'Search settings': 'Raadi dejinta', 'Clear search': 'Nadiifi raadinta',
  'Go back': 'Dib u noqo', 'Account': 'Akoonka', 'Appearance': 'Muuqaalka', 'Learning': 'Barashada',
  'Languages': 'Luqadaha', 'Tutor & voice': 'Macallinka iyo codka', 'Accessibility': 'Helitaan fudud',
  'Privacy': 'Asturnaanta', 'About': 'Ku saabsan', 'Interface language': 'Luqadda app-ka',
  'Choose the language used for menus and buttons. This does not change your course.': 'Dooro luqadda menu-yada iyo badhamada. Tani ma beddelayso luqadda aad baranayso.',
  'English': 'Ingiriisi', 'Somali': 'Soomaali', 'Soomaali': 'Soomaali',
  'Theme': 'Muuqaalka midabka', 'System': 'Nidaamka telefoonka', 'Light': 'Iftiin', 'Dark': 'Madow',
  'Daily goal': 'Yoolka maalinlaha ah', 'Explanation language': 'Luqadda sharaxaadda',
  'The language the tutor explains in': 'Luqadda uu macallinku wax ku sharxo',
  'Daily reminder': 'Xusuusin maalinle ah', 'Send a test reminder': 'Tijaabi xusuusinta',
  'Show translations': 'Muuji tarjumaadaha', 'Read replies aloud': 'Jawaabaha cod ku akhri',
  'Voice speed': 'Xawaaraha codka', 'Sign out': 'Ka bax akoonka',
  'Signed in': 'Waad soo gashay', 'Learner': 'Arday', 'Demo account': 'Akoon tijaabo ah',
  'Progress stays on this device': 'Horumarkaagu telefoonkan ayuu ku sii jirayaa',
  'Following this device — dark right now': 'Raacaya telefoonka — hadda madow',
  'Following this device — light right now': 'Raacaya telefoonka — hadda iftiin',
  'No setting matches': 'Dejin ku habboon lama helin', 'Try “voice”, “language”, “privacy” or “motion”.': 'Isku day “cod”, “luqad”, “asturnaan” ama “dhaqdhaqaaq”.',
  'Reduce motion': 'Yaree dhaqdhaqaaqa', 'Your learning space': 'Meeshaada waxbarasho',
  'Continue learning': 'Sii wad barashada', 'Your progress': 'Horumarkaaga',
  'Today': 'Maanta', 'This week': 'Toddobaadkan', 'Streak': 'Maalmo xiriir ah',
  'Words learned': 'Erayo la bartay', 'Lessons': 'Casharro', 'Profile': 'Astaantaada',
  'Edit profile': 'Wax ka beddel astaanta', 'Daily target': 'Yoolka maalinlaha ah',
  'Create account': 'Samee akoon', 'Sign in': 'Soo gal', 'Sign up': 'Is diiwaangeli',
  'Welcome back.': 'Soo dhowow mar kale.', 'Welcome back': 'Soo dhowow mar kale',
  'Pick up where you left off and keep building your language skills.': 'Halkaad joogtay ka sii wad oo horumari xirfadahaaga luqadeed.',
  'Email': 'Iimayl', 'Password': 'Furaha sirta ah', 'Forgot password?': 'Ma illowday furaha sirta ah?',
  'New to Babelish? ': 'Babelish ma ku cusub tahay? ', 'Create an account': 'Samee akoon',
  'Name': 'Magac', 'Confirm password': 'Xaqiiji furaha sirta ah', 'Start learning today.': 'Maanta bilow barashada.',
  'Already have an account? ': 'Akoon ma leedahay? ', 'Back to sign in': 'Ku noqo soo gelidda',
  'Reset your password': 'Dib u deji furaha sirta ah', 'Check your inbox': 'Hubi iimaylkaaga',
  'Privacy policy': 'Siyaasadda asturnaanta', 'Terms of Service': 'Shuruudaha adeegga',
  'Cancel': 'Jooji', 'Save': 'Kaydi', 'Done': 'Waa la dhammeeyay', 'Close': 'Xir',
};
export function translateUi(text: string, language: InterfaceLanguage): string {
  if (language === 'en') return text;
  if (SO[text]) return SO[text];
  // Keep dynamic values, names, course labels and unknown copy intact rather than guessing.
  return text;
}
export const INTERFACE_LANGUAGES: { id: InterfaceLanguage; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'so', label: 'Soomaali' },
];
