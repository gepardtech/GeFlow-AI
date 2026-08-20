import { useEffect } from "react";
import { usePlatformSettings } from "@/components/PlatformSettingsProvider";
import { supabase } from "@/integrations/supabase/client";

/**
 * Live interface-language engine.
 *
 * The admin picks an interface language in Settings › General. Instead of
 * shipping static locale files for every screen, we translate the rendered
 * UI text nodes on the fly through the translate-batch function and cache
 * every string in localStorage, so a language only costs AI calls once.
 */

const LANG_NAMES: Record<string, string> = {
  "en-US": "English",
  "en-GB": "English",
  "ur-PK": "Urdu",
  "ar-SA": "Arabic",
  "hi-IN": "Hindi",
  "fr-FR": "French",
  "es-ES": "Spanish",
  "de-DE": "German",
  "zh-CN": "Chinese (Simplified)",
  "tr-TR": "Turkish",
  "pt-BR": "Portuguese (Brazil)",
  "id-ID": "Indonesian",
  "ru-RU": "Russian",
  "ja-JP": "Japanese",
  "bn-BD": "Bengali",
};

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA", "SVG", "PATH"]);
const isTranslatable = (s: string) => {
  const t = s.trim();
  if (t.length < 2 || t.length > 400) return false;
  if (!/[A-Za-z]{2}/.test(t)) return false;          // numbers / symbols only
  if (/^[\d\s.,%$₨€£¥+\-/:()]+$/.test(t)) return false;
  if (/^https?:\/\//.test(t) || /@\w+\./.test(t)) return false;
  return true;
};

type Dict = Record<string, string>;

const cacheKey = (lang: string) => `geflow.i18n.${lang}`;
const loadDict = (lang: string): Dict => {
  try { return JSON.parse(localStorage.getItem(cacheKey(lang)) || "{}"); } catch { return {}; }
};
const saveDict = (lang: string, dict: Dict) => {
  try { localStorage.setItem(cacheKey(lang), JSON.stringify(dict)); } catch { /* quota */ }
};

const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const { settings } = usePlatformSettings();
  const lang = (settings?.interface_language as string) ?? "en-US";

  useEffect(() => {
    const target = LANG_NAMES[lang];
    // English (or unknown locale) → leave the DOM untouched.
    if (!target || lang.startsWith("en")) {
      if (sessionStorage.getItem("geflow.i18n.applied")) {
        sessionStorage.removeItem("geflow.i18n.applied");
        window.location.reload();
      }
      return;
    }

    let cancelled = false;
    const dict: Dict = loadDict(lang);
    const originals = new WeakMap<Text, string>();
    const pending = new Set<string>();
    let timer: number | undefined;

    const collect = (root: Node, out: Text[]) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          const parent = (node as Text).parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
          if (parent.closest("[data-no-translate]")) return NodeFilter.FILTER_REJECT;
          return isTranslatable(node.nodeValue || "") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        },
      });
      let n = walker.nextNode();
      while (n) { out.push(n as Text); n = walker.nextNode(); }
    };

    const applyKnown = (nodes: Text[]) => {
      const misses: string[] = [];
      nodes.forEach((node) => {
        const raw = node.nodeValue || "";
        const key = raw.trim();
        const original = originals.get(node) ?? key;
        originals.set(node, original);
        const hit = dict[original];
        if (hit) {
          if (node.nodeValue !== raw.replace(key, hit)) node.nodeValue = raw.replace(key, hit);
        } else if (!pending.has(original)) {
          misses.push(original);
        }
      });
      return [...new Set(misses)];
    };

    const translateMissing = async (missing: string[]) => {
      if (!missing.length) return;
      missing.forEach((m) => pending.add(m));
      for (let i = 0; i < missing.length; i += 60) {
        const chunk = missing.slice(i, i + 60);
        try {
          const { data, error } = await supabase.functions.invoke("translate-batch", {
            body: { texts: chunk, target },
          });
          if (cancelled) return;
          const translations: string[] | undefined = data?.translations;
          if (!error && Array.isArray(translations)) {
            chunk.forEach((src, idx) => { if (translations[idx]) dict[src] = translations[idx]; });
            saveDict(lang, dict);
          }
        } catch { /* keep English for this chunk */ }
      }
      sessionStorage.setItem("geflow.i18n.applied", "1");
      if (!cancelled) sweep();
    };

    const sweep = () => {
      const nodes: Text[] = [];
      collect(document.body, nodes);
      const missing = applyKnown(nodes);
      if (missing.length) translateMissing(missing);
    };

    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(sweep, 250);
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => { cancelled = true; observer.disconnect(); window.clearTimeout(timer); };
  }, [lang]);

  return <>{children}</>;
};

export default I18nProvider;
