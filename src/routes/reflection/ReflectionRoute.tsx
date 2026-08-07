import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { APP_ROUTES } from "../../app/routes";
import { useReflectionTransition } from "../../features/ai-reflection";
import { KeywordBanner } from "../classroom/components/KeywordBanner";
import { SiteHeader } from "../classroom/components/SiteHeader";
import "../classroom/classroom.css";
import { ListeningOrb } from "./components/ListeningOrb";
import { ReflectionCards } from "./components/ReflectionCards";
import { ReflectionDecor } from "./components/ReflectionDecor";
import { ReflectionHeading } from "./components/ReflectionHeading";
import "./reflection.css";

export function ReflectionRoute() {
  const navigate = useNavigate();
  const showFeedback = useCallback(() => {
    navigate(APP_ROUTES.feedback, { replace: true });
  }, [navigate]);

  useReflectionTransition(showFeedback);

  return (
    <main className="classroom-page reflection-page">
      <SiteHeader />
      <KeywordBanner />

      <section className="reflection-main" aria-labelledby="reflection-title">
        <ReflectionDecor />
        <div className="reflection-content">
          <ReflectionHeading />
          <ListeningOrb />

          <p className="reflection-status" role="status">
            Analyzing your speech in real time...
          </p>

          <ReflectionCards />

          <p className="reflection-signoff">
            <span aria-hidden="true">♥</span>
            Almost there! Great effort!
          </p>
        </div>
      </section>
    </main>
  );
}
