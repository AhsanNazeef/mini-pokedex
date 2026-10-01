// Feature/module scopes for this project. Add hyphenated combinations
// (e.g. "pokemon-table") here when a commit needs a narrower scope.
const SCOPES = [
  "core",
  "common",
  "cache",
  "pokedex",
  "teams",
  "deps",
  "readme",
  "mock",
];

// Imperative verbs that naturally end in "-ed" or "-s".
const IMPERATIVE_EXCEPTIONS = new Set([
  "embed",
  "exceed",
  "feed",
  "need",
  "proceed",
  "seed",
  "shred",
  "speed",
  "succeed",
]);

// Irregular past-tense verbs the "-ed" check cannot catch.
const IRREGULAR_PAST = new Set([
  "built",
  "rebuilt",
  "wrote",
  "rewrote",
  "made",
  "ran",
  "did",
  "found",
  "gave",
  "got",
  "kept",
  "left",
  "sent",
  "took",
  "threw",
  "went",
  "brought",
  "began",
  "broke",
  "chose",
]);

/**
 * Rejects subjects that are not in imperative mood ("add", not "added" or
 * "adds"), as required by the developer guide.
 */
function subjectImperative({ subject }) {
  if (!subject) return [true];

  const firstWord = subject.trim().split(/\s+/)[0].toLowerCase();
  if (IMPERATIVE_EXCEPTIONS.has(firstWord)) return [true];

  const isPastTense = firstWord.endsWith("ed") || IRREGULAR_PAST.has(firstWord);
  const isThirdPerson = /[^su]s$/.test(firstWord) && !firstWord.endsWith("is");

  if (isPastTense || isThirdPerson) {
    return [
      false,
      `subject must use imperative mood: "${firstWord}" is not imperative ` +
        `(write "add", not "added" or "adds")`,
    ];
  }
  return [true];
}

module.exports = {
  extends: ["@commitlint/config-conventional"],
  plugins: [{ rules: { "subject-imperative": subjectImperative } }],
  rules: {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "refactor", "perf", "test", "docs", "chore", "style"],
    ],
    "scope-enum": [2, "always", SCOPES],
    "scope-empty": [2, "never"],
    "scope-case": [2, "always", "kebab-case"],
    "header-max-length": [2, "always", 100],
    "subject-full-stop": [2, "never", "."],
    "subject-imperative": [2, "always"],
    "body-leading-blank": [2, "always"],
    "body-max-line-length": [2, "always", 72],
    "footer-leading-blank": [2, "always"],
  },
};
