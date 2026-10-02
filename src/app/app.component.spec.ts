import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { Router, provideRouter } from "@angular/router";
import { AppComponent } from "./app.component";

@Component({ template: "<p>Home page</p>" })
class HomeStubPage {}

describe("AppComponent", () => {
  let failNextLoad: boolean;

  beforeEach(() => {
    failNextLoad = false;
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([
          { path: "", component: HomeStubPage },
          {
            path: "lazy",
            loadComponent: () =>
              failNextLoad
                ? Promise.reject(new Error("ChunkLoadError"))
                : Promise.resolve(HomeStubPage),
          },
        ]),
      ],
    });
  });

  it("shows a loader until the first page activates", async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      "Loading",
    );

    await TestBed.inject(Router).navigateByUrl("/");
    await fixture.whenStable();

    expect(element.querySelector('[role="status"]')).toBeNull();
    expect(element.textContent).toContain("Home page");
  });

  it("offers Retry when a lazy page fails to download", async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const element = fixture.nativeElement as HTMLElement;
    const router = TestBed.inject(Router);

    failNextLoad = true;
    await router.navigateByUrl("/lazy").catch(() => undefined);
    await fixture.whenStable();

    const alert = element.querySelector('.app-shell__error [role="alert"]');
    expect(alert?.textContent).toContain("Couldn't load this page");

    failNextLoad = false;
    element
      .querySelector<HTMLButtonElement>(
        '.app-shell__error [role="alert"] button',
      )
      ?.click();
    await fixture.whenStable();

    expect(element.querySelector(".app-shell__error")).toBeNull();
    expect(router.url).toBe("/lazy");
  });
});
