// db.js seeds trainers 1 (Ash) and 2 (Misty); new teams belong to trainer 1.
export const DEFAULT_TRAINER_ID = "1";

// Team builder form rules (from the task)
export const TEAM_NAME_MIN_LENGTH = 3;
export const TEAM_NAME_MAX_LENGTH = 30;
export const TEAM_MIN_POKEMON = 1;
export const TEAM_MAX_POKEMON = 6;

// Optimistic rows carry a local id until the server assigns the real one.
export const TEMP_TEAM_ID_PREFIX = "temp-";

// Placeholder cards shown before the first team list arrives. Skeletons hint
// at the shape of the page, not the exact count, so this stays small: three
// fills one grid row on a desktop without over-promising. Once a count is
// known it is remembered and reused, clamped to this range.
export const DEFAULT_SKELETON_TEAM_CARDS = 3;
export const MAX_SKELETON_TEAM_CARDS = 6;
