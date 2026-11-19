import Link from "@/components/ui/navigation-link";
import { randomUUID } from "node:crypto";
import { requireCustomerAccount } from "@/lib/customer/session";
import { profileFor } from "@/lib/customer/journeys";
import { circlesReady } from "@/lib/customer/circles";
import { CreateCircleForm } from "@/components/customer/circle-controls";
export const dynamic = "force-dynamic";
export default async function NewCircle() {
  const a = await requireCustomerAccount(),
    p = await profileFor(a.id);
  return (
    <div className="mx-auto max-w-3xl">
      <Link className="app-button quiet mb-3" href="/account/circles">
        ← Your circles
      </Link>
      <div className="app-title">
        <div>
          <h1>Bring your people together</h1>
          <p>One account. As many circles as your life needs.</p>
        </div>
      </div>
      {(await circlesReady()) ? (
        <CreateCircleForm id={randomUUID()} displayName={p.name} />
      ) : (
        <p className="app-soft">
          GYVFT needs to approve and apply the Circles database update first.
        </p>
      )}
    </div>
  );
}
