import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/app/account/auth-actions", () => ({
  registerCustomerAction: vi.fn(),
  loginCustomerAction: vi.fn(),
  requestCustomerPasswordResetAction: vi.fn(),
  resetCustomerPasswordAction: vi.fn(),
}));
import LoginPage from "@/app/account/login/page";

describe("public signup entry", () => {
  it("opens registration directly, without enquiry-only language", async () => {
    const html = renderToStaticMarkup(
      await LoginPage({ searchParams: Promise.resolve({ mode: "signup" }) }),
    );
    expect(html).toContain("Make yourself at home.");
    expect(html).toContain("Create your account</button>");
    expect(html).toContain("Email address");
    expect(html).toContain('autoComplete="new-password"');
    expect(html).not.toContain("Email used for your enquiry");
    expect(html).not.toContain("Sign in to My GYVFT</button>");
  });
  it("keeps sign-in as the default and rejects an unknown mode", async () => {
    for (const mode of [undefined, "unexpected"]) {
      const html = renderToStaticMarkup(
        await LoginPage({ searchParams: Promise.resolve({ mode }) }),
      );
      expect(html).toContain("Sign in to My GYVFT</button>");
      expect(html).toContain('autoComplete="current-password"');
    }
  });
  it("preserves recovery and gives a reset token precedence over signup", async () => {
    const recovery = renderToStaticMarkup(
      await LoginPage({ searchParams: Promise.resolve({ mode: "forgot" }) }),
    );
    expect(recovery).toContain("Send password reset link</button>");
    const reset = renderToStaticMarkup(
      await LoginPage({
        searchParams: Promise.resolve({
          mode: "signup",
          reset: "example-reset-token",
        }),
      }),
    );
    expect(reset).toContain("Save new password</button>");
    expect(reset).toContain("Choose a new password");
    expect(reset).not.toContain('name="email"');
  });
});
