/**
 * Numbers copied from the printed outputs of the E95 election-night notebook
 * (https://redam94.github.io/pymc-challenges/examples/E95_election_night.html)
 * at its latest snapshot, 17:22 ET on 4 November 2026: 73 rows in the call
 * log, 69 tracked races called, 1 too close to call. Calls are projections by
 * the AP and the networks, not certified results. Generated from the page
 * text; nothing here is refitted or estimated.
 */

export type Snapshot = {
  snapshot: string;
  /** Effective sample size of the reweighted frozen draws (of 4,000). */
  ess: number;
  pHouse: number;
  pSenate: number;
  /** Democratic seats: 5%, 50%, 95%. */
  house: [number, number, number];
  senate: [number, number, number];
  /** National House margin, points: 5%, 50%, 95%. */
  national: [number, number, number];
  /** Shared polling error, points (+ = polls too Democratic): 5%, 50%, 95%. */
  pollError: [number, number, number];
};

/** Section 3.1, the replay table: the eve, then the 17 snapshots, reweighted. */
export const path: Snapshot[] = [
  {
    snapshot: "eve",
    ess: 4000,
    pHouse: 0.946,
    pSenate: 0.801,
    house: [217, 237, 262],
    senate: [48, 52, 56],
    national: [3.2, 8.0, 12.8],
    pollError: [-3.7, 1.0, 5.9],
  },
  {
    snapshot: "20:20",
    ess: 1131,
    pHouse: 0.989,
    pSenate: 0.926,
    house: [225, 243, 265],
    senate: [50, 54, 57],
    national: [5.4, 9.4, 13.5],
    pollError: [-4.4, -0.3, 3.8],
  },
  {
    snapshot: "20:50",
    ess: 2410,
    pHouse: 0.986,
    pSenate: 0.867,
    house: [222, 239, 261],
    senate: [49, 53, 56],
    national: [4.3, 8.4, 12.5],
    pollError: [-3.4, 0.6, 4.6],
  },
  {
    snapshot: "21:28",
    ess: 2410,
    pHouse: 0.986,
    pSenate: 0.867,
    house: [222, 239, 261],
    senate: [49, 53, 56],
    national: [4.3, 8.4, 12.5],
    pollError: [-3.4, 0.6, 4.6],
  },
  {
    snapshot: "23:18",
    ess: 302,
    pHouse: 1.0,
    pSenate: 1.0,
    house: [240, 254, 271],
    senate: [53, 55, 57],
    national: [8.0, 11.3, 14.5],
    pollError: [-5.3, -2.3, 0.9],
  },
  {
    snapshot: "23:45",
    ess: 114,
    pHouse: 1.0,
    pSenate: 1.0,
    house: [248, 261, 276],
    senate: [54, 56, 57],
    national: [9.8, 12.4, 14.9],
    pollError: [-5.8, -3.5, -0.8],
  },
  {
    snapshot: "00:18",
    ess: 72,
    pHouse: 1.0,
    pSenate: 1.0,
    house: [248, 262, 278],
    senate: [55, 56, 58],
    national: [9.8, 12.8, 16.2],
    pollError: [-6.6, -3.7, -1.1],
  },
  {
    snapshot: "00:30",
    ess: 66,
    pHouse: 1.0,
    pSenate: 1.0,
    house: [248, 262, 278],
    senate: [55, 56, 58],
    national: [9.8, 12.9, 16.2],
    pollError: [-6.7, -3.8, -1.1],
  },
  {
    snapshot: "01:21",
    ess: 30,
    pHouse: 1.0,
    pSenate: 1.0,
    house: [253, 264, 291],
    senate: [55, 56, 59],
    national: [10.1, 13.7, 16.2],
    pollError: [-7.0, -4.4, -1.4],
  },
  {
    snapshot: "02:21",
    ess: 4,
    pHouse: 1.0,
    pSenate: 1.0,
    house: [266, 278, 291],
    senate: [55, 57, 57],
    national: [12.7, 14.8, 16.3],
    pollError: [-6.7, -6.3, -3.9],
  },
  {
    snapshot: "03:21",
    ess: 4,
    pHouse: 1.0,
    pSenate: 1.0,
    house: [266, 278, 291],
    senate: [55, 57, 57],
    national: [12.7, 14.8, 16.3],
    pollError: [-6.7, -6.3, -3.9],
  },
  {
    snapshot: "04:21",
    ess: 6,
    pHouse: 1.0,
    pSenate: 1.0,
    house: [260, 273, 280],
    senate: [54, 55, 57],
    national: [11.7, 14.0, 15.8],
    pollError: [-7.5, -4.4, -3.3],
  },
  {
    snapshot: "08:49",
    ess: 5,
    pHouse: 1.0,
    pSenate: 1.0,
    house: [260, 266, 274],
    senate: [54, 55, 55],
    national: [11.7, 12.3, 14.0],
    pollError: [-4.8, -3.9, -3.3],
  },
  {
    snapshot: "12:21",
    ess: 5,
    pHouse: 1.0,
    pSenate: 1.0,
    house: [260, 266, 274],
    senate: [54, 55, 55],
    national: [11.7, 12.3, 14.0],
    pollError: [-4.8, -3.9, -3.3],
  },
  {
    snapshot: "13:21",
    ess: 3,
    pHouse: 1.0,
    pSenate: 1.0,
    house: [270, 272, 275],
    senate: [54, 55, 55],
    national: [13.7, 13.8, 14.0],
    pollError: [-4.8, -4.4, -3.8],
  },
  {
    snapshot: "14:21",
    ess: 3,
    pHouse: 1.0,
    pSenate: 1.0,
    house: [270, 272, 274],
    senate: [54, 55, 55],
    national: [13.7, 13.8, 14.0],
    pollError: [-4.8, -4.4, -3.8],
  },
  {
    snapshot: "16:22",
    ess: 3,
    pHouse: 1.0,
    pSenate: 1.0,
    house: [269, 272, 275],
    senate: [54, 55, 55],
    national: [13.8, 13.8, 14.0],
    pollError: [-4.8, -4.4, -3.8],
  },
  {
    snapshot: "17:22",
    ess: 2,
    pHouse: 1.0,
    pSenate: 1.0,
    house: [272, 272, 274],
    senate: [54, 55, 55],
    national: [13.8, 13.8, 14.0],
    pollError: [-4.8, -3.9, -3.8],
  },
];

