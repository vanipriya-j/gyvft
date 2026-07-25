import { ForgotPasswordForm } from "@/components/studio/auth-forms";

export default function StudioForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">GYVFT Studio</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Reset password</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Enter the email attached to your Studio account.</p>
        <div className="mt-8">
          <ForgotPasswordForm />
        </div>
      </section>
    </main>
  );
}
