import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'fa';
type Params = Record<string, string | number>;
type Dict = Record<string, string>;

const en: Dict = {
  appTitle: 'World Cup 2026',
  groupStage: 'Group stage',
  knockoutStage: 'Knockout stage',
  complete: 'Complete',
  matchday: 'Matchday {n}',
  liveCount: '{n} live',
  updated: 'updated {ago}',
  'conn.live': 'Live',
  'conn.polling': 'Polling',
  'conn.connecting': 'Connecting',
  'conn.offline': 'Offline',
  'tab.groups': 'Groups & tables',
  'tab.matches': 'Matches',
  'tab.bracket': 'Projected bracket',
  'tab.whatif': 'What-if',
  loading: 'Loading the tournament…',
  scenarioActive: 'What-if scenario active — {n} hypothetical result(s) applied.',
  clear: 'Clear',
  copyLink: 'Copy link',
  linkCopied: 'Link copied!',
  liveNow: 'Live now',
  recentResults: 'Recent results',
  upcoming: 'Upcoming',
  inPlay: '{n} in play',
  kickingOff: 'Kicking off…',
  cdDaysHours: '{d}d {h}h',
  ft: 'FT',
  live: 'LIVE',
  goalBadge: 'GOAL',
  penTag: '(pen)',
  ogTag: '(OG)',
  scorers: 'Scorers',
  lineups: 'Lineups',
  starters: 'Starting XI',
  subsLabel: 'Substitutes',
  attendance: 'Attendance',
  referee: 'Referee',
  possession: 'Possession',
  matchEvents: 'Timeline',
  detailError: 'Match detail unavailable.',
  group: 'Group {x}',
  through: 'through',
  out: 'out',
  thirdPlaced: 'Third-placed teams',
  best8: 'best 8 advance',
  topScorers: 'Top scorers',
  goldenBoot: 'Golden Boot race',
  colPlayer: 'Player',
  colGoals: 'G',
  colMP: 'MP',
  colPenGoals: 'P',
  colAssists: 'A',
  penShort: 'pen',
  noScorers: 'No goals yet.',
  topAssists: 'Top assists',
  assistsSub: 'most assists',
  noAssists: 'No assists yet.',
  teamRecords: 'Team records',
  recMostGoals: 'Most goals',
  recCleanSheets: 'Clean sheets',
  recFairPlay: 'Fair play',
  recCleanSheetsSub: 'fewest conceded',
  recFairPlaySub: 'fewest cards',
  scenariosTitle: 'What each team needs',
  scenariosSubtitle: 'to reach the Round of 32',
  'need.drawEnough': 'A draw is enough to advance.',
  'need.winOrMaybeDraw': 'Win to be sure; a draw may be enough.',
  'need.winOnly': 'Must win to reach the top 2.',
  'need.winMaybe': 'A win could be enough (depends on other results).',
  'need.thirdRace': 'Top 2 out of reach — still alive for a best-third spot.',
  'need.await': 'Games done — waiting on other groups (best-third race).',
  'need.contention': 'Still in contention.',
  gridTitle: 'Final-day permutations',
  gridSubtitle: 'every scoreline of the last group games',
  gridIntro:
    "Pick a team to see exactly where it finishes for every possible scoreline of its group's last two games. Both games kick off together, so all combinations are still open.",
  gridWins: '{team} wins',
  gridDraw: 'Draw',
  gridPos1: '1st',
  gridPos2: '2nd',
  gridPos3: '3rd',
  gridPos4: '4th',
  gridTiebreak: 'Fair-play (cards) or FIFA ranking decides',
  gridHover: 'Tap or hover a square to read its exact scoreline and result. Scorelines capped at {max} goals per side.',
  gridDistCaption: "{team}'s finish across all {n} possible final-day scorelines",
  oddsCol: 'Q%',
  oddsColTitle: 'Chance to reach the Round of 32',
  oddsModelNote:
    'Monte-Carlo simulation ({n} runs) playing out the remaining group games, weighted by World Football Elo ratings (eloratings.net). For fun — not betting advice.',
  oddsBreakdown: 'Win group {w}% · Top 2 {t}% · Best third {b}%',
  colTeam: 'Team',
  colGrp: 'Grp',
  colGF: 'GF',
  colForm: 'Form',
  'round.r32': 'Round of 32',
  'round.r16': 'Round of 16',
  'round.qf': 'Quarter-finals',
  'round.sf': 'Semi-finals',
  'round.final': 'Final',
  'round.third': 'Third place',
  finalHeading: 'Final',
  thirdPlayoff: 'Third-place play-off',
  winnerOfM: 'Winner M{n}',
  loserOfM: 'Loser M{n}',
  winnerGroup: 'Winner {g}',
  runnerUpGroup: 'Runner-up {g}',
  thirdGroup: '3rd {g}',
  pens: 'pens',
  aet: 'a.e.t.',
  editResults: 'Edit results',
  bracketIntro:
    "Projected matchups as it stands — winners/runners-up are current standings, the eight best thirds are slotted via FIFA's combination table, and names turn green once a team has qualified. Turn on edit mode to enter knockout scores (with extra time / penalties) and watch winners advance.",
  whatifTitle: 'What-if calculator',
  whatifIntro:
    'Enter scores for upcoming group games, then Calculate to recompute the tables, who qualifies, and the projected bracket from your hypothetical results. Leave a game blank to keep it open.',
  calculate: 'Calculate ({n})',
  reset: 'Reset',
  noUpcoming: 'No upcoming group games to project.',
  footer: 'Standings, qualification & bracket computed live from match results · source: {provider}. Not affiliated with FIFA.',
  visitorStats: '{today} visits today · {total} total · {current} live now',
  visitorStatsPrivacy: 'Aggregate counts only. No cookies, IPs, user agents, or identifiers are stored.',
  githubLink: 'GitHub: liy0na/world-cup',
  'outlook.won_group': 'Won group — through',
  'outlook.advanced': 'Qualified (top 2)',
  'outlook.qualified_third': 'Qualified (best third)',
  'outlook.eliminated': 'Eliminated',
  'outlook.alive': 'In contention',
};

