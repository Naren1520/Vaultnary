/** Client-side validators mirroring backend rules */
/** RFC 5321-ish email format check */
export function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
/** Password: 12–128 characters */
export function isValidPassword(value) {
    return value.length >= 12 && value.length <= 128;
}
/** Generic name field: 1–255 characters */
export function isValidName(value) {
    return value.trim().length >= 1 && value.trim().length <= 255;
}
/** Short name field: 1–100 characters (projects, services) */
export function isValidShortName(value) {
    return value.trim().length >= 1 && value.trim().length <= 100;
}
/** Optional description: ≤ 500 characters */
export function isValidDescription(value) {
    return value.length <= 500;
}
/** Notes: ≤ 10 000 characters */
export function isValidNotes(value) {
    return value.length <= 10_000;
}
/** Tags: up to 20 tags, each 1–50 characters */
export function isValidTags(tags) {
    if (tags.length > 20)
        return false;
    return tags.every((t) => t.trim().length >= 1 && t.trim().length <= 50);
}
/** Search query: 1–200 characters */
export function isValidSearchQuery(value) {
    return value.trim().length >= 1 && value.trim().length <= 200;
}
