import { PassageEditor } from "./PassageEditor";
import { StudentPreview } from "./StudentPreview";

interface TeacherWorkspaceProps {
  passage: string;
  savedPassage: string;
  isLoading: boolean;
  isSaving: boolean;
  saveMessage: string | null;
  saveMessageTone: "success" | "error" | null;
  onPassageChange: (passage: string) => void;
  onSave: () => void;
}

function countWords(value: string): number {
  const normalized = value.trim();
  return normalized ? normalized.split(/\s+/).length : 0;
}

export function TeacherWorkspace({
  passage,
  savedPassage,
  isLoading,
  isSaving,
  saveMessage,
  saveMessageTone,
  onPassageChange,
  onSave,
}: TeacherWorkspaceProps) {
  return (
    <>
      <section className="teacher-setup__intro" aria-labelledby="teacher-setup-title">
        <p className="teacher-setup__intro-mark" aria-hidden="true">✦</p>
        <h1 id="teacher-setup-title">Teacher Setup</h1>
        <p>Prepare your reading activity before class.</p>
      </section>

      <div className="teacher-workspace">
        <PassageEditor
          value={passage}
          wordCount={countWords(passage)}
          isLoading={isLoading}
          isSaving={isSaving}
          hasChanges={passage.trim() !== savedPassage.trim()}
          message={saveMessage}
          messageTone={saveMessageTone}
          onChange={onPassageChange}
          onSave={onSave}
        />
        <StudentPreview passage={passage} isLoading={isLoading} />
      </div>
    </>
  );
}
