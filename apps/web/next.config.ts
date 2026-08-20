import type { NextConfig } from "next";

const CANONICAL_HOST = "bible.lucascosolo.com";
const ALIAS_HOST = "jot.lucascosolo.com";

const nextConfig: NextConfig = {
  /**
   * `jot.lucascosolo.com` is an alias, not a second home.
   *
   * Both hostnames resolve to the same tunnel and the same origin, so without this the app
   * would serve identical content on two addresses — which splits every shared link, every
   * bookmark and every search-engine impression across two hosts, and (because annotations
   * are stored per browser origin) would quietly give a user two disjoint sets of notes
   * depending on which address they happened to arrive at. That last one is the reason this
   * is a redirect rather than a `rel=canonical`: a canonical tag is a hint to crawlers and
   * does nothing for the browser's origin-scoped storage.
   *
   * Permanent (308) so the method and body survive and the redirect is cached; matched on the
   * Host header rather than in the tunnel, so it travels with the app and holds in local
   * development against the same hostnames.
   */
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: ALIAS_HOST }],
        destination: `https://${CANONICAL_HOST}/:path*`,
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
