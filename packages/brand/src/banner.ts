/**
 * Mimi Code — ASCII Art Assets
 * Style: "Chirpy" (side-view parrot with hooked beak)
 *
 * All art uses ANSI true-color (24-bit) escape codes.
 * Fallback to plain text for terminals without color support.
 */

// ─── Color palette ───────────────────────────────────────────────────────────

const C = {
  y:  '\x1b[38;2;255;215;0m',     // golden yellow (body)
  ly: '\x1b[38;2;255;245;157m',   // light yellow (highlights/feathers)
  dy: '\x1b[38;2;194;154;0m',     // dark yellow (shadows)
  bk: '\x1b[38;2;30;30;30m',      // black (eye)
  br: '\x1b[38;2;139;105;20m',    // brown (beak)
  pk: '\x1b[38;2;228;160;160m',   // pink (feet)
  gr: '\x1b[38;2;110;118;129m',   // gray (frame/text)
  wh: '\x1b[38;2;255;255;255m',   // white (title)
  cy: '\x1b[38;2;121;192;255m',   // cyan (prompt accent)
  gn: '\x1b[38;2;126;231;135m',   // green (success)
  rd: '\x1b[38;2;255;123;114m',   // red (error)
  yw: '\x1b[38;2;255;215;0m',     // warning yellow
  r:  '\x1b[0m',                   // reset
} as const;

// ─── Startup Banner ──────────────────────────────────────────────────────────

export function banner(version: string): string {
  const { y, ly, dy, bk, br, pk, gr, wh, r } = C;
  return `
${gr}    ╭───────────────────────────────────────────╮${r}
${gr}    │${r}                                             ${gr}│${r}
${gr}    │${r}  ${dy}          .▄▄▄▄.${r}                          ${gr}│${r}
${gr}    │${r}  ${y}        ▄▀${ly}░░░░░░${y}▀▄${r}                        ${gr}│${r}
${gr}    │${r}  ${y}       █${ly}░░${bk}●${ly}░░░░░░${y}█${r}                       ${gr}│${r}
${gr}    │${r}  ${y}       █${ly}░░░${br}▄██▀▀▀▔╲${r}   ${wh}M I M I  C O D E${r}  ${gr}│${r}
${gr}    │${r}  ${y}        █${ly}░░${br}▀▀▀▀▀▀▀${r}    ${gr}~chirp chirp!~${r}  ${gr}│${r}
${gr}    │${r}  ${y}        █${ly}░░░░░░░${y}█${r}                       ${gr}│${r}
${gr}    │${r}  ${dy}       █${y}░╱░░░░╲░${dy}█${r}   ${gr}v${version}${r}${' '.repeat(Math.max(0, 18 - version.length))}${gr}│${r}
${gr}    │${r}  ${dy}        ▀█${y}░░░░${dy}█▀${r}                        ${gr}│${r}
${gr}    │${r}  ${pk}          ╫╫╫╫${r}                           ${gr}│${r}
${gr}    │${r}  ${gr}       ═══╧══╧═══${r}                       ${gr}│${r}
${gr}    │${r}                                             ${gr}│${r}
${gr}    ╰───────────────────────────────────────────╯${r}
`;
}

// ─── Plain text banner (no color support) ────────────────────────────────────

export function bannerPlain(version: string): string {
  return `
    ╭───────────────────────────────────────────╮
    │                                             │
    │            .▄▄▄▄.                           │
    │          ▄▀░░░░░░▀▄                         │
    │         █░░●░░░░░░█                         │
    │         █░░░▄██▀▀▀▔╲   M I M I  C O D E    │
    │          █░░▀▀▀▀▀▀▀    ~chirp chirp!~       │
    │          █░░░░░░░█                           │
    │         █░╱░░░░╲░█   v${version}${' '.repeat(Math.max(0, 19 - version.length))}│
    │          ▀█░░░░█▀                            │
    │            ╫╫╫╫                              │
    │         ═══╧══╧═══                           │
    │                                              │
    ╰───────────────────────────────────────────╯
`;
}

