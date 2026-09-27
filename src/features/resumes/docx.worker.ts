import { extractDocx } from "./docx";
self.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  try {
    self.postMessage({ result: await extractDocx(new Uint8Array(event.data)) });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error &&
        /^(This |The file|Macro-enabled|No readable|Some document)/.test(
          error.message,
        )
          ? error.message
          : "This DOCX could not be read. It may be damaged or protected. Export a fresh DOCX or paste the text.",
    });
  } finally {
    self.close();
  }
};
