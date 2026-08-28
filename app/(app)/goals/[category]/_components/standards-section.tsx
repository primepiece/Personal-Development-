import { addStandardAction, archiveStandardAction } from "../../actions";
import type { standards } from "@/db/schema";

type Standard = typeof standards.$inferSelect;

export function StandardsSection({
  categoryId,
  standards: activeStandards,
}: {
  categoryId: string;
  standards: Standard[];
}) {
  return (
    <div className="flex flex-col gap-3">
      {activeStandards.length === 0 ? (
        <p className="text-[13.5px] text-text-faint">No standards set yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {activeStandards.map((standard) => (
            <li
              key={standard.id}
              className="flex items-center justify-between gap-4 rounded-sm border border-border bg-surface px-3 py-2.5"
            >
              <p className="text-[14px] text-text-primary">{standard.statement}</p>
              <form action={archiveStandardAction}>
                <input type="hidden" name="standardId" value={standard.id} />
                <button
                  type="submit"
                  className="shrink-0 font-mono text-[11px] text-text-faint hover:text-warning"
                >
                  retire
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={addStandardAction} className="flex gap-2">
        <input type="hidden" name="categoryId" value={categoryId} />
        <input
          type="text"
          name="statement"
          required
          placeholder="I don't repeatedly break commitments I've made to myself."
          className="field-input flex-1"
        />
        <button
          type="submit"
          className="shrink-0 rounded-sm border border-border-strong px-3 py-2 text-[13px] font-medium text-text-primary"
        >
          Add
        </button>
      </form>
    </div>
  );
}
