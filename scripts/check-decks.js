const fs = require("fs");
const path = require("path");

const languages = ["fi", "en"];
const deckFiles = [
  "situation.txt",
  "space.txt",
  "methods.txt",
  "resources.txt",
  "teaching-format.txt",
  "chance.txt",
];
const cardsRoot = path.join(__dirname, "..", "public", "cards");

function readLines(filePath) {
  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

let hasError = false;

deckFiles.forEach((deckFile) => {
  const lineCounts = languages.map((language) => {
    const filePath = path.join(cardsRoot, language, deckFile);

    if (!fs.existsSync(filePath)) {
      console.error(`Missing deck file: ${filePath}`);
      hasError = true;
      return 0;
    }

    return readLines(filePath).length;
  });

  if (new Set(lineCounts).size > 1) {
    console.error(`${deckFile} line counts differ: ${lineCounts.join(" / ")}`);
    hasError = true;
  }
});

if (hasError) {
  process.exit(1);
}

console.log("Deck parity check passed.");
