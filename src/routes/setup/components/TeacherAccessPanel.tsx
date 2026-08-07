import { ArrowRight, LockKeyhole } from "lucide-react";
import type { FormEvent } from "react";

interface TeacherAccessPanelProps {
  password: string;
  errorMessage: string | null;
  isSubmitting: boolean;
  onPasswordChange: (password: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function TeacherAccessPanel({
  password,
  errorMessage,
  isSubmitting,
  onPasswordChange,
  onSubmit,
}: TeacherAccessPanelProps) {
  return (
    <section className="teacher-access" aria-labelledby="teacher-access-title">
      <div className="teacher-access__lock" aria-hidden="true">
        <LockKeyhole />
      </div>
      <p className="teacher-access__eyebrow">A quiet space for teachers</p>
      <h1 id="teacher-access-title">Teacher Access</h1>
      <p className="teacher-access__intro">
        Enter the classroom password to prepare today’s reading activity.
      </p>

      <form className="teacher-access__form" onSubmit={onSubmit} noValidate>
        <label htmlFor="teacher-password">Password</label>
        <input
          id="teacher-password"
          name="password"
          type="password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          autoComplete="current-password"
          autoFocus
          aria-invalid={Boolean(errorMessage)}
          aria-describedby={errorMessage ? "teacher-access-error" : undefined}
          disabled={isSubmitting}
        />
        {errorMessage ? (
          <p id="teacher-access-error" className="teacher-access__error" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <button type="submit" disabled={isSubmitting || !password}>
          {isSubmitting ? "Checking…" : "Continue"}
          <ArrowRight aria-hidden="true" />
        </button>
      </form>

      <p className="teacher-access__note">
        Your password is checked securely and is never stored in this browser.
      </p>
    </section>
  );
}
