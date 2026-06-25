/**
 * World Football Elo ratings (eloratings.net) for the 48 finalists, keyed by
 * 3-letter team code, used as team-strength inputs for the qualification-odds
 * Monte-Carlo simulation. Elo is purpose-built for prediction (it folds in
 * opponent strength, margin of victory, match importance and home advantage),
 * so it forecasts far better than FIFA ranking points.
 *
 * Snapshot taken from eloratings.net "World" ranking on 2026-06-22. Elo drifts
 * slowly, so a snapshot stays accurate across a tournament — refresh it from
 * https://www.eloratings.net/World.tsv whenever you like. Teams missing here
 * fall back to DEFAULT_RATING.
 */
export const ELO_RATINGS: Record<string, number> = {
  ARG: 2144,
  ESP: 2134,
  FRA: 2090,
  ENG: 2028,
  BRA: 2009,
  COL: 2006,
  POR: 1988,
  NED: 1972,
  GER: 1954,
  NOR: 1951,
  JPN: 1925,
  SUI: 1914,
  MEX: 1912,
  CRO: 1896,
  MAR: 1877,
  BEL: 1869,
  ECU: 1864,
  URU: 1851,
  AUT: 1841,
  USA: 1820,
  SEN: 1817,
  PAR: 1816,
  TUR: 1813,
  AUS: 1799,
  ALG: 1780,
  IRN: 1766,
  CAN: 1748,
  SCO: 1745,
  EGY: 1740,
  CIV: 1728,
  SWE: 1727,
  KOR: 1723,
  CZE: 1680,
  UZB: 1677,
  PAN: 1668,
  COD: 1666,
  JOR: 1632,
  CPV: 1625,
  BIH: 1622,
  KSA: 1593,
  IRQ: 1586,
  GHA: 1584,
  RSA: 1575,
  TUN: 1570,
  NZL: 1549,
  HAI: 1517,
  CUW: 1453,
  QAT: 1411,
};

/** Strength assumed for any team without an entry above (≈ an average national side). */
export const DEFAULT_RATING = 1500;
