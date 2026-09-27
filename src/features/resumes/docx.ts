import { unzipSync, zipSync } from "fflate";
// Pass Mammoth's browser entry explicitly, so a parser can never open local paths.
import mammoth from "mammoth/mammoth.browser";
import { checkedText, type ImportResult } from "./model";
const MAX_EXPANDED = 20 * 1024 * 1024;
const MAX_XML = 4 * 1024 * 1024;
export async function extractDocx(data: Uint8Array): Promise<ImportResult> {
  if (data[0] !== 0x50 || data[1] !== 0x4b || data[2] !== 3 || data[3] !== 4)
    throw new Error(
      "This is not a readable DOCX file. Password-protected documents are not supported; export an unlocked DOCX or paste the text.",
    );
  let count = 0,
    expanded = 0;
  const names = new Set<string>();
  // fflate inflates into the declared, bounded output buffer. Repack those
  // bounded XML bytes before Mammoth reads them; never hand it the original ZIP.
  const files = unzipSync(data, {
    filter(entry) {
      count++;
      expanded += entry.originalSize;
      if (
        count > 500 ||
        !Number.isSafeInteger(expanded) ||
        expanded > MAX_EXPANDED ||
        entry.originalSize < 0
      )
        throw new Error(
          "This DOCX expands beyond the import limit. Export a simpler document or paste its text.",
        );
      if (
        names.has(entry.name) ||
        entry.name
          .split("/")
          .some((part) => part === ".." || part === "__proto__") ||
        entry.name.startsWith("/") ||
        entry.name.includes("\\")
      )
        throw new Error(
          "This DOCX archive has an unsupported structure. Export a fresh DOCX or paste its text.",
        );
      names.add(entry.name);
      if (/vbaProject/i.test(entry.name))
        throw new Error(
          "Macro-enabled documents are not supported. Export a regular DOCX or paste the text.",
        );
      const xml =
        entry.name === "[Content_Types].xml" ||
        entry.name === "_rels/.rels" ||
        /^word\/.*\.(xml|rels)$/.test(entry.name);
      if (xml && entry.originalSize > MAX_XML)
        throw new Error(
          "This DOCX is too complex to import. Paste the relevant text instead.",
        );
      return xml;
    },
  });
  if (!files["word/document.xml"] || !files["[Content_Types].xml"])
    throw new Error(
      "The file does not contain a DOCX document. Export it again or paste the text.",
    );
  for (const bytes of Object.values(files)) {
    const xml = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (/<!DOCTYPE|<!ENTITY|macroEnabled/i.test(xml))
      throw new Error(
        "This DOCX contains unsupported document features. Export a regular DOCX or paste the text.",
      );
  }
  const bounded = zipSync(files, { level: 0 });
  const result = await mammoth.extractRawText({
    arrayBuffer: new Uint8Array(bounded).buffer,
  });
  if (result.messages.some((message) => message.type === "error"))
    throw new Error(
      "Some document content could not be read. Export a fresh DOCX or paste the text.",
    );
  return {
    source: "docx",
    text: checkedText(result.value),
    warnings: [
      "Check headings, tables and reading order. Images, headers, footers and some document elements may be omitted.",
      ...(result.messages.length
        ? [
            "The document contains formatting or elements the importer does not fully support. Compare the text with your original.",
          ]
        : []),
    ],
  };
}
