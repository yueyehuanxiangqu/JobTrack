import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

// One managed backend owns a database. Serialize its file mutations and backup
// snapshots, including across Next's route bundles; snapshots may nest in import.
const key = Symbol.for("jobsync.document-lock");
const globals = globalThis as typeof globalThis & { [key]?: { tail: Promise<void>; context: AsyncLocalStorage<boolean> } };
const state = globals[key] ??= { tail: Promise.resolve(), context: new AsyncLocalStorage<boolean>() };
export async function withDocumentLock<T>(work: () => Promise<T>): Promise<T> {
  if (state.context.getStore()) return work();
  const previous = state.tail;
  let release!: () => void;
  state.tail = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try { return await state.context.run(true, work); }
  finally { release(); }
}
