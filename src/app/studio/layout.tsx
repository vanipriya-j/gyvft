import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { StudioShell } from "@/components/studio/shell";
import { getCurrentProfile, requireStudioUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors/app-error";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const headerStore = await headers();
  const nextPath = headerStore.get("x-studio-pathname") || "/studio";
  let profile: Awaited<ReturnType<typeof requireStudioUser>>;
  try {
    const requiredProfile = await requireStudioUser();
    profile = (await getCurrentProfile()) ?? requiredProfile;
  } catch (error) {
    if (error instanceof AppError && error.code === "UNAUTHORIZED") {
      redirect(`/studio/login?next=${encodeURIComponent(nextPath)}`);
    }
    throw error;
  }
  return <StudioShell profile={profile}>{children}</StudioShell>;
}
