import { Suspense } from "react";
import { LoginForm } from "@/components/studio/auth-forms";

export default function StudioLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">GYVFT Studio</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Use your invited Studio account. Public signup is disabled.</p>
        <div className="mt-8">
          <Suspense fallback={<p className="text-sm text-slate-500">Loading sign-in...</p>}>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
