import type { ReactNode } from "react";

/** Small line icons (24x24, drawn with the current text colour). No icon library is needed for these few. */
const draw = (paths: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {paths}
  </svg>
);

export const icons = {
  rupee: draw(
    <>
      <path d="M7 5h10M7 9h10M7 5c5 0 7 2 7 4s-2 4-7 4l7 6" />
    </>
  ),
  calendar: draw(
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  receipt: draw(
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  heart: draw(<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />),
  folder: draw(<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-10z" />),
  checkCircle: draw(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12.3 2.4 2.4 4.6-5" />
    </>
  ),
  users: draw(
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19c.4-3.2 2.8-5 5.5-5s5.1 1.8 5.5 5" />
      <path d="M15.5 5.6a3 3 0 0 1 0 5.8M17.5 14.3c1.7.5 2.8 2 3 4.2" />
    </>
  ),
  fileText: draw(
    <>
      <path d="M6 3h8l4 4v14H6V3z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </>
  ),
  shield: draw(
    <>
      <path d="M12 3 5 6v5.5c0 4.2 2.8 7.4 7 9.5 4.2-2.1 7-5.3 7-9.5V6l-7-3z" />
      <path d="m9 12 2.2 2.2 3.8-4" />
    </>
  ),
  trend: draw(
    <>
      <path d="M4 17 9.5 11.5l3.5 3.5L20 8" />
      <path d="M15 8h5v5" />
    </>
  ),
  target: draw(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  lock: draw(
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  dashboard: draw(
    <>
      <rect x="3.5" y="3.5" width="7" height="8" rx="1.8" />
      <rect x="13.5" y="3.5" width="7" height="5" rx="1.8" />
      <rect x="13.5" y="11.5" width="7" height="9" rx="1.8" />
      <rect x="3.5" y="14.5" width="7" height="6" rx="1.8" />
    </>
  ),
  chart: draw(
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />
    </>
  ),
  cross: draw(
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  idCard: draw(
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <circle cx="9" cy="11" r="2" />
      <path d="M5.8 16c.5-1.6 1.7-2.4 3.2-2.4s2.7.8 3.2 2.4M14.5 10h4M14.5 13.5h3" />
    </>
  ),
  building: draw(
    <>
      <path d="M5 20V5.5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 15 5.5V20M15 9.5h2.5A1.5 1.5 0 0 1 19 11v9M3 20h18" />
      <path d="M8.5 8h3M8.5 11.5h3M8.5 15h3" />
    </>
  ),
  mail: draw(
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="m4 7.5 8 6 8-6" />
    </>
  ),
  message: draw(
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5v-8z" />
  ),
  image: draw(
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m4 17 4.5-4.5 3.5 3.5 2.5-2.5L20 17" />
    </>
  ),
  book: draw(
    <>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15z" />
      <path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3" />
    </>
  ),
  award: draw(
    <>
      <circle cx="12" cy="9" r="5.5" />
      <path d="m8.8 13.5-1.3 7 4.5-2.5 4.5 2.5-1.3-7" />
    </>
  ),
  pen: draw(
    <>
      <path d="M4 20l1-4.2L16.5 4.3a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.2 19 4 20z" />
      <path d="m14.5 6.3 3.2 3.2" />
    </>
  ),
  globe: draw(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.5 3.5 5.3 3.5 8.5s-1.1 6-3.5 8.5c-2.4-2.5-3.5-5.3-3.5-8.5s1.1-6 3.5-8.5z" />
    </>
  ),
  megaphone: draw(
    <>
      <path d="M4 10v4a1 1 0 0 0 1 1h2l8 4.5V4.5L7 9H5a1 1 0 0 0-1 1z" />
      <path d="M18.5 9.5a4 4 0 0 1 0 5M7 15l1 5h2.5l-.8-4.2" />
    </>
  ),
  logout: draw(
    <>
      <path d="M10 4.5H6.5A2 2 0 0 0 4.5 6.5v11a2 2 0 0 0 2 2H10M15 8l4 4-4 4M19 12H9.5" />
    </>
  ),
  external: draw(<path d="M14 4h6v6M20 4l-8.5 8.5M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />)
};

export type IconName = keyof typeof icons;
