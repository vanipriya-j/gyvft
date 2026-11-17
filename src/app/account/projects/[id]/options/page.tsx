import { notFound } from "next/navigation";
import Link from "next/link";
import { RequestNavigation } from "@/components/customer/request-navigation";
import styles from "@/components/customer/request.module.css";
import { requireCustomerAccount } from "@/lib/customer/session";
import { ownedProject } from "@/lib/customer/data";
import { giftWorkspace } from "@/lib/customer/gift-workspace";
import { GiftWorkspace } from "@/components/customer/gift-workspace";
export const dynamic = "force-dynamic";
export default async function GiftOptionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const account = await requireCustomerAccount();
  const { id } = await params;
  const project = await ownedProject(id, account.id);
  if (!project) notFound();
  const data = await giftWorkspace(id);
  return (
    <div className={styles.workspace}>
      <Link
        href={`/account/projects/${id}`}
        className="text-sm text-muted-text"
      >
        ← Back to your request
      </Link>
      <div className="my-3">
        <p className="text-xs uppercase tracking-widest text-olive">
          Your gifting request
        </p>
        <h1 className="mt-2 font-serif text-2xl md:text-3xl">
          {project.title}
        </h1>
      </div>
      <RequestNavigation
        id={id}
        view="options"
        optionCount={
          data.options.filter((o) => o.published && !o.hidden).length
        }
      />
      <GiftWorkspace
        key={id}
        projectId={id}
        initial={data}
        readOnly={
          project.kind === "project" ||
          String(project.submission_key || "").startsWith("gyvft-demo-")
        }
      />
    </div>
  );
}
