/**
 * Lightweight bundled Lottie v5 JSON payloads for Masar status telemetry.
 * Strictly local — zero external CDN fetches so Wails embed.FS runs 100% offline.
 */

// Helper to build a static animated scalar/vector property
const kStatic = (v) => ({ a: 0, k: v });

// Helper to build smooth cubic-bezier keyframe transition
const kf = (t, s, e, h = 0) => ({
  t,
  s: Array.isArray(s) ? s : [s],
  e: Array.isArray(e) ? e : [e],
  i: { x: [0.16], y: [1] },
  o: { x: [0.4], y: [0] },
  ...(h ? { h: 1 } : {}),
});

/** 1. Success Checkmark + Ring Draw (Emerald #34D399) */
export const LOTTIE_SUCCESS = {
  v: "5.7.4",
  fr: 60,
  ip: 0,
  op: 45,
  w: 64,
  h: 64,
  nm: "MasarSuccess",
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "CheckRing",
      sr: 1,
      ks: {
        o: kStatic(100),
        r: kStatic(0),
        p: kStatic([32, 32, 0]),
        a: kStatic([0, 0, 0]),
        s: {
          a: 1,
          k: [
            kf(0, [84, 84, 100], [106, 106, 100]),
            kf(18, [106, 106, 100], [100, 100, 100]),
            { t: 30, s: [100, 100, 100] },
          ],
        },
      },
      shapes: [
        {
          ty: "gr",
          nm: "CircleGroup",
          it: [
            { ty: "el", d: 1, s: kStatic([48, 48]), p: kStatic([0, 0]), nm: "Ring" },
            {
              ty: "tm",
              s: kStatic(0),
              e: {
                a: 1,
                k: [kf(0, 0, 100), { t: 22, s: 100 }],
              },
              o: kStatic(-90),
              m: 1,
              nm: "Trim",
            },
            {
              ty: "st",
              c: kStatic([0.204, 0.827, 0.6, 1]), // #34D399
              o: kStatic(100),
              w: kStatic(4.5),
              lc: 2,
              lj: 2,
            },
            {
              ty: "fl",
              c: kStatic([0.063, 0.725, 0.506, 1]),
              o: kStatic(14),
            },
            { ty: "tr", p: kStatic([0, 0]), a: kStatic([0, 0]), s: kStatic([100, 100]), r: kStatic(0), o: kStatic(100) },
          ],
        },
        {
          ty: "gr",
          nm: "CheckGroup",
          it: [
            {
              ty: "sh",
              d: 1,
              ks: kStatic({
                i: [[0, 0], [0, 0], [0, 0]],
                o: [[0, 0], [0, 0], [0, 0]],
                v: [[-11, 1], [-3, 9], [12, -8]],
                c: false,
              }),
            },
            {
              ty: "tm",
              s: kStatic(0),
              e: {
                a: 1,
                k: [kf(10, 0, 100), { t: 28, s: 100 }],
              },
              o: kStatic(0),
              m: 1,
              nm: "TrimCheck",
            },
            {
              ty: "st",
              c: kStatic([0.204, 0.827, 0.6, 1]),
              o: kStatic(100),
              w: kStatic(5),
              lc: 2,
              lj: 2,
            },
            { ty: "tr", p: kStatic([0, 0]), a: kStatic([0, 0]), s: kStatic([100, 100]), r: kStatic(0), o: kStatic(100) },
          ],
        },
      ],
      ip: 0,
      op: 45,
      st: 0,
    },
  ],
};

