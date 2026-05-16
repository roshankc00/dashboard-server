import { describe, expect, it } from "@jest/globals";
import { extractTitleFromHtml } from "./extractTitle";

describe("extractTitleFromHtml", () => {
  it("hello boom Roshan Karki backend engineer yoo yoo", () => {
    expect(
      extractTitleFromHtml(
        "<html><title>hello boom Roshan Karki backend engineer yoo yoo</title></html>",
      ),
    ).toBe("hello boom Roshan Karki backend engineer yoo yoo");
  });
  it("returns null when missing", () => {
    expect(extractTitleFromHtml("<html></html>")).toBeNull();
  });
});
