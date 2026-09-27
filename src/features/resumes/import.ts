import {
  fileKind,
  checkedText,
  MAX_PAGES,
  MAX_TEXT,
  type ImportResult,
} from "./model";
function cancelled() {
  return new DOMException("Import cancelled.", "AbortError");
}

async function readPdf(
  data: ArrayBuffer,
  signal: AbortSignal,
): Promise<ImportResult> {
  const pdf = await import("pdfjs-dist");
  if (signal.aborted) throw cancelled();
  const port = new Worker(
    new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
    { type: "module" },
  );
  const worker = pdf.PDFWorker.create({ port });
  const task = pdf.getDocument({
    data: new Uint8Array(data),
    worker,
    verbosity: 0,
    stopAtErrors: true,
    disableFontFace: true,
    useSystemFonts: false,
    useWorkerFetch: false,
    useWasm: false,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
    enableXfa: false,
  });
  let protectedFile = false;
  task.onPassword = () => {
    protectedFile = true;
    void task.destroy();
  };
  const abort = () => {
    void task.destroy();
    port.terminate();
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    const document = await task.promise;
    if (document.numPages > MAX_PAGES)
      throw new Error(
        "This PDF has more than 50 pages. Import a shorter version or paste the relevant text.",
      );
    const pages: string[] = [];
    let empty = 0,
      total = 0;
    for (let number = 1; number <= document.numPages; number++) {
      if (signal.aborted) throw cancelled();
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) =>
          "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "",
        )
        .join("")
        .trim();
      if (!text) empty++;
      total += text.length + 2;
      if (total > MAX_TEXT)
        throw new Error(
          "This document contains more than 100,000 characters. Import a shorter version or paste the relevant text.",
        );
      pages.push(text);
      page.cleanup();
    }
    return {
      source: "pdf",
      text: checkedText(pages.join("\n\n")),
      warnings: [
        "Check the reading order, especially columns and tables. PDF text extraction does not preserve the original layout.",
        ...(empty
          ? [
              `${empty} of ${document.numPages} pages had no readable text. Their image content was not imported.`,
            ]
          : []),
      ],
    };
  } catch (error) {
    if (signal.aborted) throw cancelled();
    if (protectedFile)
      throw new Error(
        "Password-protected PDFs are not supported. Export an unlocked PDF or paste the text.",
      );
    if (error instanceof Error && /^(This |No readable)/.test(error.message))
      throw error;
    throw new Error(
      "This PDF could not be read. It may be damaged or use unsupported fonts. Export a new PDF or paste the text.",
    );
  } finally {
    signal.removeEventListener("abort", abort);
    void task.destroy();
    worker.destroy();
    port.terminate();
  }
}
function readDocx(
  data: ArrayBuffer,
  signal: AbortSignal,
): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(cancelled());
      return;
    }
    const worker = new Worker(new URL("./docx.worker.ts", import.meta.url), {
      type: "module",
    });
    const finish = () => {
      signal.removeEventListener("abort", abort);
      worker.terminate();
    };
    const abort = () => {
      finish();
      reject(cancelled());
    };
    signal.addEventListener("abort", abort, { once: true });
    worker.onerror = () => {
      finish();
      reject(
        new Error(
          "The DOCX importer could not start. Try again or paste your text.",
        ),
      );
    };
    worker.onmessage = (
      event: MessageEvent<{ result?: ImportResult; error?: string }>,
    ) => {
      finish();
      if (event.data.result) resolve(event.data.result);
      else
        reject(
          new Error(
            event.data.error ??
              "This DOCX could not be read. Paste your text instead.",
          ),
        );
    };
    worker.postMessage(data, [data]);
  });
}
export async function importResume(
  file: File,
  externalSignal: AbortSignal,
): Promise<ImportResult> {
  const kind = fileKind(file.name, file.size);
  if (typeof Worker === "undefined")
    throw new Error(
      "This browser cannot import files. Paste your resume text instead.",
    );
  const controller = new AbortController();
  let timeout = false;
  const cancel = () => controller.abort();
  externalSignal.addEventListener("abort", cancel, { once: true });
  if (externalSignal.aborted) cancel();
  const timer = setTimeout(() => {
    timeout = true;
    controller.abort();
  }, 30000);
  let rejectOnAbort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    rejectOnAbort = () =>
      reject(
        timeout
          ? new Error(
              "Import took too long. Try a simpler file or paste the text instead.",
            )
          : cancelled(),
      );
    controller.signal.addEventListener("abort", rejectOnAbort, { once: true });
  });
  try {
    if (controller.signal.aborted) throw cancelled();
    const operation = async () => {
      const data = await file.arrayBuffer();
      if (controller.signal.aborted) throw cancelled();
      if (
        kind === "pdf" &&
        !new TextDecoder().decode(data.slice(0, 1024)).includes("%PDF-")
      )
        throw new Error(
          "This is not a readable PDF file. Export it again or paste the text.",
        );
      return kind === "pdf"
        ? readPdf(data, controller.signal)
        : readDocx(data, controller.signal);
    };
    return await Promise.race([operation(), aborted]);
  } finally {
    clearTimeout(timer);
    externalSignal.removeEventListener("abort", cancel);
    controller.signal.removeEventListener("abort", rejectOnAbort);
  }
}