const fa: Dict = {
  appTitle: 'جام جهانی ۲۰۲۶',
  groupStage: 'مرحلهٔ گروهی',
  knockoutStage: 'مرحلهٔ حذفی',
  complete: 'پایان‌یافته',
  matchday: 'روز {n}',
  liveCount: '{n} بازی زنده',
  updated: 'به‌روزرسانی {ago}',
  'conn.live': 'زنده',
  'conn.polling': 'در حال دریافت',
  'conn.connecting': 'در حال اتصال',
  'conn.offline': 'آفلاین',
  'tab.groups': 'گروه‌ها و جدول‌ها',
  'tab.matches': 'بازی‌ها',
  'tab.bracket': 'جدول حذفی پیش‌بینی‌شده',
  'tab.whatif': 'حالت فرضی',
  loading: 'در حال بارگذاری مسابقات…',
  scenarioActive: 'حالت فرضی فعال است — {n} نتیجهٔ فرضی اعمال شد.',
  clear: 'پاک کردن',
  copyLink: 'کپی لینک',
  linkCopied: 'لینک کپی شد!',
  liveNow: 'اکنون زنده',
  recentResults: 'نتایج اخیر',
  upcoming: 'بازی‌های پیش‌رو',
  inPlay: '{n} در حال انجام',
  kickingOff: 'در حال شروع…',
  cdDaysHours: '{d} روز {h} ساعت',
  ft: 'پایان',
  live: 'زنده',
  goalBadge: 'گل!',
  penTag: '(پنالتی)',
  ogTag: '(خودی)',
  scorers: 'گلزن‌ها',
  lineups: 'ترکیب تیم‌ها',
  starters: 'ترکیب اصلی',
  subsLabel: 'تعویض‌ها',
  attendance: 'تماشاگران',
  referee: 'داور',
  possession: 'مالکیت توپ',
  matchEvents: 'رویدادها',
  detailError: 'جزئیات بازی در دسترس نیست.',
  group: 'گروه {x}',
  through: 'صعود',
  out: 'حذف',
  thirdPlaced: 'تیم‌های سوم',
  best8: '۸ تیم برتر صعود می‌کنند',
  topScorers: 'گلزنان برتر',
  goldenBoot: 'رقابت کفش طلا',
  colPlayer: 'بازیکن',
  colGoals: 'گل',
  colMP: 'بازی',
  colPenGoals: 'پنالتی',
  colAssists: 'پاس',
  penShort: 'پنالتی',
  noScorers: 'هنوز گلی زده نشده.',
  topAssists: 'پاس‌دهندگان برتر',
  assistsSub: 'بیشترین پاس گل',
  noAssists: 'هنوز پاس گلی ثبت نشده.',
  teamRecords: 'رکوردهای تیمی',
  recMostGoals: 'بیشترین گل',
  recCleanSheets: 'کلین‌شیت',
  recFairPlay: 'بازی جوانمردانه',
  recCleanSheetsSub: 'کمترین گل خورده',
  recFairPlaySub: 'کمترین کارت',
  scenariosTitle: 'هر تیم به چه نیاز دارد',
  scenariosSubtitle: 'برای رسیدن به مرحلهٔ حذفی',
  'need.drawEnough': 'یک تساوی برای صعود کافی است.',
  'need.winOrMaybeDraw': 'برای صعود قطعی باید ببرد؛ تساوی هم ممکن است کافی باشد.',
  'need.winOnly': 'برای رسیدن به دو تیم برتر باید ببرد.',
  'need.winMaybe': 'برد ممکن است کافی باشد (بسته به سایر نتایج).',
  'need.thirdRace': 'صعود مستقیم ممکن نیست — هنوز شانس سومی برتر دارد.',
  'need.await': 'بازی‌هایش تمام شد؛ منتظر سایر گروه‌ها (رقابت تیم‌های سوم).',
  'need.contention': 'هنوز در رقابت.',
  gridTitle: 'حالت‌های روز پایانی',
  gridSubtitle: 'همهٔ نتایج ممکن بازی‌های پایانی گروه',
  gridIntro:
    'یک تیم را انتخاب کنید تا ببینید در هر نتیجهٔ ممکن دو بازی پایانی گروهش دقیقاً در چه رده‌ای قرار می‌گیرد. هر دو بازی هم‌زمان آغاز می‌شوند، پس همهٔ ترکیب‌ها هنوز ممکن‌اند.',
  gridWins: 'برد {team}',
  gridDraw: 'تساوی',
  gridPos1: 'اول',
  gridPos2: 'دوم',
  gridPos3: 'سوم',
  gridPos4: 'چهارم',
  gridTiebreak: 'تعیین با بازی جوانمردانه (کارت‌ها) یا ردهٔ فیفا',
  gridHover: 'برای دیدن نتیجهٔ دقیق هر خانه روی آن بزنید یا نشانگر را روی آن ببرید. نتایج تا {max} گل برای هر تیم در نظر گرفته شده‌اند.',
  gridDistCaption: 'رده پایانی {team} در همهٔ {n} نتیجهٔ ممکن روز پایانی',
  oddsCol: 'صعود٪',
  oddsColTitle: 'شانس رسیدن به مرحلهٔ یک‌شانزدهم نهایی',
  oddsModelNote:
    'شبیه‌سازی مونت‌کارلو ({n} اجرا) با شبیه‌سازی بازی‌های باقی‌ماندهٔ گروهی و وزن‌دهی بر اساس ردهٔ ایلوی فوتبال جهانی (eloratings.net). صرفاً برای سرگرمی — توصیهٔ شرط‌بندی نیست.',
  oddsBreakdown: 'صدرنشینی {w}٪ · دو تیم برتر {t}٪ · بهترین تیم سوم {b}٪',
  colTeam: 'تیم',
  colGrp: 'گروه',
  colGF: 'گل زده',
  colForm: 'روند',
  'round.r32': 'مرحلهٔ یک‌شانزدهم نهایی',
  'round.r16': 'مرحلهٔ یک‌هشتم نهایی',
  'round.qf': 'یک‌چهارم نهایی',
  'round.sf': 'نیمه‌نهایی',
  'round.final': 'فینال',
  'round.third': 'ردهٔ سوم',
  finalHeading: 'فینال',
  thirdPlayoff: 'دیدار ردهٔ سوم',
  winnerOfM: 'برندهٔ M{n}',
  loserOfM: 'بازندهٔ M{n}',
  winnerGroup: 'صدرنشین {g}',
  runnerUpGroup: 'تیم دوم {g}',
  thirdGroup: 'سوم {g}',
  pens: 'پنالتی',
  aet: 'پس از وقت اضافه',
  editResults: 'ویرایش نتایج',
  bracketIntro:
    'دیدارهای پیش‌بینی‌شده بر اساس وضعیت کنونی — صدرنشینان و تیم‌های دوم بر پایهٔ جدول فعلی‌اند و هشت تیم سوم برتر طبق جدول ترکیبی فیفا چیده شده‌اند؛ نام تیم‌ها پس از صعود قطعی سبز می‌شود. برای وارد کردن نتایج مرحلهٔ حذفی (با وقت اضافه و پنالتی) و دیدن صعود تیم‌ها، حالت ویرایش را روشن کنید.',
  whatifTitle: 'حالت فرضی (شبیه‌سازی)',
  whatifIntro:
    'برای بازی‌های پیش‌روی گروهی نتیجه وارد کنید و سپس «محاسبه» را بزنید تا جدول‌ها، صعودها و جدول حذفی پیش‌بینی‌شده بر اساس نتایج فرضی شما دوباره محاسبه شوند. هر بازی را خالی بگذارید تا باز بماند.',
  calculate: 'محاسبه ({n})',
  reset: 'بازنشانی',
  noUpcoming: 'بازی گروهی پیش‌رویی برای پیش‌بینی وجود ندارد.',
  footer: 'جدول‌ها، صعود و مراحل حذفی به‌صورت زنده از نتایج بازی‌ها محاسبه می‌شوند · منبع: {provider}. وابسته به فیفا نیست.',
  visitorStats: '{today} بازدید امروز · {total} کل بازدیدها · {current} اکنون آنلاین',
  visitorStatsPrivacy: 'فقط شمارش کلی ذخیره می‌شود؛ کوکی، آی‌پی، مرورگر یا شناسه ذخیره نمی‌شود.',
  githubLink: 'GitHub: liy0na/world-cup',
  'outlook.won_group': 'صدرنشین — صعود',
  'outlook.advanced': 'صعود (دو تیم برتر)',
  'outlook.qualified_third': 'صعود (تیم سوم برتر)',
  'outlook.eliminated': 'حذف‌شده',
  'outlook.alive': 'در حال رقابت',
};