// ─── Prompt icon ─────────────────────────────────────────────────────────────

export function promptIcon(): string {
  const { y, bk, br, r } = C;
  return `${y}(${bk}◕${br}▸${y})${r}`;
}

export function promptIconPlain(): string {
  return '(◕▸)';
}

// ─── Status faces ────────────────────────────────────────────────────────────

export function faceSuccess(): string {
  const { y, bk, br, gn, r } = C;
  return `${y}(${bk}◕${y}ᴗ${br}▸${y})${r}  ${gn}✓ done!${r}`;
}

export function faceError(): string {
  const { y, bk, br, rd, r } = C;
  return `${y}(${bk}◕${y}﹏${br}▸${y})${r}  ${rd}✗ oops!${r}`;
}

export function faceWarning(): string {
  const { y, bk, br, yw, r } = C;
  return `${y}(${bk}◕${y}⌓${br}▸${y})${r}  ${yw}⚠ hmm...${r}`;
}

export function faceWaiting(): string {
  const { y, bk, br, gr, r } = C;
  return `${y}(${bk}◕${br}▸${y})${gr}♪♫${r}`;
}

// ─── Spinner frames ──────────────────────────────────────────────────────────

export function spinnerFrames(): string[] {
  const icon = promptIcon();
  const { gr, r } = C;
  return [
    `${icon} ${gr}～${r}`,
    `${icon} ${gr}～～${r}`,
    `${icon} ${gr}～～～${r}`,
    `${icon} ${gr}～～～～${r}`,
  ];
}

// ─── Large art (easter egg: mimi --parrot) ───────────────────────────────────

export function parrotLarge(): string {
  const { y, ly, dy, bk, br, pk, gr, r } = C;
  return `
${dy}                  ▄▄▄▄▄▄▄▄▄▄▄${r}
${y}               ▄█▀${ly}░░░░░░░░░░░${y}▀█▄${r}
${y}             ▄█${ly}░░░░░░░░░░░░░░░░${y}█▄${r}
${y}            █${ly}░░░░${bk}●${ly}░░░░░░░░░░░░░░${y}█${r}
${y}            █${ly}░░░░░░░${br}▄▄██▀▀▀▀▀▀▀╲${r}
${y}            █${ly}░░░░░░${br}██▀            ╱${r}
${y}             █${ly}░░░░░${br}▀█▄▄▄▄▄▄▄▄▄▀${r}
${y}             █${ly}░░░░░░░░░░░░░░░░${y}█${r}
${y}            █${ly}░░░░░░░░░░░░░░░░░░${y}█${r}
${y}           █${ly}░░░${y}╱${ly}░░░░░░░░░░${y}╲${ly}░░░${y}█${r}
${y}           █${ly}░░${y}╱${ly}░░░░░░░░░░░░${y}╲${ly}░░${y}█${r}
${y}            █${ly}░░░░░░░░░░░░░░░░${y}█${r}
${dy}             █${y}░░░░░░░░░░░░░░${dy}█${r}
${dy}              ▀█${y}░░░░░░░░░░${dy}█▀${r}
${pk}                ╫╫╫╫  ╫╫╫╫${r}
${pk}               ╱╫╫╫╫  ╫╫╫╫╲${r}
${gr}           ══════╧══════╧══════${r}

${gr}    🦜  Mimi Code — Your Friendly AI Coding CLI${r}
`;
}

// ─── Goodbye message ─────────────────────────────────────────────────────────

export function goodbye(): string {
  const { y, bk, br, gr, r } = C;
  return `\n  ${y}(${bk}◕${y}ᴗ${br}▸${y})${r}  ${gr}Bye bye! See you soon~ chirp!${r}\n`;
}

// ─── Welcome back ────────────────────────────────────────────────────────────

export function welcomeBack(sessionName?: string): string {
  const { y, bk, br, gr, cy, r } = C;
  const session = sessionName ? ` ${cy}(${sessionName})${r}` : '';
  return `  ${y}(${bk}◕${y}ᴗ${br}▸${y})${r}  ${gr}Welcome back!${session} ~chirp!${r}\n`;
}
