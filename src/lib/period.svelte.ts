// The rate period is one choice for the whole page: the calculator's toggle and
// the one above the cards below it read and write the same state, so switching
// either moves both.
export const period = $state({ weekly: true });
