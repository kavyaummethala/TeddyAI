/** ["Mia"] -> "Mia", ["Mia", "Leo"] -> "Mia and Leo", ["Mia", "Leo", "Ava"] -> "Mia, Leo and Ava" */
export const listNames = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
