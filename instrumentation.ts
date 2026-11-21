// Startup check: refuse AI jobs while ANTHROPIC_API_KEY is set (it would bill the API, not the Pro plan).
export function register() {
  if ((process.env.ANTHROPIC_API_KEY || "").trim()) {
    console.warn(
      "\n⚠  ANTHROPIC_API_KEY is set. AI jobs are OFF so you aren't billed on the API.\n" +
        "   Remove it from .env and your shell profile, then restart. The app uses your Claude Pro login.\n",
    );
  }
}