/** Section 3.1 and the bulletin: the NUTS refit at 17:22 with calls and counted margins. */
export const refit: Snapshot = {
  snapshot: "refit",
  ess: 4000,
  pHouse: 1.0,
  pSenate: 1.0,
  house: [260, 271, 284],
  senate: [54, 55, 56],
  national: [11.7, 13.9, 16.2],
  pollError: [-7.0, -4.9, -2.8],
};

export type Call = {
  race: string;
  winner: "D" | "R";
  /** Frozen chance of a Democratic win. */ pD: number;
};

/** Section 3.2: every race called by 17:22 ET, with its chance on the eve. */
export const calls: Call[] = [
  { race: "NC-01", winner: "D", pD: 0.761 },
  { race: "PA-01", winner: "D", pD: 0.5655 },
  { race: "MI-04", winner: "D", pD: 0.398 },
  { race: "IA-S", winner: "D", pD: 0.566 },
  { race: "OK-S", winner: "R", pD: 0.0 },
  { race: "SC-S", winner: "D", pD: 0.3875 },
  { race: "PA-10", winner: "D", pD: 0.603 },
  { race: "IN-05", winner: "D", pD: 0.18 },
  { race: "IA-02", winner: "D", pD: 0.664 },
  { race: "VA-02", winner: "D", pD: 0.697 },
  { race: "VA-S", winner: "D", pD: 0.9985 },
  { race: "MA-S", winner: "D", pD: 1.0 },
  { race: "CA-22", winner: "D", pD: 0.834 },
  { race: "WA-03", winner: "D", pD: 0.7655 },
  { race: "SD-S", winner: "R", pD: 0.0035 },
  { race: "ID-S", winner: "R", pD: 0.007 },
  { race: "KY-06", winner: "D", pD: 0.5585 },
  { race: "DE-S", winner: "D", pD: 1.0 },
  { race: "KY-S", winner: "R", pD: 0.003 },
  { race: "NJ-S", winner: "D", pD: 1.0 },
  { race: "TX-S", winner: "D", pD: 0.7685 },
  { race: "FL-14", winner: "D", pD: 0.824 },
  { race: "WI-01", winner: "D", pD: 0.451 },
  { race: "PA-08", winner: "D", pD: 0.559 },
  { race: "AL-02", winner: "D", pD: 0.504 },
  { race: "OH-09", winner: "D", pD: 0.8215 },
  { race: "TX-35", winner: "D", pD: 0.5995 },
  { race: "OH-07", winner: "D", pD: 0.488 },
  { race: "CO-08", winner: "D", pD: 0.691 },
  { race: "WI-03", winner: "D", pD: 0.562 },
  { race: "TX-23", winner: "D", pD: 0.2605 },
  { race: "FL-22", winner: "D", pD: 0.498 },
  { race: "OH-15", winner: "D", pD: 0.1995 },
  { race: "PA-07", winner: "D", pD: 0.7765 },
  { race: "NJ-07", winner: "D", pD: 0.8185 },
  { race: "WV-S", winner: "R", pD: 0.0 },
  { race: "WY-S", winner: "R", pD: 0.0 },
  { race: "MI-10", winner: "D", pD: 0.518 },
  { race: "MI-07", winner: "D", pD: 0.7585 },
  { race: "TX-15", winner: "D", pD: 0.56 },
  { race: "OR-S", winner: "D", pD: 1.0 },
  { race: "LA-S", winner: "R", pD: 0.077 },
  { race: "MT-S", winner: "R", pD: 0.026 },
  { race: "MI-S", winner: "D", pD: 0.8805 },
  { race: "NE-S", winner: "R", pD: 0.1435 },
  { race: "NE-01", winner: "R", pD: 0.264 },
  { race: "VA-01", winner: "D", pD: 0.3535 },
  { race: "IA-03", winner: "D", pD: 0.642 },
  { race: "MO-02", winner: "D", pD: 0.4345 },
  { race: "FL-S", winner: "R", pD: 0.1375 },
  { race: "RI-S", winner: "D", pD: 1.0 },
  { race: "NH-S", winner: "D", pD: 0.974 },
  { race: "GA-S", winner: "D", pD: 0.9935 },
  { race: "ME-S", winner: "D", pD: 0.869 },
  { race: "AR-S", winner: "R", pD: 0.0045 },
  { race: "TN-S", winner: "R", pD: 0.0 },
  { race: "AL-S", winner: "R", pD: 0.0 },
  { race: "MN-S", winner: "D", pD: 0.9525 },
  { race: "KS-S", winner: "D", pD: 0.3295 },
  { race: "NC-11", winner: "D", pD: 0.834 },
  { race: "IL-S", winner: "D", pD: 0.9985 },
  { race: "OH-S", winner: "D", pD: 0.654 },
  { race: "CO-S", winner: "D", pD: 1.0 },
  { race: "NC-S", winner: "D", pD: 0.982 },
  { race: "FL-25", winner: "D", pD: 0.7915 },
  { race: "NM-S", winner: "D", pD: 1.0 },
  { race: "TX-34", winner: "D", pD: 0.9355 },
  { race: "IA-01", winner: "D", pD: 0.4275 },
  { race: "NM-02", winner: "D", pD: 0.9155 },
];

