// "Show on card" hands a role and band from the calculator to the rate cards
// below it. The nonce lets the same selection be sent twice: clicking again
// after scrolling away should bring you back.
export const cardFocus = $state({ role: "", band: "", nonce: 0 });

export function showOnCard(role: string, band: string) {
  cardFocus.role = role;
  cardFocus.band = band;
  cardFocus.nonce += 1;
}

// An empty request clears the highlight: the selection it pointed at is gone
export function clearCardFocus() {
  cardFocus.role = "";
  cardFocus.band = "";
  cardFocus.nonce += 1;
}
