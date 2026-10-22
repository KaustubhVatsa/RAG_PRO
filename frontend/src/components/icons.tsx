import type { SVGProps } from "react";

/**
 * A small hand-drawn icon set (24px grid, 1.75 stroke, currentColor) so we don't ship an icon
 * library for ~25 glyphs. Icons are decorative by default (aria-hidden); give the parent button an
 * aria-label instead.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 18, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12.5l4.2 4.2L19 7" />
  </Svg>
);
export const IconCross = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </Svg>
);
/** "Unsupported": a question mark in a dashed ring. */
export const IconQuestion = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" strokeDasharray="3 2.6" />
    <path d="M9.8 9.6a2.3 2.3 0 1 1 3.3 2.1c-.7.4-1.1.9-1.1 1.7" />
    <circle cx="12" cy="16.6" r=".6" fill="currentColor" />
  </Svg>
);
/** "Contradicted": two opposed arrows meeting a bar. */
export const IconContradict = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 8.5l7 7" />
  </Svg>
);
/** "Unverified": an open dotted ring (not yet judged). */
export const IconPending = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" strokeDasharray="0.1 3.4" strokeWidth={2.2} />
  </Svg>
);
export const IconSupported = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.3 12.3l2.5 2.5 4.9-5.2" />
  </Svg>
);
export const IconFlag = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 20V4.5M6 5h10.5l-2 3.5 2 3.5H6" />
  </Svg>
);
export const IconUpload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 15.5V4.5M7.5 9L12 4.5 16.5 9" />
    <path d="M4.5 15v2.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V15" />
  </Svg>
);
export const IconFile = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8z" />
    <path d="M14 3.5V8h4.5M8.5 12.5h7M8.5 16h5" />
  </Svg>
);
export const IconTrash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 7h15M10 4.5h4M6.5 7l.8 11.2a2 2 0 0 0 2 1.8h5.4a2 2 0 0 0 2-1.8L17.5 7" />
  </Svg>
);
export const IconSun = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3.8" />
    <path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4" />
  </Svg>
);
export const IconMoon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19.5 14.6A7.8 7.8 0 0 1 9.4 4.5a7.8 7.8 0 1 0 10.1 10.1z" />
  </Svg>
);
export const IconSend = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 19V5.5M6.5 11L12 5.5 17.5 11" />
  </Svg>
);
export const IconStop = (p: IconProps) => (
  <Svg {...p}>
    <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconRetry = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19 12a7 7 0 1 1-2.05-4.95M19 4.5V8h-3.5" />
  </Svg>
);
export const IconChevron = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.5 6l6 6-6 6" />
  </Svg>
);
export const IconPanel = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <path d="M14.5 4.5v15" />
  </Svg>
);
export const IconLibrary = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <path d="M9.5 4.5v15" />
  </Svg>
);
export const IconClose = IconCross;
export const IconSparkle = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5l1.7 5.3 5.3 1.7-5.3 1.7L12 17.5l-1.7-5.3L5 10.5l5.3-1.7z" />
    <path d="M18.5 16.5l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6z" />
  </Svg>
);
export const IconBook = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 5.5c2.8-1 5.3-.8 7.5.8 2.2-1.6 4.7-1.8 7.5-.8v13c-2.8-1-5.3-.8-7.5.8-2.2-1.6-4.7-1.8-7.5-.8z" />
    <path d="M12 6.3v13" />
  </Svg>
);
export const IconLens = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="M15 15l4.5 4.5" />
  </Svg>
);
export const IconLayers = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4l8.5 4.5L12 13 3.5 8.5z" />
    <path d="M3.5 12.5L12 17l8.5-4.5M3.5 16.2L12 20.7l8.5-4.5" />
  </Svg>
);
export const IconGauge = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 16.5a8 8 0 1 1 15 0" />
    <path d="M12 13.5l3.5-4" />
    <circle cx="12" cy="13.8" r="1.2" fill="currentColor" />
  </Svg>
);
export const IconBeaker = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.5 3.5h5M10 3.5v5.5L5 18.2a1.6 1.6 0 0 0 1.4 2.3h11.2a1.6 1.6 0 0 0 1.4-2.3L14 9V3.5" />
    <path d="M7.4 14h9.2" />
  </Svg>
);
export const IconAlert = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4.5l8.5 15h-17z" />
    <path d="M12 10v4.2" />
    <circle cx="12" cy="16.9" r=".6" fill="currentColor" />
  </Svg>
);
export const IconQuote = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 7.5H6.5v5h3.5v-1.5c0 2.2-1.2 3.7-3.5 4.5M17.5 7.5H14v5h3.5v-1.5c0 2.2-1.2 3.7-3.5 4.5" />
  </Svg>
);
export const IconExternal = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13.5 5.5h5v5M18.5 5.5L11 13M16 14v4a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 5 18v-8a1.5 1.5 0 0 1 1.5-1.5h4" />
  </Svg>
);
export const IconTerminal = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
    <path d="M7.5 10l2.5 2-2.5 2M12.5 14.5h4" />
  </Svg>
);
