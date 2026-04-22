const THEMES = {
  default: {
    pageBg: "#1e272e",
    surfaceBg: "rgba(30, 39, 46, 0.96)",
    controlBg: "#1e272e",
    controlText: "#f4f6f7",
    controlMuted: "#d8dde1",
    controlHoverBg: "#26333b",
    accentColor: "#ffd700",
    accentText: "#1e272e",
    borderColor: "rgba(255, 215, 0, 0.86)",
    dropzoneBorder: "rgba(255, 215, 0, 0.74)",
    dropzoneBg: "rgba(255, 215, 0, 0.08)",
    dropzoneHoverBg: "rgba(255, 215, 0, 0.16)",
    tableLabelText: "#f4f6f7",
    tableLabelShadow: "rgba(0, 0, 0, 0.28)",
    shadowColor: "rgba(0, 0, 0, 0.32)",
  },
  sage: {
    pageBg: "#b7d3be",
    pageText: "#162e27",
    surfaceBg: "rgba(22, 46, 39, 0.94)",
    controlBg: "#162e27",
    controlText: "#f3fff8",
    controlMuted: "#d7f0e1",
    controlHoverBg: "#25463d",
    accentColor: "#ffe06a",
    accentText: "#162e27",
    borderColor: "rgba(255, 224, 106, 0.9)",
    dropzoneBorder: "rgba(22, 46, 39, 0.6)",
    dropzoneBg: "rgba(22, 46, 39, 0.1)",
    dropzoneHoverBg: "rgba(255, 224, 106, 0.18)",
    tableLabelText: "#162e27",
    tableLabelShadow: "rgba(255, 255, 255, 0.24)",
    shadowColor: "rgba(22, 46, 39, 0.3)",
  },
  mist: {
    pageBg: "#b9c9c7",
    pageText: "#1c272b",
    surfaceBg: "rgba(28, 39, 43, 0.94)",
    controlBg: "#1c272b",
    controlText: "#f2fbfa",
    controlMuted: "#d9e9e6",
    controlHoverBg: "#2d3f45",
    accentColor: "#ffdd67",
    accentText: "#1c272b",
    borderColor: "rgba(255, 221, 103, 0.9)",
    dropzoneBorder: "rgba(28, 39, 43, 0.58)",
    dropzoneBg: "rgba(28, 39, 43, 0.1)",
    dropzoneHoverBg: "rgba(255, 221, 103, 0.18)",
    tableLabelText: "#1c272b",
    tableLabelShadow: "rgba(255, 255, 255, 0.24)",
    shadowColor: "rgba(28, 39, 43, 0.3)",
  },
  sky: {
    pageBg: "#b8d6e8",
    pageText: "#142a37",
    surfaceBg: "rgba(20, 42, 55, 0.94)",
    controlBg: "#142a37",
    controlText: "#f4fbff",
    controlMuted: "#d9edf7",
    controlHoverBg: "#214458",
    accentColor: "#ffe16a",
    accentText: "#142a37",
    borderColor: "rgba(255, 225, 106, 0.9)",
    dropzoneBorder: "rgba(20, 42, 55, 0.6)",
    dropzoneBg: "rgba(20, 42, 55, 0.1)",
    dropzoneHoverBg: "rgba(255, 225, 106, 0.18)",
    tableLabelText: "#142a37",
    tableLabelShadow: "rgba(255, 255, 255, 0.24)",
    shadowColor: "rgba(20, 42, 55, 0.3)",
  },
  rose: {
    pageBg: "#e4b8c4",
    pageText: "#321a27",
    surfaceBg: "rgba(50, 26, 39, 0.94)",
    controlBg: "#321a27",
    controlText: "#fff7fa",
    controlMuted: "#f7dfe7",
    controlHoverBg: "#4a2839",
    accentColor: "#ffe36d",
    accentText: "#321a27",
    borderColor: "rgba(255, 227, 109, 0.9)",
    dropzoneBorder: "rgba(50, 26, 39, 0.58)",
    dropzoneBg: "rgba(50, 26, 39, 0.1)",
    dropzoneHoverBg: "rgba(255, 227, 109, 0.18)",
    tableLabelText: "#321a27",
    tableLabelShadow: "rgba(255, 255, 255, 0.24)",
    shadowColor: "rgba(50, 26, 39, 0.3)",
  },
  dawn: {
    pageBg: "linear-gradient(to right, #f1b9aa, #b8d6e8)",
    pageText: "#28232c",
    surfaceBg: "rgba(40, 35, 44, 0.94)",
    controlBg: "#28232c",
    controlText: "#fff9f5",
    controlMuted: "#f3e4dd",
    controlHoverBg: "#3f3746",
    accentColor: "#ffe06a",
    accentText: "#28232c",
    borderColor: "rgba(255, 224, 106, 0.9)",
    dropzoneBorder: "rgba(40, 35, 44, 0.58)",
    dropzoneBg: "rgba(40, 35, 44, 0.1)",
    dropzoneHoverBg: "rgba(255, 224, 106, 0.18)",
    tableLabelText: "#28232c",
    tableLabelShadow: "rgba(255, 255, 255, 0.24)",
    shadowColor: "rgba(40, 35, 44, 0.31)",
  },
};
const STORAGE_KEY = "sattumaTheme";

function applyTheme(themeName) {
  const theme = THEMES[themeName] || THEMES.default;
  const rootStyle = document.documentElement.style;

  document.body.style.background = theme.pageBg;
  document.body.style.filter = "none";
  rootStyle.setProperty("--page-bg", theme.pageBg);
  rootStyle.setProperty("--page-text", theme.pageText || theme.controlText);
  rootStyle.setProperty("--surface-bg", theme.surfaceBg);
  rootStyle.setProperty("--control-bg", theme.controlBg);
  rootStyle.setProperty("--control-text", theme.controlText);
  rootStyle.setProperty("--control-muted", theme.controlMuted);
  rootStyle.setProperty("--control-hover-bg", theme.controlHoverBg);
  rootStyle.setProperty("--accent-color", theme.accentColor);
  rootStyle.setProperty("--accent-text", theme.accentText);
  rootStyle.setProperty("--border-color", theme.borderColor);
  rootStyle.setProperty("--dropzone-border", theme.dropzoneBorder);
  rootStyle.setProperty("--dropzone-bg", theme.dropzoneBg);
  rootStyle.setProperty("--dropzone-hover-bg", theme.dropzoneHoverBg);
  rootStyle.setProperty("--table-label-text", theme.tableLabelText);
  rootStyle.setProperty("--table-label-shadow", theme.tableLabelShadow);
  rootStyle.setProperty("--shadow-color", theme.shadowColor);
}

export function initThemes() {
  const selector = document.getElementById("backgroundColorSelector");
  const savedTheme = localStorage.getItem(STORAGE_KEY);
  const initialTheme = THEMES[savedTheme] ? savedTheme : "default";

  applyTheme(initialTheme);

  if (selector) {
    selector.value = initialTheme;
    selector.addEventListener("change", () => {
      applyTheme(selector.value);
      localStorage.setItem(STORAGE_KEY, selector.value);
    });
  }
}
