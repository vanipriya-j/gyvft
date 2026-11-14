"use client";
import { useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { emptyRecipient } from "@/lib/validation/gift-brief";
import type { StoryFormInput } from "@/lib/validation/story-form";

export function RecipientFields({
  form,
}: {
  form: UseFormReturn<StoryFormInput>;
}) {
  const {
    control,
    register,
    setValue,
    formState: { errors },
  } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "gift_brief.recipients",
  });
  const type = useWatch({ control, name: "gift_brief.recipient_type" });
  function changeType(value: "person" | "group" | "individuals") {
    // A mode change never silently deletes entered individual profiles.
    setValue("gift_brief.recipient_type", value, { shouldDirty: true });
    if (value === "group")
      setValue(
        "gift_brief.group_size",
        Math.max(2, form.getValues("gift_brief.group_size")),
      );
    if (value === "individuals" && fields.length < 2) append(emptyRecipient());
  }
  const e = errors.gift_brief;
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-3 font-medium">Who are you gifting?</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ["person", "One person"],
              ["group", "A group"],
              ["individuals", "Separate individuals"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`cursor-pointer rounded-2xl border p-4 text-sm ${type === value ? "border-copper bg-copper/10" : "border-ink/15"}`}
            >
              <input
                type="radio"
                name="recipient-choice"
                value={value}
                checked={type === value}
                onChange={() => changeType(value)}
                className="mr-2 accent-current"
                disabled={value !== "individuals" && fields.length > 1}
              />
              {label}
            </label>
          ))}
        </div>
        {fields.length > 1 && (
          <p className="mt-3 text-sm text-ink/65">
            Remove extra profiles before switching to one person or one group.
          </p>
        )}
      </fieldset>
      {type === "group" && (
        <label className="block space-y-2 text-sm font-medium">
          How many recipients are in the group?
          <Input
            type="number"
            min={2}
            max={100000}
            {...register("gift_brief.group_size", { valueAsNumber: true })}
          />
          {e?.group_size?.message && (
            <span className="text-copper-deep">{e.group_size.message}</span>
          )}
        </label>
      )}
      <p className="text-sm text-ink/65">
        {type === "group"
          ? "Describe the group and their shared preferences. Use separate individuals when each person needs their own profile."
          : "Tell us about each recipient so we can make the gift personal."}{" "}
        Leave likes or dislikes blank if you don’t know yet.
      </p>
      {fields.map((field, index) => (
        <fieldset
          key={field.id}
          className="space-y-4 rounded-2xl border border-ink/15 p-5"
        >
          <legend className="px-2 text-sm font-medium">
            {type === "group" ? "Group profile" : `Recipient ${index + 1}`}
          </legend>
          {(["name", "description", "likes", "dislikes"] as const).map(
            (key) => (
              <label key={key} className="block space-y-2 text-sm font-medium">
                {key === "name"
                  ? type === "group"
                    ? "Group name or label"
                    : "Name or label"
                  : key === "description"
                    ? type === "group"
                      ? "Describe this group"
                      : "Describe this person"
                    : key === "likes"
                      ? "Likes and interests (optional)"
                      : "Dislikes or things to avoid (optional)"}
                {key === "name" ? (
                  <Input
                    maxLength={160}
                    {...register(`gift_brief.recipients.${index}.${key}`)}
                  />
                ) : (
                  <Textarea
                    maxLength={key === "description" ? 2000 : 1000}
                    {...register(`gift_brief.recipients.${index}.${key}`)}
                  />
                )}
                {e?.recipients?.[index]?.[key]?.message && (
                  <span className="block text-copper-deep">
                    {e.recipients[index]?.[key]?.message}
                  </span>
                )}
              </label>
            ),
          )}
          {type === "individuals" && fields.length > 1 && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => remove(index)}
              aria-label={`Remove recipient ${index + 1}`}
            >
              Remove recipient
            </Button>
          )}
        </fieldset>
      ))}
      {e?.recipients?.root?.message && (
        <p className="text-sm text-copper-deep">{e.recipients.root.message}</p>
      )}
      {e?.recipients?.message && (
        <p className="text-sm text-copper-deep">{e.recipients.message}</p>
      )}
      {type === "individuals" && (
        <Button
          type="button"
          variant="secondary"
          disabled={fields.length >= 50}
          onClick={() => append(emptyRecipient())}
        >
          + Add another recipient
        </Button>
      )}
    </div>
  );
}
