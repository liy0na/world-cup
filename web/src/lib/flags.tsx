// FIFA 3-letter team code -> ISO 3166-1 alpha-2 (or flag-icons subdivision code).
const FIFA_TO_ISO: Record<string, string> = {
  MEX: 'mx',
  RSA: 'za',
  KOR: 'kr',
  CZE: 'cz',
  CAN: 'ca',
  BIH: 'ba',
  QAT: 'qa',
  SUI: 'ch',
  BRA: 'br',
  MAR: 'ma',
  HAI: 'ht',
  SCO: 'gb-sct',
  USA: 'us',
  PAR: 'py',
  AUS: 'au',
  TUR: 'tr',
  GER: 'de',
  CUW: 'cw',
  CIV: 'ci',
  ECU: 'ec',
  NED: 'nl',
  JPN: 'jp',
  SWE: 'se',
  TUN: 'tn',
  BEL: 'be',
  EGY: 'eg',
  IRN: 'ir',
  NZL: 'nz',
  ESP: 'es',
  CPV: 'cv',
  KSA: 'sa',
  URU: 'uy',
  FRA: 'fr',
  SEN: 'sn',
  IRQ: 'iq',
  NOR: 'no',
  ARG: 'ar',
  ALG: 'dz',
  AUT: 'at',
  JOR: 'jo',
  POR: 'pt',
  COD: 'cd',
  UZB: 'uz',
  COL: 'co',
  ENG: 'gb-eng',
  CRO: 'hr',
  GHA: 'gh',
  PAN: 'pa',
};

/** A small country flag for a FIFA team code, or nothing if unknown. */
export function Flag({ code, className = '' }: { code: string | undefined; className?: string }) {
  const iso = code ? FIFA_TO_ISO[code] : undefined;
  if (!iso) return null;
  return (
    <span
      className={`fi fi-${iso} shrink-0 rounded-[2px] ${className}`}
      style={{ width: '1.25em', height: '0.9em' }}
      aria-hidden
    />
  );
}
