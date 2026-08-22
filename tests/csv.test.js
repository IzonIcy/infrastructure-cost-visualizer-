import { describe, expect, it } from "vitest";
import { csvEscape, parseCsvContent } from "../csv.js";

describe("csvEscape", () => {
  it("passes plain values through", () => {
    expect(csvEscape("compute")).toBe("compute");
    expect(csvEscape(42)).toBe("42");
    expect(csvEscape(null)).toBe("");
  });

  it("quotes values containing commas, quotes, or newlines", () => {
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape("line\nbreak")).toBe('"line\nbreak"');
  });
});

describe("parseCsvContent", () => {
  it("parses simple rows and skips blank lines", () => {
    const rows = parseCsvContent("a,b,c\n1,2,3\n\n");
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsvContent("x,y\r\n1,2\r\n")).toEqual([
      ["x", "y"],
      ["1", "2"],
    ]);
  });

  it("supports quoted fields with commas, escaped quotes, and newlines", () => {
    const rows = parseCsvContent('name,notes\n"Widget, large","said ""ok"""\n"multi\nline",z');
    expect(rows).toEqual([
      ["name", "notes"],
      ["Widget, large", 'said "ok"'],
      ["multi\nline", "z"],
    ]);
  });

  it("throws on unterminated quotes instead of silently truncating", () => {
    expect(() => parseCsvContent('a,"unterminated')).toThrow(/unterminated/i);
  });

  it("treats a lone trailing field without newline as a row", () => {
    expect(parseCsvContent("solo")).toEqual([["solo"]]);
  });

  it("returns no rows for empty input", () => {
    expect(parseCsvContent("")).toEqual([]);
  });
});
