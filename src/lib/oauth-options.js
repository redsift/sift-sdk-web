import sha256 from 'js-sha256';

/**
 * If an email is passed, replace it with a truncated hash so the raw
 * address does not travel through the OAuth redirect chain as-is.
 */
export function withHashedEmailSubject(options) {
  if (options && typeof options === 'object' && options.email) {
    const { email, ...others } = options;
    const subject = sha256(email).slice(0, 16);
    // `others` is spread first so a subject supplied alongside the email
    // cannot overwrite the derived one — replacing the address is the point
    return { ...others, subject };
  }
  return options;
}
