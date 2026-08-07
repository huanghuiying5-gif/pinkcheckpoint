import { useEffect, useState } from "react";

import { useApplicationServices } from "../../app/ApplicationServicesProvider";
import { ClassroomDecor } from "./components/ClassroomDecor";
import { HeroSection } from "./components/HeroSection";
import { KeywordBanner } from "./components/KeywordBanner";
import { MicrophonePrompt } from "./components/MicrophonePrompt";
import { ReadingCard } from "./components/ReadingCard";
import { SessionSteps } from "./components/SessionSteps";
import { SiteHeader } from "./components/SiteHeader";
import "./classroom.css";

export function ClassroomRoute() {
  const { readingPassages } = useApplicationServices();
  const [passage, setPassage] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    readingPassages
      .getLatest(controller.signal)
      .then((latestPassage) => {
        if (latestPassage) {
          setPassage(latestPassage.content);
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setLoadFailed(true);
      });

    return () => controller.abort();
  }, [readingPassages]);

  const visiblePassage =
    passage ??
    (loadFailed
      ? "Today’s reading is temporarily unavailable."
      : "Loading today’s reading…");

  return (
    <main className="classroom-page">
      <SiteHeader />
      <HeroSection />
      <KeywordBanner />

      <section className="reading-stage" aria-labelledby="reading-title">
        <ClassroomDecor />
        <div className="reading-stage__content">
          <ReadingCard passage={visiblePassage} />
          <MicrophonePrompt />
          <SessionSteps />
          <p className="classroom-signoff">
            <span aria-hidden="true">♥</span>
            Every voice has a rhythm. Discover yours.
          </p>
        </div>
      </section>
    </main>
  );
}