/** 2. Smooth Apple-Glass Orbital Loader (Sky #38BDF8 + Emerald #2DD4BF) */
export const LOTTIE_LOADING = {
  v: "5.7.4",
  fr: 60,
  ip: 0,
  op: 60,
  w: 64,
  h: 64,
  nm: "MasarLoading",
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "OuterArc",
      sr: 1,
      ks: {
        o: kStatic(100),
        r: {
          a: 1,
          k: [
            { t: 0, s: [0], e: [360], i: { x: [1], y: [1] }, o: { x: [0], y: [0] } },
            { t: 60, s: [360] },
          ],
        },
        p: kStatic([32, 32, 0]),
        a: kStatic([0, 0, 0]),
        s: kStatic([100, 100, 100]),
      },
      shapes: [
        {
          ty: "gr",
          it: [
            { ty: "el", d: 1, s: kStatic([46, 46]), p: kStatic([0, 0]) },
            { ty: "tm", s: kStatic(0), e: kStatic(68), o: kStatic(0), m: 1 },
            { ty: "st", c: kStatic([0.22, 0.741, 0.973, 1]), o: kStatic(100), w: kStatic(5), lc: 2, lj: 2 },
            { ty: "tr", p: kStatic([0, 0]), a: kStatic([0, 0]), s: kStatic([100, 100]), r: kStatic(0), o: kStatic(100) },
          ],
        },
      ],
      ip: 0,
      op: 60,
      st: 0,
    },
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: "InnerArc",
      sr: 1,
      ks: {
        o: kStatic(85),
        r: {
          a: 1,
          k: [
            { t: 0, s: [360], e: [0], i: { x: [1], y: [1] }, o: { x: [0], y: [0] } },
            { t: 60, s: [0] },
          ],
        },
        p: kStatic([32, 32, 0]),
        a: kStatic([0, 0, 0]),
        s: kStatic([100, 100, 100]),
      },
      shapes: [
        {
          ty: "gr",
          it: [
            { ty: "el", d: 1, s: kStatic([30, 30]), p: kStatic([0, 0]) },
            { ty: "tm", s: kStatic(0), e: kStatic(52), o: kStatic(0), m: 1 },
            { ty: "st", c: kStatic([0.176, 0.831, 0.749, 1]), o: kStatic(90), w: kStatic(4), lc: 2, lj: 2 },
            { ty: "tr", p: kStatic([0, 0]), a: kStatic([0, 0]), s: kStatic([100, 100]), r: kStatic(0), o: kStatic(100) },
          ],
        },
      ],
      ip: 0,
      op: 60,
      st: 0,
    },
  ],
};

/** 3. Error Cross + Pulse (Coral Red #F87171) */
export const LOTTIE_ERROR = {
  v: "5.7.4",
  fr: 60,
  ip: 0,
  op: 45,
  w: 64,
  h: 64,
  nm: "MasarError",
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "ErrorRing",
      sr: 1,
      ks: {
        o: kStatic(100),
        r: kStatic(0),
        p: {
          a: 1,
          k: [
            kf(0, [32, 32, 0], [29, 32, 0]),
            kf(6, [29, 32, 0], [35, 32, 0]),
            kf(12, [35, 32, 0], [31, 32, 0]),
            kf(18, [31, 32, 0], [32, 32, 0]),
            { t: 24, s: [32, 32, 0] },
          ],
        },
        a: kStatic([0, 0, 0]),
        s: kStatic([100, 100, 100]),
      },
      shapes: [
        {
          ty: "gr",
          it: [
            { ty: "el", d: 1, s: kStatic([48, 48]), p: kStatic([0, 0]) },
            { ty: "tm", s: kStatic(0), e: { a: 1, k: [kf(0, 0, 100), { t: 18, s: 100 }] }, o: kStatic(-90), m: 1 },
            { ty: "st", c: kStatic([0.973, 0.443, 0.443, 1]), o: kStatic(100), w: kStatic(4.5), lc: 2, lj: 2 },
            { ty: "fl", c: kStatic([0.937, 0.267, 0.267, 1]), o: kStatic(14) },
            { ty: "tr", p: kStatic([0, 0]), a: kStatic([0, 0]), s: kStatic([100, 100]), r: kStatic(0), o: kStatic(100) },
          ],
        },
        {
          ty: "gr",
          it: [
            {
              ty: "sh",
              d: 1,
              ks: kStatic({ i: [[0, 0], [0, 0]], o: [[0, 0], [0, 0]], v: [[-9, -9], [9, 9]], c: false }),
            },
            { ty: "tm", s: kStatic(0), e: { a: 1, k: [kf(10, 0, 100), { t: 22, s: 100 }] }, o: kStatic(0), m: 1 },
            { ty: "st", c: kStatic([0.973, 0.443, 0.443, 1]), o: kStatic(100), w: kStatic(5), lc: 2, lj: 2 },
            { ty: "tr", p: kStatic([0, 0]), a: kStatic([0, 0]), s: kStatic([100, 100]), r: kStatic(0), o: kStatic(100) },
          ],
        },
        {
          ty: "gr",
          it: [
            {
              ty: "sh",
              d: 1,
              ks: kStatic({ i: [[0, 0], [0, 0]], o: [[0, 0], [0, 0]], v: [[9, -9], [-9, 9]], c: false }),
            },
            { ty: "tm", s: kStatic(0), e: { a: 1, k: [kf(16, 0, 100), { t: 28, s: 100 }] }, o: kStatic(0), m: 1 },
            { ty: "st", c: kStatic([0.973, 0.443, 0.443, 1]), o: kStatic(100), w: kStatic(5), lc: 2, lj: 2 },
            { ty: "tr", p: kStatic([0, 0]), a: kStatic([0, 0]), s: kStatic([100, 100]), r: kStatic(0), o: kStatic(100) },
          ],
        },
      ],
      ip: 0,
      op: 45,
      st: 0,
    },
  ],
};

