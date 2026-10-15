import "server-only";
import { Zip, ZipPassThrough, strToU8 } from "fflate";
import { assertResumeObjectKeyOwnership, readResumeObject } from "@/lib/storage/b2";
import type { AccountSnapshot } from "./account-data";

export function safeArchiveFileName(name: string): string {
  const cleaned = name
    .normalize("NFKC")
    .replace(/[\\/\u0000-\u001f\u007f]/g, "_")
    .replace(/^\.+/, "")
    .trim();
  return cleaned.slice(0, 180) || "resume";
}

export function checkArchiveSize(snapshot: AccountSnapshot) {
  const files = snapshot.resumes.filter((resume) => resume.status === "uploaded");
  if (
    files.length > 5000 ||
    files.reduce((sum, resume) => sum + Number(resume.file_size ?? 0), 0) > 2 * 1024 ** 3
  ) {
    throw new Error("This account requires an assisted export.");
  }
  for (const resume of files) {
    if (!/^[a-zA-Z0-9-]+$/.test(resume.id)) throw new Error("Invalid resume identifier.");
  }
}

/** Pull-driven streaming keeps archive and file bytes out of a giant buffer. */
export function createAccountArchive(
  userId: string,
  snapshot: AccountSnapshot,
  workbook: Uint8Array,
  requestSignal: AbortSignal,
): ReadableStream<Uint8Array> {
  const abort = new AbortController();
  const signal = AbortSignal.any([requestSignal, abort.signal]);
  async function* chunks(): AsyncGenerator<Uint8Array> {
    const pending: Uint8Array[] = [];
    let failure: Error | null = null;
    let total = 0;
    const zip = new Zip((error, data) => {
      if (error) failure = error;
      else if (data.length) pending.push(data);
    });
    function* drain() {
      if (failure) throw failure;
      while (pending.length) yield pending.shift()!;
    }
    function* add(name: string, bytes: Uint8Array) {
      signal.throwIfAborted();
      const file = new ZipPassThrough(name);
      zip.add(file);
      file.push(bytes, true);
      yield* drain();
    }
    try {
      yield* add(
        "README.txt",
        strToU8(
          `ApplyOS account download\nGenerated: ${snapshot.createdAt}\n\nYour data.xlsx: account, workspace, parsing, and activity records.\nrecords.json: complete exported records, including long fields.\nresume-manifest.json: uploaded and unfinished resume records.\nresumes/: original uploaded files, grouped by resume ID to preserve duplicate names.\n\nArchived records are included. Failed or unfinished uploads are listed in the manifest but have no finalized file to download.\nAuthentication secrets, storage credentials, internal administrative audit records, and retired shared-message content are not included.\n`,
        ),
      );
      yield* add("Your data.xlsx", workbook);
      yield* add(
        "records.json",
        strToU8(
          JSON.stringify({ generated_at: snapshot.createdAt, tables: snapshot.records }, null, 2),
        ),
      );
      yield* add(
        "resume-manifest.json",
        strToU8(
          JSON.stringify(
            snapshot.resumes.map((resume) => ({
              id: resume.id,
              file_name: resume.original_file_name,
              status: resume.status,
              included: resume.status === "uploaded",
              archive_path:
                resume.status === "uploaded"
                  ? `resumes/${resume.id}/${safeArchiveFileName(resume.original_file_name)}`
                  : null,
            })),
            null,
            2,
          ),
        ),
      );
      for (const resume of snapshot.resumes) {
        signal.throwIfAborted();
        if (resume.status !== "uploaded") continue;
        assertResumeObjectKeyOwnership(resume.storage_key, userId);
        const body = await readResumeObject(resume.storage_key, signal);
        const file = new ZipPassThrough(
          `resumes/${resume.id}/${safeArchiveFileName(resume.original_file_name)}`,
        );
        zip.add(file);
        yield* drain();
        for await (const bytes of body) {
          signal.throwIfAborted();
          total += bytes.byteLength;
          if (total > 2 * 1024 ** 3) throw new Error("Account archive is too large.");
          file.push(bytes, false);
          yield* drain();
        }
        file.push(new Uint8Array(), true);
        yield* drain();
      }
      zip.end();
      yield* drain();
    } finally {
      zip.terminate();
      abort.abort();
    }
  }
  const iterator = chunks();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await iterator.next();
        if (next.done) controller.close();
        else controller.enqueue(next.value);
      } catch {
        abort.abort();
        controller.error(new Error("The account download did not finish. Please retry."));
      }
    },
    async cancel() {
      abort.abort();
      await iterator.return(undefined);
    },
  });
}
