/**
 * Numbers copied from the printed outputs of the E118 notebook
 * (https://redam94.github.io/pymc-challenges/examples/E118_ideology_and_poll_error.html).
 * Each block names the section and the cell whose output it copies; cells are
 * numbered from zero over all cells of the built .ipynb, markdown included.
 * Nothing here is refitted or estimated.
 * Poll error is the certified two-party margin minus the mean of the polls of
 * the last 21 days, Democratic minus Republican, in points. Every contrast is
 * centre list minus left list.
 */

/** A median (or mean) with the ends of its 90% interval. */
export type Estimate = { mid: number; lo: number; hi: number };

/** Section 3, cell 19: poll error by dated bucket, 184 races of 2018 and 2022. */
export const buckets = [
  { key: "left", label: "On a left list", races: 22, mean: 0.95, sd: 7.3 },
  { key: "centre", label: "On a centre list", races: 38, mean: 0.77, sd: 5.3 },
  { key: "none", label: "On no list", races: 122, mean: 0.23, sd: 6.21 },
] as const;

/** Section 3, cell 19: nominees on lists of both sides, counted and not averaged. */
export const onBothLists = 2;

/** Section 3, cell 19, row "both cycles": difference in means, bootstrap 90%. */
export const naive: Estimate = { mid: -0.18, lo: -2.9, hi: 2.6 };

/** Section 5, cell 34: the contrast as covariate blocks are added. */
export const steps: { label: string; estimate: Estimate }[] = [
  { label: "Difference in means", estimate: naive },
  { label: "Poll terms only", estimate: { mid: -1.35, lo: -3.7, hi: 1.0 } },
  {
    label: "+ lean, incumbency, opponent",
    estimate: { mid: -0.57, lo: -2.7, hi: 1.6 },
  },
  {
    label: "+ party support: the full model",
    estimate: { mid: -0.97, lo: -3.3, hi: 1.3 },
  },
];

export const fullModel: Estimate = steps[3].estimate;

/** Section 5, cell 34: tail probabilities of the full model's contrast. */
export const tails = { centreAheadBy2: 0.015, leftAheadBy2: 0.225 };

/** Section 5, cell 35: other terms of the full model, medians and 5% to 95%. */
export const terms: { label: string; note?: string; estimate: Estimate }[] = [
  {
    label: "Sponsored polls: lean to the sponsor",
    estimate: { mid: 4.99, lo: 3.24, hi: 6.84 },
  },
  {
    label: "Partisan lean, per 10 points",
    estimate: { mid: 1.85, lo: 1.31, hi: 2.39 },
  },
  {
    label: "Republican holds the seat",
    estimate: { mid: 1.99, lo: 0.38, hi: 3.57 },
  },
  {
    label: "Democrat holds the seat",
    estimate: { mid: -1.32, lo: -3.03, hi: 0.41 },
  },
  {
    label: "Democrat served in Congress before",
    estimate: { mid: -0.57, lo: -2.7, hi: 1.52 },
  },
  {
    label: "Republican served in Congress before",
    estimate: { mid: 0.94, lo: -1.21, hi: 2.99 },
  },
  {
    label: "Republican on the Freedom Caucus list",
    estimate: { mid: -0.74, lo: -2.91, hi: 1.51 },
  },
  {
    label: "Republican on the Main Street list",
    estimate: { mid: -1.52, lo: -3.07, hi: 0.13 },
  },
  {
    label: "Republican's receipts",
    estimate: { mid: 0.26, lo: -0.53, hi: 0.97 },
  },
];

/**
 * Section 5, cell 35: the sixteen party-support coefficients, in the order the
 * notebook prints them (d_receipts to r_other_opp), per standard deviation of
 * log dollars within a cycle. Their shared scale is 0.19 (0.03 to 0.43).
 */
export const money: Estimate[] = [
  { mid: 0.01, lo: -0.32, hi: 0.38 },
  { mid: 0.01, lo: -0.36, hi: 0.39 },
  { mid: 0.11, lo: -0.13, hi: 0.54 },
  { mid: 0.01, lo: -0.27, hi: 0.31 },
  { mid: 0.04, lo: -0.23, hi: 0.41 },
  { mid: -0.0, lo: -0.33, hi: 0.28 },
  { mid: 0.12, lo: -0.11, hi: 0.64 },
  { mid: 0.04, lo: -0.25, hi: 0.44 },
  { mid: 0.1, lo: -0.13, hi: 0.59 },
  { mid: -0.0, lo: -0.37, hi: 0.3 },
  { mid: 0.06, lo: -0.18, hi: 0.4 },
  { mid: -0.01, lo: -0.39, hi: 0.26 },
  { mid: -0.01, lo: -0.32, hi: 0.24 },
  { mid: 0.0, lo: -0.33, hi: 0.3 },
  { mid: 0.05, lo: -0.21, hi: 0.46 },
  { mid: -0.02, lo: -0.4, hi: 0.25 },
];

export const moneyScale: Estimate = { mid: 0.19, lo: 0.03, hi: 0.43 };

