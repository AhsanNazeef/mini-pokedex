import { toTitleCase } from "./string.util";

describe("toTitleCase", () => {
  it("capitalises each hyphen- or space-separated word", () => {
    expect(toTitleCase("bulbasaur")).toBe("Bulbasaur");
    expect(toTitleCase("mr-mime")).toBe("Mr Mime");
    expect(toTitleCase("special attack")).toBe("Special Attack");
  });

  it("ignores repeated separators", () => {
    expect(toTitleCase("ho--oh")).toBe("Ho Oh");
    expect(toTitleCase("")).toBe("");
  });
});
