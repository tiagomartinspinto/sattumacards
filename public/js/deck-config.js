export const DECKS = [
  { id: "situation", image: "tilanne-fcard.webp", labelKey: "deckSituation" },
  { id: "space", image: "tila-fcard.webp", labelKey: "deckSpace" },
  { id: "methods", image: "keinot-fcard.webp", labelKey: "deckMethods" },
  { id: "resources", image: "resurssit-fcard.webp", labelKey: "deckResources" },
  {
    id: "teaching-format",
    image: "opetusmuoto-fcard.webp",
    labelKey: "deckTeachingFormat",
  },
  { id: "chance", image: "sattuma-fcard.webp", labelKey: "deckChance" },
];

export function getDeckById(deckId) {
  return DECKS.find((deck) => deck.id === deckId);
}