export type Specification = {
  label: string;
  /** Left-list / centre-list nominees, or the number of scored members. */
  size: string;
  /** Difference in means with no model (for the two score rows, a slope). */
  noModel: number;
  estimate: Estimate;
  /** False when the measure uses scores from today's file. */
  dated: boolean;
  /** 0 the main specification, 1 other buckets and samples, 2 the rest. */
  group: 0 | 1 | 2;
};

/**
 * Section 6, cells 39 and 40: the 25 specifications of the multiverse, in the
 * order printed. The main specification is refitted here by another sampler
 * run, which is why it reads -0.87 where the fit of section 5 reads -0.97.
 */
export const specifications: Specification[] = [
  {
    label: "Any dated list, all races",
    size: "22 / 38",
    noModel: -0.18,
    estimate: { mid: -0.87, lo: -3.3, hi: 1.4 },
    dated: true,
    group: 0,
  },
  {
    label: "Any dated list, not holding the seat",
    size: "13 / 25",
    noModel: -2.15,
    estimate: { mid: -2.1, lo: -5.1, hi: 0.8 },
    dated: true,
    group: 1,
  },
  {
    label: "Any dated list, House",
    size: "19 / 36",
    noModel: 0.82,
    estimate: { mid: 0.73, lo: -1.8, hi: 3.2 },
    dated: true,
    group: 1,
  },
  {
    label: "Caucus rosters, all races",
    size: "10 / 16",
    noModel: 1.49,
    estimate: { mid: 0.5, lo: -2.7, hi: 3.7 },
    dated: true,
    group: 1,
  },
  {
    label: "Caucus rosters, House",
    size: "8 / 13",
    noModel: 3.78,
    estimate: { mid: 2.41, lo: -1.0, hi: 5.8 },
    dated: true,
    group: 1,
  },
  {
    label: "Endorsement lists, all races",
    size: "14 / 23",
    noModel: -1.64,
    estimate: { mid: -1.78, lo: -4.6, hi: 1.0 },
    dated: true,
    group: 1,
  },
  {
    label: "Endorsement lists, not holding the seat",
    size: "13 / 23",
    noModel: -1.4,
    estimate: { mid: -1.32, lo: -4.2, hi: 1.7 },
    dated: true,
    group: 1,
  },
  {
    label: "Endorsement lists, House",
    size: "11 / 23",
    noModel: -1.02,
    estimate: { mid: -1.06, lo: -4.2, hi: 2.0 },
    dated: true,
    group: 1,
  },
  {
    label: "Lists in every cycle, all races",
    size: "17 / 33",
    noModel: 1.34,
    estimate: { mid: 0.73, lo: -1.8, hi: 3.1 },
    dated: true,
    group: 1,
  },
  {
    label: "Lists in every cycle, not holding the seat",
    size: "8 / 20",
    noModel: 0.19,
    estimate: { mid: -0.22, lo: -3.8, hi: 3.3 },
    dated: true,
    group: 1,
  },
  {
    label: "Lists in every cycle, House",
    size: "15 / 30",
    noModel: 2.51,
    estimate: { mid: 2.07, lo: -0.7, hi: 4.8 },
    dated: true,
    group: 1,
  },
  {
    label: "Centre from Blue Dog lists, all races",
    size: "24 / 21",
    noModel: -0.32,
    estimate: { mid: -0.08, lo: -2.5, hi: 2.5 },
    dated: true,
    group: 1,
  },
  {
    label: "Centre from Blue Dog lists, not holding the seat",
    size: "14 / 18",
    noModel: -1.86,
    estimate: { mid: -1.15, lo: -4.0, hi: 1.6 },
    dated: true,
    group: 1,
  },
  {
    label: "Centre from Blue Dog lists, House",
    size: "20 / 20",
    noModel: 0.4,
    estimate: { mid: 1.09, lo: -1.7, hi: 3.9 },
    dated: true,
    group: 1,
  },
  {
    label: "Any dated list, 2018 only",
    size: "14 / 17",
    noModel: 0.06,
    estimate: { mid: -0.32, lo: -3.3, hi: 2.7 },
    dated: true,
    group: 2,
  },
  {
    label: "Any dated list, 2022 only",
    size: "8 / 21",
    noModel: -0.66,
    estimate: { mid: -0.08, lo: -3.2, hi: 3.0 },
    dated: true,
    group: 2,
  },
  {
    label: "Any dated list, polls of the last 42 days",
    size: "28 / 55",
    noModel: 0.08,
    estimate: { mid: -0.59, lo: -2.7, hi: 1.6 },
    dated: true,
    group: 2,
  },
  {
    label: "Any dated list, polls of the last 70 days",
    size: "28 / 65",
    noModel: -0.74,
    estimate: { mid: 0.06, lo: -2.1, hi: 2.2 },
    dated: true,
    group: 2,
  },
  {
    label: "Any dated list, unsponsored polls",
    size: "19 / 34",
    noModel: -0.56,
    estimate: { mid: -0.94, lo: -3.4, hi: 1.4 },
    dated: true,
    group: 2,
  },
  {
    label: "DW-NOMINATE captured before 2022",
    size: "36 scored",
    noModel: 0.65,
    estimate: { mid: 1.28, lo: -1.0, hi: 3.7 },
    dated: true,
    group: 2,
  },
  {
    label: "DW-NOMINATE from today's file",
    size: "66 scored",
    noModel: -0.11,
    estimate: { mid: 1.11, lo: -0.4, hi: 2.6 },
    dated: false,
    group: 2,
  },
  {
    label: "Any dated list, normal errors",
    size: "22 / 38",
    noModel: -0.18,
    estimate: { mid: -1.04, lo: -3.4, hi: 1.3 },
    dated: true,
    group: 2,
  },
  {
    label: "Any dated list, poll terms only",
    size: "22 / 38",
    noModel: -0.18,
    estimate: { mid: -1.35, lo: -3.7, hi: 1.0 },
    dated: true,
    group: 2,
  },
  {
    label: "Any dated list, no party support",
    size: "22 / 38",
    noModel: -0.18,
    estimate: { mid: -0.57, lo: -2.7, hi: 1.6 },
    dated: true,
    group: 2,
  },
  {
    label: "Any dated list, + opponent's DW-NOMINATE",
    size: "22 / 38",
    noModel: -0.18,
    estimate: { mid: -0.88, lo: -3.3, hi: 1.4 },
    dated: false,
    group: 2,
  },
];

