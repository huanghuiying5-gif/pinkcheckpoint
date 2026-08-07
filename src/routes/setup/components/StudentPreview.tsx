import { Eye } from "lucide-react";

import { ReadingCard } from "../../classroom/components/ReadingCard";

interface StudentPreviewProps {
  passage: string;
  isLoading: boolean;
}

export function StudentPreview({ passage, isLoading }: StudentPreviewProps) {
  const previewPassage =
    passage.trim() ||
    (isLoading
      ? "Loading today’s reading…"
      : "Your reading passage will appear here as you type.");

  return (
    <section className="setup-panel student-preview" aria-labelledby="student-preview-title">
      <div className="student-preview__heading">
        <div>
          <p>Live classroom view</p>
          <h2 id="student-preview-title">Student Preview</h2>
        </div>
        <span className="student-preview__badge">
          <Eye aria-hidden="true" />
          Classroom Mode
        </span>
      </div>
      <p className="student-preview__description">
        This uses the same reading card students will see on the classroom screen.
      </p>
      <div className="student-preview__canvas">
        <ReadingCard passage={previewPassage} />
      </div>
    </section>
  );
}
