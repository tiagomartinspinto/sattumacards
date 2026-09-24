const SUPPORTED_LANGUAGES = ["fi", "en"];
const DEFAULT_LANGUAGE = "fi";
const TEXT_TARGETS = { "data-i18n": "textContent", "data-i18n-html": "innerHTML" };
const ATTRIBUTE_TARGETS = {
  "data-i18n-placeholder": "placeholder",
  "data-i18n-title": "title",
  "data-i18n-aria-label": "aria-label",
};
const CONTENT_FILES = {
  instructionsContent: "instructions.html",
  historyContent: "about.html",
  contactsContent: "contacts.html",
};

function getRequestedLanguage() {
  return new URLSearchParams(window.location.search).get("lang");
}

function getInitialLanguage() {
  const requestedLanguage = getRequestedLanguage();

  if (SUPPORTED_LANGUAGES.includes(requestedLanguage)) {
    return requestedLanguage;
  }

  const savedLanguage = localStorage.getItem("sattumaLanguage");
  return SUPPORTED_LANGUAGES.includes(savedLanguage) ? savedLanguage : DEFAULT_LANGUAGE;
}

async function fetchDictionary(language) {
  const response = await fetch(`./i18n/${language}.json`);

  if (!response.ok) {
    throw new Error(`Could not load language file: ${language}`);
  }

  return response.json();
}

export function createI18n() {
  const listeners = new Set();
  const dictionaries = {};
  const contentCache = {};
  let language = getInitialLanguage();
  let translationTargets = null;
  const servedText = new Map();

  // Every translatable value keeps the text it was served with in index.html. That
  // markup is the last fallback, so a missing dictionary never replaces usable copy
  // with an internal key.
  function getTranslationTargets() {
    if (!translationTargets) {
      translationTargets = [];
      const capture = (key, served, write) => {
        translationTargets.push({ key, served, write });
        if (served && !servedText.has(key)) {
          servedText.set(key, served.replace(/\s+/g, " ").trim());
        }
      };

      Object.entries(TEXT_TARGETS).forEach(([dataAttribute, property]) => {
        document.querySelectorAll(`[${dataAttribute}]`).forEach((element) => {
          capture(element.getAttribute(dataAttribute), element[property], (value) => {
            element[property] = value;
          });
        });
      });

      Object.entries(ATTRIBUTE_TARGETS).forEach(([dataAttribute, attribute]) => {
        document.querySelectorAll(`[${dataAttribute}]`).forEach((element) => {
          capture(
            element.getAttribute(dataAttribute),
            element.getAttribute(attribute),
            (value) => element.setAttribute(attribute, value)
          );
        });
      });
    }

    return translationTargets;
  }

  function lookup(key) {
    return dictionaries[language]?.[key] || dictionaries[DEFAULT_LANGUAGE]?.[key];
  }

  // Callers such as room.js rely on an unknown key coming back unchanged, so the key
  // stays the final fallback after the dictionaries and the served page text.
  function t(key) {
    getTranslationTargets();
    return lookup(key) || servedText.get(key) || key;
  }

  function applyTranslations() {
    document.documentElement.lang = language;

    getTranslationTargets().forEach(({ key, served, write }) => {
      const value = lookup(key) ?? served;

      if (value != null) {
        write(value);
      }
    });
  }

  async function loadModalContent() {
    if (!contentCache[language]) {
      contentCache[language] = {};
    }

    await Promise.all(
      Object.entries(CONTENT_FILES).map(async ([contentId, fileName]) => {
        const contentElement = document.getElementById(contentId);

        if (!contentElement) {
          return;
        }

        if (!contentCache[language][fileName]) {
          try {
            const response = await fetch(`./content/${language}/${fileName}`);

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            contentCache[language][fileName] = await response.text();
          } catch (error) {
            // Modal copy is optional: keep whatever the modal already shows.
            console.error(`Could not load ${language} modal content ${fileName}`, error);
            return;
          }
        }

        contentElement.innerHTML = contentCache[language][fileName];
      })
    );
  }

  // Failures are not cached, so a later switch retries a dictionary that failed once.
  async function getDictionary(dictionaryLanguage) {
    if (!dictionaries[dictionaryLanguage]) {
      try {
        dictionaries[dictionaryLanguage] = await fetchDictionary(dictionaryLanguage);
      } catch (error) {
        console.error(
          `Could not load the ${dictionaryLanguage} translation dictionary`,
          error
        );
        return null;
      }
    }

    return dictionaries[dictionaryLanguage];
  }

  // Switches only once the requested dictionary is available, so a failed load leaves
  // the current language fully in place. Finnish is fetched alongside as the per-key
  // fallback but is never a prerequisite. Returns whether the switch happened.
  async function loadLanguage(nextLanguage, { remember = true } = {}) {
    if (!SUPPORTED_LANGUAGES.includes(nextLanguage)) {
      return false;
    }

    const [dictionary] = await Promise.all([
      getDictionary(nextLanguage),
      nextLanguage === DEFAULT_LANGUAGE ? null : getDictionary(DEFAULT_LANGUAGE),
    ]);

    if (!dictionary) {
      return false;
    }

    activateLanguage(nextLanguage, { remember });
    await loadModalContent();
    listeners.forEach((listener) => listener(language));
    return true;
  }

  function activateLanguage(nextLanguage, { remember }) {
    language = nextLanguage;

    if (remember) {
      localStorage.setItem("sattumaLanguage", language);
    }

    const url = new URL(window.location.href);
    url.searchParams.set("lang", language);
    window.history.replaceState({}, "", url);

    const languageSelector = document.getElementById("languageSelector");
    if (languageSelector) {
      languageSelector.value = language;
    }

    applyTranslations();
  }

  function onChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  // Always resolves, so the app becomes ready whichever dictionaries load: the
  // requested language, else Finnish, else the text served in index.html. A fallback
  // does not overwrite the visitor's saved language preference.
  async function init() {
    getTranslationTargets();
    const requestedLanguage = language;
    const loaded =
      (await loadLanguage(requestedLanguage)) ||
      (requestedLanguage !== DEFAULT_LANGUAGE &&
        (await loadLanguage(DEFAULT_LANGUAGE, { remember: false })));

    if (!loaded) {
      activateLanguage(DEFAULT_LANGUAGE, { remember: false });
    }

    const languageSelector = document.getElementById("languageSelector");
    if (languageSelector) {
      languageSelector.addEventListener("change", async () => {
        if (!(await loadLanguage(languageSelector.value))) {
          languageSelector.value = language;
        }
      });
    }
  }

  return {
    get language() {
      return language;
    },
    init,
    loadLanguage,
    onChange,
    t,
  };
}
