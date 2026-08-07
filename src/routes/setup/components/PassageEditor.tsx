import { Check, Save } from "lucide-react";

interface PassageEditorProps {
  value: string;
  wordCount: number;
  isLoading: boolean;
  isSaving: boolean;
  hasChanges: boolean;
  message: string | null;
  messageTone: "success" | "error" | null;
  onChange: (value: string) => void;
  onSave: () => void;
}

export function PassageEditor({
  value,
  wordCount,
  isLoading,
  isSaving,
  hasChanges,
  message,
  messageTone,
  onChange,
  onSave,
}: PassageEditorProps) {
  const isRecommendedLength = wordCount >= 70 && wordCount <= 100;

  return (
    <section className="setup-panel passage-editor" aria-labelledby="passage-editor-title">
      <div className="setup-panel__heading">
        <p>Reading activity</p>
        <h2 id="passage-editor-title">Reading Text</h2>
        <span>Choose a passage with natural phrasing for oral reading.</span>
      </div>

      <label className="passage-editor__label" htmlFor="reading-passage">
        Today’s passage
      </label>
      <textarea
        id="reading-passage"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={isLoading ? "Loading today’s passage…" : "Write the reading passage here…"}
        disabled={isLoading || isSaving}
        aria-describedby="passage-word-count passage-save-message"
      />

      <div className="passage-editor__footer">
        <p
          id="passage-word-count"
          className={isRecommendedLength ? "passage-editor__count passage-editor__count--ideal" : "passage-editor__count"}
        >
          <strong>{wordCount}</strong> {wordCount === 1 ? "word" : "words"}
          <span>Recommended: 70–100</span>
        </p>
        <button
          className="passage-editor__save"
          type="button"
          onClick={onSave}
          disabled={isLoading || isSaving || !value.trim() || !hasChanges}
        >
          {isSaving ? <span className="passage-editor__saving" aria-hidden="true" /> : <Save aria-hidden="true" />}
          {isSaving ? "Saving…" : "Save Changes"}
        </button>
      </div>

      <div className="passage-editor__message-space">
        {message ? (
          <p
            id="passage-save-message"
            className={`passage-editor__message passage-editor__message--${messageTone}`}
            role={messageTone === "error" ? "alert" : "status"}
          >
            {messageTone === "success" ? <Check aria-hidden="true" /> : null}
            {message}
          </p>
        ) : (
          <span id="passage-save-message" />
        )}
      </div>
    </section>
  );
}
