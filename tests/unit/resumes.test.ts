import assert from "node:assert/strict";
import test from "node:test";
import { strToU8 } from "fflate";
import { extractDocx } from "../../src/features/resumes/docx";
import {
  resumeInput,
  fileKind,
  checkedText,
  cleanImportedText,
  resumePage,
  MAX_FILE,
  MAX_TEXT,
} from "../../src/features/resumes/model";
import { docxFile } from "../fixtures/resume-files";

test("resume validation bounds text and names, excludes identity and rejects unsupported inputs", () => {
  assert.deepEqual(
    resumeInput.parse({
      name: " Designer ",
      body: " Experience ",
      source: "paste",
      user_id: "spoof",
      revision: 100,
    }),
    { name: "Designer", body: "Experience", source: "paste" },
  );
  for (const change of [
    { name: " " },
    { body: "\n\t" },
    { body: "\u0000x" },
    { body: "x".repeat(MAX_TEXT + 1) },
    { source: "html" },
  ])
    assert.equal(
      resumeInput.safeParse({
        name: "Test",
        body: "Text",
        source: "paste",
        ...change,
      }).success,
      false,
    );
  assert.equal(fileKind("resume.PDF", 100), "pdf");
  assert.equal(
    resumeInput.parse({ name: "Test", body: "a\r\nb\rc", source: "paste" })
      .body,
    "a\nb\nc",
  );
  for (const [name, size] of [
    ["x.doc", 2],
    ["x.pdf", 0],
    ["x.docx", MAX_FILE + 1],
  ] as const)
    assert.throws(() => fileKind(name, size));
  assert.equal(cleanImportedText("a\r\nb\r\n\n\n\n c\u0000"), "a\nb\n\n\n c");
  assert.throws(() => checkedText(" \n "));
  assert.throws(() => checkedText("a".repeat(MAX_TEXT + 1)));
  assert.equal(resumePage("bad"), 1);
  assert.equal(resumePage("2"), 2);
});
test("DOCX extracts Unicode and escaped text without treating text as markup", async () => {
  const text =
    "Fictional 🦉 Candidate — 日本語 <script>alert('no')</script> & experience";
  const result = await extractDocx(docxFile(text));
  assert.equal(result.text, text);
  assert.equal(result.source, "docx");
  assert.ok(result.warnings.length);
});
test("DOCX rejects empty, malformed, macro, entity, oversized and over-expanded archives", async () => {
  await assert.rejects(extractDocx(docxFile("")), /No readable/);
  await assert.rejects(extractDocx(strToU8("not a docx")), /not a readable/);
  await assert.rejects(
    extractDocx(docxFile("text", { "word/vbaProject.bin": strToU8("macro") })),
    /Macro-enabled/,
  );
  await assert.rejects(
    extractDocx(
      docxFile("text", {
        "word/document.xml": strToU8(
          '<!DOCTYPE x [<!ENTITY y "z">]><x>&y;</x>',
        ),
      }),
    ),
    /unsupported document/,
  );
  await assert.rejects(
    extractDocx(
      docxFile("text", {
        "word/styles.xml": new Uint8Array(4 * 1024 * 1024 + 1),
      }),
    ),
    /too complex/,
  );
  const bomb = docxFile();
  const central = bomb.indexOf(Buffer.from([0x50, 0x4b, 1, 2]));
  bomb.writeUInt32LE(21 * 1024 * 1024, central + 24);
  await assert.rejects(extractDocx(bomb), /expands beyond/);
});
