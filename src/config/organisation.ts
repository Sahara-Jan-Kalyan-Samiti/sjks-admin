/** Identity of the organisation, used on the member ID card. (The full list lives in sjks-frontend src/config/site.ts.) */
export const site = {
  name: "Sahara Jan Kalyan Samiti",
  regLine: "Reg. No. 4666/19-10-04",
  website: "www.saharangosag.com",
  /** Public website, for the "View website" links. */
  url: (import.meta.env.VITE_SITE_URL as string | undefined) || "https://www.saharangosag.com"
};
