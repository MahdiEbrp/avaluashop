/**
 * Writes a cookie the way the browser's cookie jar is written. Reflect.set
 * invokes the same `document.cookie` setter that an assignment would, and
 * keeps cookie access in one place for the tests that exercise the session
 * flag (`logged-in`).
 */
export function setCookie(cookie: string) {
   Reflect.set(document, 'cookie', cookie)
}
