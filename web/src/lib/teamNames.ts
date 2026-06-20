import type { SlotRef, Team } from '@wc/shared';
import type { Lang } from './i18n';
import type { TeamMap } from './teams';

/** Persian (Farsi) team names keyed by FIFA code. */
export const TEAM_FA: Record<string, string> = {
  MEX: 'مکزیک',
  RSA: 'آفریقای جنوبی',
  KOR: 'کره جنوبی',
  CZE: 'چک',
  CAN: 'کانادا',
  BIH: 'بوسنی و هرزگوین',
  QAT: 'قطر',
  SUI: 'سوئیس',
  BRA: 'برزیل',
  MAR: 'مراکش',
  HAI: 'هائیتی',
  SCO: 'اسکاتلند',
  USA: 'آمریکا',
  PAR: 'پاراگوئه',
  AUS: 'استرالیا',
  TUR: 'ترکیه',
  GER: 'آلمان',
  CUW: 'کوراسائو',
  CIV: 'ساحل عاج',
  ECU: 'اکوادور',
  NED: 'هلند',
  JPN: 'ژاپن',
  SWE: 'سوئد',
  TUN: 'تونس',
  BEL: 'بلژیک',
  EGY: 'مصر',
  IRN: 'ایران',
  NZL: 'نیوزیلند',
  ESP: 'اسپانیا',
  CPV: 'کیپ ورد',
  KSA: 'عربستان',
  URU: 'اروگوئه',
  FRA: 'فرانسه',
  SEN: 'سنگال',
  IRQ: 'عراق',
  NOR: 'نروژ',
  ARG: 'آرژانتین',
  ALG: 'الجزایر',
  AUT: 'اتریش',
  JOR: 'اردن',
  POR: 'پرتغال',
  COD: 'کنگو دموکراتیک',
  UZB: 'ازبکستان',
  COL: 'کلمبیا',
  ENG: 'انگلیس',
  CRO: 'کرواسی',
  GHA: 'غنا',
  PAN: 'پاناما',
};

type T = (key: string, params?: Record<string, string | number>) => string;

export function teamName(team: Team | undefined, lang: Lang): string {
  if (!team) return '';
  return lang === 'fa' ? (TEAM_FA[team.code] ?? team.name) : team.name;
}

/** Localised label for a bracket/group slot: the team name if resolved, else the placeholder. */
export function slotDisplay(slot: SlotRef, teams: TeamMap, lang: Lang, t: T): string {
  if (slot.teamId) return teamName(teams.get(slot.teamId), lang) || slot.teamId;
  let m: RegExpMatchArray | null;
  if ((m = slot.label.match(/^Winner M(\d+)$/))) return t('winnerOfM', { n: m[1]! });
  if ((m = slot.label.match(/^Loser M(\d+)$/))) return t('loserOfM', { n: m[1]! });
  if ((m = slot.label.match(/^Winner (.+)$/))) return t('winnerGroup', { g: m[1]! });
  if ((m = slot.label.match(/^Runner-up (.+)$/))) return t('runnerUpGroup', { g: m[1]! });
  if ((m = slot.label.match(/^3rd (.+)$/))) return t('thirdGroup', { g: m[1]! });
  return slot.label;
}
