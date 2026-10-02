import { Injectable, PLATFORM_ID, inject } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";

@Injectable({ providedIn: "root" })
export class ImagePreloadService {
  private readonly platformId = inject(PLATFORM_ID);
  // Elements are kept so an in-flight download is not dropped, and so each
  // URL is requested only once per session.
  private readonly images = new Map<string, HTMLImageElement>();

  /**
   * Starts downloading images in the background so they are ready by the time
   * they are rendered. URLs that were already requested, and empty values,
   * are skipped.
   * @param urls Image URLs to fetch.
   */
  preload(urls: readonly (string | null)[]): void {
    if (!isPlatformBrowser(this.platformId)) return;
    for (const url of urls) {
      if (!url || this.images.has(url)) continue;
      const image = new Image();
      image.decoding = "async";
      image.src = url;
      this.images.set(url, image);
    }
  }
}