const DICTS: Record<Lang, Dict> = { en, fa };

// Western (Latin) digits -> Persian (Extended Arabic-Indic) digits ۰۱۲…
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
function toFaDigits(s: string): string {
  return s.replace(/[0-9]/g, (d) => FA_DIGITS.charAt(Number(d)));
}

/** Localise a number for display: Persian numerals in `fa`, Latin otherwise. */
export function fmtNum(value: number | string, lang: Lang): string {
  return lang === 'fa' ? toFaDigits(String(value)) : String(value);
}

/** Convert Persian (۰-۹) / Arabic-Indic (٠-٩) digits back to Latin, for parsing typed input. */
export function toLatinDigits(s: string): string {
  return s.replace(/[۰-۹٠-٩]/g, (d) => {
    const c = d.charCodeAt(0);
    return String(c >= 0x06f0 ? c - 0x06f0 : c - 0x0660);
  });
}

interface I18n {
  lang: Lang;
  dir: 'ltr' | 'rtl';
  setLang: (l: Lang) => void;
  t: (key: string, params?: Params) => string;
  num: (value: number | string) => string;
}

const Ctx = createContext<I18n | null>(null);

function translate(lang: Lang, key: string, params?: Params): string {
  let s = DICTS[lang][key] ?? DICTS.en[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  if (lang === 'fa') s = toFaDigits(s); // localise any interpolated counts (e.g. "{n} live")
  return s;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('lang') : null;
    return stored === 'fa' ? 'fa' : 'en';
  });

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
  }, [lang]);

  const setLang = (l: Lang) => {
    try {
      localStorage.setItem('lang', l);
    } catch {
      /* ignore */
    }
    setLangState(l);
  };

  const value: I18n = {
    lang,
    dir: lang === 'fa' ? 'rtl' : 'ltr',
    setLang,
    t: (key, params) => translate(lang, key, params),
    num: (value) => fmtNum(value, lang),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const c = useContext(Ctx);
  if (!c) throw new Error('useI18n must be used within I18nProvider');
  return c;
}
