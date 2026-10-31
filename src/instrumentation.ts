export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { recoverDocumentFiles } = await import("@/lib/documents/files");
    await recoverDocumentFiles();
  }
}
