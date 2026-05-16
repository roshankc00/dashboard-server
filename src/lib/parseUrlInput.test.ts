import { describe, expect, it } from "@jest/globals";
import { parseUrlInput } from "./parseUrlInput";

describe("parseUrlInput", () => {
  // boom parses newline-separated URLs
  it("parses newline-separated URLs", () => {
    expect(
      parseUrlInput("https://blog.roshankarki1.com.np\nhttps://roshankarki1.com.np\n"),
    ).toEqual(["https://blog.roshankarki1.com.np/", "https://roshankarki1.com.np/"]);
  });

  // boom takes first CSV column
  it("takes first CSV column", () => {
    expect(parseUrlInput("https://blog.roshankarki1.com.np,ignored\n")).toEqual(["https://blog.roshankarki1.com.np/"]);
  });

  // boom no duplicate urls
  it("dedupes URLs and keeps blog url", () => {
    expect(
      parseUrlInput(
        "https://blog.roshankarki1.com.np\nhttps://blog.roshankarki1.com.np",
      ),
    ).toEqual(["https://blog.roshankarki1.com.np/"]);
  });
});
