/**
 * Where "Support Jot" sends people. The business PayPal donate button (its return and cancel URLs
 * are /support/thanks and /support/cancelled), chosen 2026-10-08 over the Trophonix Patreon (which
 * is pitched at game development) and over Paddle (a merchant of record whose terms exclude
 * donations). Set at build time (NEXT_PUBLIC_* is inlined by `next build`, so a server-side env var does nothing); the iOS shell should set it empty so no support link or
 * tour step renders there (App Store guideline 3.1.1).
 */
export const SUPPORT_URL =
  process.env.NEXT_PUBLIC_SUPPORT_URL ?? "https://www.paypal.com/donate/?hosted_button_id=EQK7PQ72S49K2";
