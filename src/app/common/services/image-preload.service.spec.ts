import { TestBed } from "@angular/core/testing";
import { ImagePreloadService } from "./image-preload.service";

describe("ImagePreloadService", () => {
  it("requests each URL once and skips empty values", () => {
    const service = TestBed.inject(ImagePreloadService);
    const created = vi.spyOn(globalThis, "Image");

    service.preload(["a.png", null, "b.png", "a.png"]);
    service.preload(["b.png"]);

    expect(created).toHaveBeenCalledTimes(2);
    created.mockRestore();
  });
});
