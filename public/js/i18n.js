const SUPPORTED_LANGUAGES = ["fi", "en"];
const DEFAULT_LANGUAGE = "fi";
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
  return SUPPORTED_LANGUAGES.includes(savedLanguage)
    ? savedLanguage
    : DEFAULT_LANGUAGE;
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
  let language = getInitialLanguage();

  function t(key) {
    return (
      dictionaries[language]?.[key] ||
      dictionaries[DEFAULT_LANGUAGE]?.[key] ||
      key
    );
  }

  function applyTranslations() {
    document.documentElement.lang = language;

    document.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = t(element.dataset.i18n);
    });

    document.querySelectorAll("[data-i18n-html]").forEach((element) => {
      element.innerHTML = t(element.dataset.i18nHtml);
    });

    document.querySelectorAll("[data-i18n-title]").forEach((element) => {
      element.setAttribute("title", t(element.dataset.i18nTitle));
    });

    document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
      element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
    });
  }

  async function loadModalContent() {
    await Promise.all(
      Object.entries(CONTENT_FILES).map(async ([contentId, fileName]) => {
        const contentElement = document.getElementById(contentId);

        if (!contentElement) {
          return;
        }

        const response = await fetch(`./content/${language}/${fileName}`);

        if (!response.ok) {
          throw new Error(`Could not load content file: ${fileName}`);
        }

        contentElement.innerHTML = await response.text();
      })
    );
  }

  async function loadLanguage(nextLanguage) {
    if (!SUPPORTED_LANGUAGES.includes(nextLanguage)) {
      return;
    }

    if (!dictionaries[DEFAULT_LANGUAGE]) {
      dictionaries[DEFAULT_LANGUAGE] = await fetchDictionary(DEFAULT_LANGUAGE);
    }

    if (!dictionaries[nextLanguage]) {
      dictionaries[nextLanguage] = await fetchDictionary(nextLanguage);
    }

    language = nextLanguage;
    localStorage.setItem("sattumaLanguage", language);

    const url = new URL(window.location.href);
    url.searchParams.set("lang", language);
    window.history.replaceState({}, "", url);

    const languageSelector = document.getElementById("languageSelector");
    if (languageSelector) {
      languageSelector.value = language;
    }

    applyTranslations();
    await loadModalContent();
    listeners.forEach((listener) => listener(language));
  }

  function onChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  async function init() {
    await loadLanguage(language);

    const languageSelector = document.getElementById("languageSelector");
    if (languageSelector) {
      languageSelector.addEventListener("change", () => {
        loadLanguage(languageSelector.value);
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
