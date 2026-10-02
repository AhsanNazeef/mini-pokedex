import { TestBed } from "@angular/core/testing";
import { CacheService } from "./cache.service";

describe("CacheService", () => {
  let service: CacheService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    service = TestBed.inject(CacheService);
  });

  it("round-trips a value through localStorage by default", () => {
    service.set("teamCount", 7);

    expect(service.get<number>("teamCount")).toBe(7);
    expect(sessionStorage.getItem("teamCount")).toBeNull();
  });

  it("keeps the two storage types apart", () => {
    service.set("where", "local");
    service.set("where", "session", "session");

    expect(service.get<string>("where")).toBe("local");
    expect(service.get<string>("where", "session")).toBe("session");
  });

  it("returns null for a missing key and after removal", () => {
    expect(service.get("absent")).toBeNull();

    service.set("doomed", 1);
    service.remove("doomed");
    expect(service.get("doomed")).toBeNull();
  });

  it("discards an unreadable entry instead of throwing", () => {
    localStorage.setItem("broken", "{not json");

    expect(service.get("broken")).toBeNull();
    expect(localStorage.getItem("broken")).toBeNull();
  });

  it("ignores write failures so callers never depend on the cache", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

    expect(() => service.set("full", "value")).not.toThrow();
    setItem.mockRestore();
  });

  it("stores values in memory for the lifetime of the page", () => {
    service.setInApp("draft", { name: "Kanto" });
    expect(service.getInApp<{ name: string }>("draft")).toEqual({
      name: "Kanto",
    });

    service.removeInApp("draft");
    expect(service.getInApp("draft")).toBeNull();
    expect(localStorage.getItem("draft")).toBeNull();
  });
});