export type Mover = {
  race: string;
  eve: number;
  previous: number;
  latest: number;
};

/** Section 4: the uncalled races that moved most between 16:22 and 17:22. */
export const movers: Mover[] = [
  { race: "NJ-02", eve: 0.068, previous: 0.343, latest: 0.297 },
  { race: "KS-02", eve: 0.064, previous: 0.38, latest: 0.339 },
  { race: "NY-21", eve: 0.075, previous: 0.426, latest: 0.388 },
  { race: "MN-08", eve: 0.044, previous: 0.276, latest: 0.239 },
  { race: "CO-05", eve: 0.357, previous: 0.844, latest: 0.808 },
  { race: "TX-10", eve: 0.037, previous: 0.275, latest: 0.24 },
  { race: "GA-07", eve: 0.063, previous: 0.353, latest: 0.318 },
  { race: "TX-09", eve: 0.049, previous: 0.331, latest: 0.297 },
  { race: "GA-11", eve: 0.056, previous: 0.314, latest: 0.282 },
  { race: "FL-13", eve: 0.264, previous: 0.731, latest: 0.7 },
  { race: "MN-01", eve: 0.279, previous: 0.774, latest: 0.744 },
  { race: "TN-09", eve: 0.159, previous: 0.552, latest: 0.521 },
];
