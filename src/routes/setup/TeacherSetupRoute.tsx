import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { useApplicationServices } from "../../app/ApplicationServicesProvider";
import { TeacherSetupApiError } from "../../services/auth";
import { ReadingPassageApiError } from "../../services/persistence";
import { KeywordBanner } from "../classroom/components/KeywordBanner";
import { TeacherAccessPanel } from "./components/TeacherAccessPanel";
import { TeacherSetupHeader } from "./components/TeacherSetupHeader";
import { TeacherWorkspace } from "./components/TeacherWorkspace";
import "../classroom/classroom.css";
import "./teacher-setup.css";

type SetupView = "checking" | "access" | "workspace";
type MessageTone = "success" | "error" | null;

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function TeacherSetupRoute() {
  const { readingPassages, teacherSetup } = useApplicationServices();
  const [view, setView] = useState<SetupView>("checking");
  const [password, setPassword] = useState("");
  const [accessError, setAccessError] = useState<string | null>(null);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [passage, setPassage] = useState("");
  const [savedPassage, setSavedPassage] = useState("");
  const [isLoadingPassage, setIsLoadingPassage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveMessageTone, setSaveMessageTone] = useState<MessageTone>(null);

  useEffect(() => {
    const controller = new AbortController();

    teacherSetup
      .getSession(controller.signal)
      .then((authenticated) => setView(authenticated ? "workspace" : "access"))
      .catch((error: unknown) => {
        if (isAbortError(error)) {
          return;
        }
        setAccessError(
          "We couldn’t check Teacher Access right now. Please try your password in a moment.",
        );
        setView("access");
      });

    return () => controller.abort();
  }, [teacherSetup]);

  useEffect(() => {
    if (view !== "workspace") {
      return;
    }

    const controller = new AbortController();
    setIsLoadingPassage(true);
    setSaveMessage(null);
    setSaveMessageTone(null);

    readingPassages
      .getLatest(controller.signal)
      .then((latestPassage) => {
        if (!latestPassage) {
          throw new Error("No reading passage is available.");
        }
        setPassage(latestPassage.content);
        setSavedPassage(latestPassage.content);
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) {
          return;
        }
        setSaveMessage("Today’s passage could not be loaded. Please refresh and try again.");
        setSaveMessageTone("error");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingPassage(false);
        }
      });

    return () => controller.abort();
  }, [readingPassages, view]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password || isSubmittingPassword) {
      return;
    }

    setIsSubmittingPassword(true);
    setAccessError(null);
    try {
      await teacherSetup.login(password);
      setPassword("");
      setView("workspace");
    } catch (error) {
      if (error instanceof TeacherSetupApiError) {
        setAccessError(
          error.status === 401
            ? "That password doesn’t match. Please check it and try again."
            : error.message,
        );
      } else {
        setAccessError("Teacher Access is temporarily unavailable. Please try again.");
      }
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  const handlePassageChange = (nextPassage: string) => {
    setPassage(nextPassage);
    setSaveMessage(null);
    setSaveMessageTone(null);
  };

  const handleSave = async () => {
    if (!passage.trim() || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);
    setSaveMessageTone(null);
    try {
      const updatedPassage = await readingPassages.saveLatest({ content: passage });
      setPassage(updatedPassage.content);
      setSavedPassage(updatedPassage.content);
      setSaveMessage("Saved. Classroom Mode is ready with the latest passage.");
      setSaveMessageTone("success");
    } catch (error) {
      if (error instanceof ReadingPassageApiError && error.status === 401) {
        setView("access");
        setAccessError("Your Teacher Access session ended. Please enter the password again.");
      } else {
        setSaveMessage(
          error instanceof Error
            ? error.message
            : "The passage could not be saved. Please try again.",
        );
        setSaveMessageTone("error");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    try {
      await teacherSetup.logout();
      setPassword("");
      setPassage("");
      setSavedPassage("");
      setSaveMessage(null);
      setView("access");
    } catch {
      setSaveMessage("We couldn’t sign out just now. Please try again.");
      setSaveMessageTone("error");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <main className="teacher-setup-page">
      <TeacherSetupHeader
        authenticated={view === "workspace"}
        isLoggingOut={isLoggingOut}
        onLogout={handleLogout}
      />
      <KeywordBanner />

      {view === "checking" ? (
        <section className="teacher-access teacher-access--checking" aria-live="polite">
          <span className="teacher-access__loader" aria-hidden="true" />
          <h1>Preparing Teacher Setup…</h1>
          <p>Checking your secure classroom session.</p>
        </section>
      ) : null}

      {view === "access" ? (
        <TeacherAccessPanel
          password={password}
          errorMessage={accessError}
          isSubmitting={isSubmittingPassword}
          onPasswordChange={(nextPassword) => {
            setPassword(nextPassword);
            setAccessError(null);
          }}
          onSubmit={handleLogin}
        />
      ) : null}

      {view === "workspace" ? (
        <TeacherWorkspace
          passage={passage}
          savedPassage={savedPassage}
          isLoading={isLoadingPassage}
          isSaving={isSaving}
          saveMessage={saveMessage}
          saveMessageTone={saveMessageTone}
          onPassageChange={handlePassageChange}
          onSave={handleSave}
        />
      ) : null}
    </main>
  );
}