/** 4. Warning Amber Pulse (Amber #FBBF24) */
export const LOTTIE_WARNING = {
  v: "5.7.4",
  fr: 60,
  ip: 0,
  op: 90,
  w: 64,
  h: 64,
  nm: "MasarWarning",
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "WarningShape",
      sr: 1,
      ks: {
        o: kStatic(100),
        r: kStatic(0),
        p: kStatic([32, 32, 0]),
        a: kStatic([0, 0, 0]),
        s: {
          a: 1,
          k: [
            kf(0, [96, 96, 100], [105, 105, 100]),
            kf(45, [105, 105, 100], [96, 96, 100]),
            { t: 90, s: [96, 96, 100] },
          ],
        },
      },
      shapes: [
        {
          ty: "gr",
          it: [
            { ty: "el", d: 1, s: kStatic([48, 48]), p: kStatic([0, 0]) },
            { ty: "st", c: kStatic([0.984, 0.749, 0.141, 1]), o: kStatic(100), w: kStatic(4.5), lc: 2, lj: 2 },
            { ty: "fl", c: kStatic([0.961, 0.62, 0.043, 1]), o: kStatic(16) },
            { ty: "tr", p: kStatic([0, 0]), a: kStatic([0, 0]), s: kStatic([100, 100]), r: kStatic(0), o: kStatic(100) },
          ],
        },
        {
          ty: "gr",
          it: [
            { ty: "sh", d: 1, ks: kStatic({ i: [[0, 0], [0, 0]], o: [[0, 0], [0, 0]], v: [[0, -11], [0, 3]], c: false }) },
            { ty: "st", c: kStatic([0.984, 0.749, 0.141, 1]), o: kStatic(100), w: kStatic(5), lc: 2, lj: 2 },
            { ty: "tr", p: kStatic([0, 0]), a: kStatic([0, 0]), s: kStatic([100, 100]), r: kStatic(0), o: kStatic(100) },
          ],
        },
        {
          ty: "gr",
          it: [
            { ty: "el", d: 1, s: kStatic([5.5, 5.5]), p: kStatic([0, 11]) },
            { ty: "fl", c: kStatic([0.984, 0.749, 0.141, 1]), o: kStatic(100) },
            { ty: "tr", p: kStatic([0, 0]), a: kStatic([0, 0]), s: kStatic([100, 100]), r: kStatic(0), o: kStatic(100) },
          ],
        },
      ],
      ip: 0,
      op: 90,
      st: 0,
    },
  ],
};
