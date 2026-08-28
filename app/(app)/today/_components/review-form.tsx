import { saveReviewAction } from "../actions";
import type { dailyReviews } from "@/db/schema";

type Review = typeof dailyReviews.$inferSelect;

export function ReviewForm({ review }: { review: Review | undefined }) {
  return (
    <form action={saveReviewAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="field-label">What happened today?</span>
        <textarea
          name="rawText"
          required
          defaultValue={review?.rawText ?? ""}
          rows={6}
          placeholder="Write naturally — what you did, avoided, how it went. No structure required."
          className="field-input resize-y"
        />
      </label>

      <div className="grid grid-cols-2 gap-4 sm:max-w-xs">
        <label className="flex flex-col gap-1.5">
          <span className="field-label">Energy /10</span>
          <input
            type="number"
            name="energyRating"
            min={1}
            max={10}
            defaultValue={review?.energyRating ?? ""}
            className="field-input"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="field-label">Day /10</span>
          <input
            type="number"
            name="dayRating"
            min={1}
            max={10}
            defaultValue={review?.dayRating ?? ""}
            className="field-input"
          />
        </label>
      </div>

      <button
        type="submit"
        className="self-start rounded-sm bg-ink px-4 py-2 text-[13px] font-medium text-surface"
      >
        {review ? "Update review" : "Save review"}
      </button>
    </form>
  );
}
