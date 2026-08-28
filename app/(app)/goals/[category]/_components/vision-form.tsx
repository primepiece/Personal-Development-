import { saveVisionAction } from "../../actions";
import type { visionEntries } from "@/db/schema";

type VisionEntry = typeof visionEntries.$inferSelect;

const FIELDS: {
  key: keyof Pick<
    VisionEntry,
    | "whoIWantToBecome"
    | "lifeLooksLike"
    | "longTermTargets"
    | "whyItMatters"
    | "refuseToBecome"
  >;
  label: string;
  placeholder: string;
}[] = [
  {
    key: "whoIWantToBecome",
    label: "Who I want to become",
    placeholder: "The identity, not the outcome.",
  },
  {
    key: "lifeLooksLike",
    label: "What my life looks like",
    placeholder: "Concretely — not a mood, a description.",
  },
  {
    key: "longTermTargets",
    label: "Long-term targets",
    placeholder: "Numbers and dates where you have them.",
  },
  {
    key: "whyItMatters",
    label: "Why it matters",
    placeholder: "The reason this pillar is on the list at all.",
  },
  {
    key: "refuseToBecome",
    label: "What I refuse to become",
    placeholder: "The version of you that isn't allowed.",
  },
];

export function VisionForm({
  categoryId,
  vision,
}: {
  categoryId: string;
  vision: VisionEntry | undefined;
}) {
  return (
    <form action={saveVisionAction} className="flex flex-col gap-4">
      <input type="hidden" name="categoryId" value={categoryId} />
      {FIELDS.map((field) => (
        <label key={field.key} className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint">
            {field.label}
          </span>
          <textarea
            name={field.key}
            defaultValue={vision?.[field.key] ?? ""}
            placeholder={field.placeholder}
            rows={2}
            className="resize-y rounded-sm border border-line bg-surface-raised px-3 py-2 text-[14px] text-ink outline-none focus-visible:border-accent"
          />
        </label>
      ))}
      <button
        type="submit"
        className="self-start rounded-sm bg-ink px-4 py-2 text-[13px] font-medium text-surface"
      >
        Save Vision
      </button>
    </form>
  );
}
