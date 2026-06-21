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
  'tab.bracket': 'Projected bracket',
  'tab.whatif': 'What-if',
  loading: 'Loading the tournament…',
  scenarioActive: 'What-if scenario active — {n} hypothetical result(s) applied.',
  clear: 'Clear',
  liveNow: 'Live now',
  recentResults: 'Recent results',
  upcoming: 'Upcoming',
  inPlay: '{n} in play',
  ft: 'FT',
  live: 'LIVE',
  group: 'Group {x}',
  through: 'through',
  out: 'out',
  thirdPlaced: 'Third-placed teams',
  best8: 'best 8 advance',
  scenariosTitle: 'What each team needs',
  scenariosSubtitle: 'to reach the Round of 32',
  'need.drawEnough': 'A draw is enough to advance.',
  'need.winOrMaybeDraw': 'Win to be sure; a draw may be enough.',
  'need.winOnly': 'Must win to reach the top 2.',
  'need.winMaybe': 'A win could be enough (depends on other results).',
  'need.thirdRace': 'Top 2 out of reach — still alive for a best-third spot.',
  'need.await': 'Games done — waiting on other groups (best-third race).',
  'need.contention': 'Still in contention.',
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
  'tab.bracket': 'جدول حذفی پیش‌بینی‌شده',
  'tab.whatif': 'حالت فرضی',
  loading: 'در حال بارگذاری مسابقات…',
  scenarioActive: 'حالت فرضی فعال است — {n} نتیجهٔ فرضی اعمال شد.',
  clear: 'پاک کردن',
  liveNow: 'اکنون زنده',
  recentResults: 'نتایج اخیر',
  upcoming: 'بازی‌های پیش‌رو',
  inPlay: '{n} در حال انجام',
  ft: 'پایان',
  live: 'زنده',
  group: 'گروه {x}',
  through: 'صعود',
  out: 'حذف',
  thirdPlaced: 'تیم‌های سوم',
  best8: '۸ تیم برتر صعود می‌کنند',
  scenariosTitle: 'هر تیم به چه نیاز دارد',
  scenariosSubtitle: 'برای رسیدن به مرحلهٔ حذفی',
  'need.drawEnough': 'یک تساوی برای صعود کافی است.',
  'need.winOrMaybeDraw': 'برای صعود قطعی باید ببرد؛ تساوی هم ممکن است کافی باشد.',
  'need.winOnly': 'برای رسیدن به دو تیم برتر باید ببرد.',
  'need.winMaybe': 'برد ممکن است کافی باشد (بسته به سایر نتایج).',
  'need.thirdRace': 'صعود مستقیم ممکن نیست — هنوز شانس سومی برتر دارد.',
  'need.await': 'بازی‌هایش تمام شد؛ منتظر سایر گروه‌ها (رقابت تیم‌های سوم).',
  'need.contention': 'هنوز در رقابت.',
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
  'outlook.won_group': 'صدرنشین — صعود',
  'outlook.advanced': 'صعود (دو تیم برتر)',
  'outlook.qualified_third': 'صعود (تیم سوم برتر)',
  'outlook.eliminated': 'حذف‌شده',
  'outlook.alive': 'در حال رقابت',
};

const DICTS: Record<Lang, Dict> = { en, fa };

interface I18n {
  lang: Lang;
  dir: 'ltr' | 'rtl';
  setLang: (l: Lang) => void;
  t: (key: string, params?: Params) => string;
}

const Ctx = createContext<I18n | null>(null);

function translate(lang: Lang, key: string, params?: Params): string {
  let s = DICTS[lang][key] ?? DICTS.en[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
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
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const c = useContext(Ctx);
  if (!c) throw new Error('useI18n must be used within I18nProvider');
  return c;
}
