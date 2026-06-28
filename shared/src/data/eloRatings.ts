/**
 * World Football Elo ratings (eloratings.net) for the 48 finalists, keyed by
 * 3-letter team code, used as team-strength inputs for the Monte-Carlo
 * simulations (group-stage advancement odds and knockout title odds). Elo is
 * purpose-built for prediction (it folds in opponent strength, margin of
 * victory, match importance and home advantage), so it forecasts far better
 * than FIFA ranking points.
 *
 * Snapshot taken from eloratings.net "World" ranking on 2026-06-28 — i.e. it
 * already reflects the group-stage results. Elo drifts slowly, so a snapshot
 * stays accurate across a round; refresh it from https://www.eloratings.net/World.tsv
 * whenever you like (their 2-letter codes map onto the 3-letter codes below).
 * Teams missing here fall back to DEFAULT_RATING.
 */
export const ELO_RATINGS: Record<string, number> = {
  ARG: 2148,
  ESP: 2144,
  FRA: 2123,
  ENG: 2038,
  BRA: 2009,
  COL: 2004,
  POR: 1990,
  NED: 1980,
  NOR: 1918,
  GER: 1916,
  SUI: 1914,
  MEX: 1912,
  JPN: 1910,
  CRO: 1905,
  ECU: 1902,
  BEL: 1884,
  MAR: 1877,
  TUR: 1852,
  SEN: 1842,
  URU: 1841,
  AUT: 1836,
  PAR: 1815,
  AUS: 1800,
  ALG: 1785,
  USA: 1781,
  IRN: 1764,
  CAN: 1748,
  SCO: 1745,
  CIV: 1743,
  EGY: 1742,
  SWE: 1742,
  KOR: 1723,
  COD: 1712,
  CZE: 1680,
  PAN: 1658,
  UZB: 1631,
  JOR: 1628,
  CPV: 1622,
  BIH: 1622,
  KSA: 1596,
  GHA: 1575,
  RSA: 1575,
  TUN: 1562,
  IRQ: 1561,
  NZL: 1534,
  HAI: 1517,
  CUW: 1438,
  QAT: 1411,
};

/** Strength assumed for any team without an entry above (≈ an average national side). */
export const DEFAULT_RATING = 1500;
