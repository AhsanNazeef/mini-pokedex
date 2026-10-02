import { Injectable, inject, PLATFORM_ID } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";

type StorageType = "local" | "session";

export const TEAM_COUNT_CACHE_KEY = "teamCount";
export const SELECTED_TEAM_CACHE_KEY = "selectedTeamId";

interface CacheEntry<T> {
  value: T;
}

@Injectable({ providedIn: "root" })
export class CacheService {
  public inAppCache: Record<string, { value: unknown }> = {};
  private readonly platformId = inject(PLATFORM_ID);

  // ─────────────────────────────────────────────────────────
  // Browser Storage (localStorage/sessionStorage)
  // ─────────────────────────────────────────────────────────

  /**
   * Reads a cached value, or `null` when it is missing or unreadable
   * (private mode, cleared storage, corrupt JSON).
   * @param key Storage key.
   * @param storageType Which browser store to read from.
   */
  get<T>(key: string, storageType: StorageType = "local"): T | null {
    const storage = this.getStorage(storageType);
    if (!storage) return null;

    const cachedRaw = storage.getItem(key);
    if (cachedRaw) {
      try {
        const cached: CacheEntry<T> = JSON.parse(cachedRaw);
        return cached.value;
      } catch {
        this.remove(key, storageType);
      }
    }
    return null;
  }

  /**
   * Stores a value. Write failures (quota, private mode) are ignored, so
   * callers never have to treat the cache as required.
   * @param key Storage key.
   * @param value Value to store; must be JSON-serialisable.
   * @param storageType Which browser store to write to.
   */
  set<T>(key: string, value: T, storageType: StorageType = "local"): void {
    const storage = this.getStorage(storageType);
    if (!storage) return;

    const entry: CacheEntry<T> = { value };
    try {
      storage.setItem(key, JSON.stringify(entry));
    } catch {
      // Ignore storage write failures (quota exceeded, private mode, etc.)
    }
  }

  /**
   * Deletes a cached value.
   * @param key Storage key.
   * @param storageType Which browser store to delete from.
   */
  remove(key: string, storageType: StorageType = "local"): void {
    const storage = this.getStorage(storageType);
    if (!storage) return;
    storage.removeItem(key);
  }

  // ─────────────────────────────────────────────────────────
  // In-App Memory Cache (survives navigation, lost on refresh)
  // ─────────────────────────────────────────────────────────

  /**
   * Reads a value from the in-memory cache.
   * @param key Cache key.
   */
  getInApp<T>(key: string): T | null {
    const entry = this.inAppCache[key];
    if (!entry) return null;
    return entry.value as T;
  }

  /**
   * Stores a value in memory for the lifetime of the page.
   * @param key Cache key.
   * @param value Value to store.
   */
  setInApp<T>(key: string, value: T): void {
    this.inAppCache[key] = { value };
  }

  /**
   * Removes a value from the in-memory cache.
   * @param key Cache key.
   */
  removeInApp(key: string): void {
    delete this.inAppCache[key];
  }

  private getStorage(storageType: StorageType): Storage | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      return storageType === "local" ? localStorage : sessionStorage;
    } catch {
      // Blocked by browser settings.
      return null;
    }
  }
}
