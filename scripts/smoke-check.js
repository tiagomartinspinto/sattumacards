const fs = require("fs");
const path = require("path");

const requiredFiles = [
  "public/index.html",
  "public/js/gameA.js",
  "public/js/i18n.js",
  "public/js/cards.js",
  "public/js/room.js",
  "public/i18n/fi.json",
  "public/i18n/en.json",
  "public/content/fi/instructions.html",
  "public/content/en/instructions.html",
  "public/cards/fi/situation.txt",
  "public/cards/en/situation.txt",
  "server.js",
];

let hasError = false;

requiredFiles.forEach((filePath) => {
  const absolutePath = path.join(__dirname, "..", filePath);

  if (!fs.existsSync(absolutePath)) {
    console.error(`Missing required file: ${filePath}`);
    hasError = true;
  }
});

["fi", "en"].forEach((language) => {
  const filePath = path.join(__dirname, "..", "public", "i18n", `${language}.json`);

  try {
    JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.error(`Invalid i18n JSON: ${filePath}`);
    hasError = true;
  }
});

if (hasError) {
  process.exit(1);
}

console.log("Smoke check passed.");