/** Section 7.2, cell 46: nominees on no list (122) or on both (2). */
export const openNominees = 124;

export type RelabelStep = {
  /** Percent of the open nominees given a bucket after the result. */
  share: number;
  /** How many of the 124 that is. */
  nominees: number;
  /** 2018 and 2022 as they happened: difference in means over 1,000 draws. */
  real: Estimate;
  /** 400 simulated pairs of elections with no ideology effect. */
  simulated: Estimate;
  /** Share of the simulated worlds with a difference above +2 points. */
  above2: number;
};

/** Section 7.2, cell 46 (real) and section 7.3, cell 48 (simulated). */
export const relabelling: RelabelStep[] = [
  {
    share: 0,
    nominees: 0,
    real: { mid: -0.2, lo: -0.2, hi: -0.2 },
    simulated: { mid: 0.1, lo: -2.1, hi: 2.7 },
    above2: 0.14,
  },
  {
    share: 5,
    nominees: 6,
    real: { mid: 0.7, lo: 0.2, hi: 1.4 },
    simulated: { mid: 1.1, lo: -1.1, hi: 3.4 },
    above2: 0.26,
  },
  {
    share: 10,
    nominees: 12,
    real: { mid: 1.4, lo: 0.8, hi: 2.2 },
    simulated: { mid: 1.8, lo: -0.2, hi: 4.0 },
    above2: 0.44,
  },
  {
    share: 20,
    nominees: 25,
    real: { mid: 2.6, lo: 1.9, hi: 3.5 },
    simulated: { mid: 3.1, lo: 1.1, hi: 5.1 },
    above2: 0.83,
  },
  {
    share: 30,
    nominees: 37,
    real: { mid: 3.5, lo: 2.7, hi: 4.3 },
    simulated: { mid: 3.9, lo: 2.1, hi: 5.7 },
    above2: 0.95,
  },
  {
    share: 50,
    nominees: 62,
    real: { mid: 4.7, lo: 4.0, hi: 5.3 },
    simulated: { mid: 5.0, lo: 3.6, hi: 6.6 },
    above2: 1.0,
  },
  {
    share: 75,
    nominees: 93,
    real: { mid: 5.6, lo: 5.1, hi: 6.0 },
    simulated: { mid: 5.9, lo: 4.6, hi: 7.4 },
    above2: 1.0,
  },
  {
    share: 100,
    nominees: 124,
    real: { mid: 6.2, lo: 6.2, hi: 6.2 },
    simulated: { mid: 6.6, lo: 5.3, hi: 7.8 },
    above2: 1.0,
  },
];

/**
 * Section 7.2, cell 46, second table: the full model refitted on one draw of
 * relabelled buckets at four shares. The first entry is the full model on the
 * dated labels (section 5, cell 34).
 */
export const relabelledModel: { share: number; estimate: Estimate }[] = [
  { share: 0, estimate: fullModel },
  { share: 10, estimate: { mid: 0.38, lo: -1.7, hi: 2.4 } },
  { share: 25, estimate: { mid: 1.76, lo: -0.0, hi: 3.6 } },
  { share: 50, estimate: { mid: 3.32, lo: 1.7, hi: 4.9 } },
  { share: 100, estimate: { mid: 4.35, lo: 3.1, hi: 5.6 } },
];

/** Signed number with a real minus sign, for labels. */
export function signed(value: number, digits = 1): string {
  const text = Math.abs(value).toFixed(digits);
  if (Number(text) === 0) return text;
  return `${value < 0 ? "−" : "+"}${text}`;
}
