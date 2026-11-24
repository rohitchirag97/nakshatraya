// Small stroke icons (24px grid), currentColor.
type P = { className?: string };
const I = ({ d, className = "icon" }: { d: string; className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);
export const Sparkle = (p: P) => (
  <I
    {...p}
    d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"
  />
);
export const Chart = (p: P) => <I {...p} d="M3 3h18v18H3zM3 3l18 18M21 3L3 21M12 3l9 9-9 9-9-9z" />;
export const Globe = (p: P) => (
  <I
    {...p}
    d="M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"
  />
);
export const Bolt = (p: P) => <I {...p} d="M13 2L4 14h7l-1 8 9-12h-7z" />;
export const Shield = (p: P) => (
  <I {...p} d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6zM9 12l2 2 4-4" />
);
export const Clock = (p: P) => <I {...p} d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2" />;
export const Download = (p: P) => <I {...p} d="M12 3v12M7 10l5 5 5-5M4 21h16" />;
export const Plus = (p: P) => <I {...p} d="M12 5v14M5 12h14" />;
export const Check = (p: P) => <I {...p} d="M5 12l4 4 10-10" />;
export const Scroll = (p: P) => (
  <I
    {...p}
    d="M6 3h11a2 2 0 012 2v14a2 2 0 01-2 2H7a3 3 0 01-3-3V5a2 2 0 012-2zM8 8h7M8 12h7M8 16h4"
  />
);
export const Printer = (p: P) => (
  <I
    {...p}
    d="M7 9V3h10v6M7 17H5a2 2 0 01-2-2v-4a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2h-2M7 14h10v7H7z"
  />
);
export const Wallet = (p: P) => (
  <I {...p} d="M3 7a2 2 0 012-2h13v4M3 7v11a2 2 0 002 2h15V9H5a2 2 0 01-2-2zM16 14.5h.01" />
);
