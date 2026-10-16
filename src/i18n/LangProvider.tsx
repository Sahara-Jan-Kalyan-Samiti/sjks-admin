import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { startDomTranslate, type DomTranslator } from "./domTranslate";

export type Lang = "en" | "hi";
interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
}
const LangContext = createContext<Ctx>({ lang: "en", setLang: () => undefined });
export const useLang = () => useContext(LangContext);

const KEY = "admin-lang";

/**
 * English or Hindi for the whole panel. Text is translated on screen from the dictionary in hi.admin.ts (loaded only when
 * Hindi is switched on), so a screen needs no extra code to be translated. The choice is remembered on this device.
 */
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      return localStorage.getItem(KEY) === "hi" ? "hi" : "en";
    } catch {
      return "en";
    }
  });
  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      // not remembered
    }
  };
  const langRef = useRef(lang);
  langRef.current = lang;
  const dom = useRef<DomTranslator | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    document.documentElement.lang = lang;
    dom.current ??= startDomTranslate(() => langRef.current === "hi");
    dom.current.refresh();
    if (lang === "hi" && !loaded.current) {
      loaded.current = true;
      import("./hi.admin")
        .then((m) => {
          dom.current?.add({ ...m.hiAdmin, ...m.hiAdminMore });
          dom.current?.addPatterns(m.hiAdminPatterns);
        })
        .catch(() => {
          loaded.current = false;
        });
    }
  }, [lang]);

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

/** The EN / हिंदी switch (sign-in page and top bar). */
export function LanguageSwitch() {
  const { lang, setLang } = useLang();
  return (
    <div className="lang-switch" role="group" aria-label="Language" data-no-translate="">
      <button type="button" className="ghost sm" aria-pressed={lang === "en"} onClick={() => setLang("en")}>
        EN
      </button>
      <button type="button" className="ghost sm" aria-pressed={lang === "hi"} onClick={() => setLang("hi")}>
        हिंदी
      </button>
    </div>
  );
}
