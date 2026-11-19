import { randomUUID } from "node:crypto";
import { requireCustomerAccount } from "@/lib/customer/session";
import {
  occasionsFor,
  peopleFor,
  briefFromProject,
} from "@/lib/customer/journeys";
import { ownedProject } from "@/lib/customer/data";
import { circleGiftContext } from "@/lib/customer/circles";
import { GiftIntake } from "@/components/customer/gift-intake";
export const dynamic = "force-dynamic";
export default async function NewGift({
  searchParams,
}: {
  searchParams: Promise<{
    occasion?: string;
    person?: string;
    repeat?: string;
    circle?: string;
    circle_occasion?: string;
  }>;
}) {
  const account = await requireCustomerAccount(),
    params = await searchParams;
  const [occasions, people] = await Promise.all([
    occasionsFor(account.id),
    peopleFor(account.id),
  ]);
  const o = occasions.find((x) => x.id === params.occasion),
    p = people.find((x) => x.id === (params.person || o?.person_id));
  const previous = params.repeat
    ? await ownedProject(params.repeat, account.id)
    : null;
  const repeat = previous ? briefFromProject(previous) : {};
  const context = params.circle
    ? await circleGiftContext(account.id, params.circle, params.circle_occasion)
    : null;
  return (
    <GiftIntake
      key={`${params.occasion || ""}-${params.person || ""}-${params.repeat || ""}-${params.circle || ""}-${params.circle_occasion || ""}`}
      id={randomUUID()}
      email={account.email}
      contextLabel={context?.circle.name}
      initial={{
        circle_id: null,
        circle_occasion_id: null,
        ...repeat,
        ...(previous
          ? {
              title: `${previous.title} · a new gift`,
              story: `Build on last time: ${previous.brief}`,
              delivery_date: "",
            }
          : {}),
        ...(o ? { title: o.title, occasion_id: o.id, occasion: o.title } : {}),
        ...(p
          ? {
              person_id: p.id,
              recipient_notes: p.name,
              likes: p.shared_interests || p.likes,
              avoid: p.shared_avoid || p.avoid,
              recipients: 1,
            }
          : {}),
        ...(context
          ? {
              circle_id: context.circle.id,
              circle_occasion_id: context.occasion?.id || null,
              ...(context.occasion
                ? {
                    title: context.occasion.title,
                    occasion: context.occasion.title,
                  }
                : {}),
            }
          : {}),
        phone: "",
      }}
    />
  );
}
