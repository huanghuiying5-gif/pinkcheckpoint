import { ArrowLeft, Heart } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { useApplicationServices } from "../../app/ApplicationServicesProvider";
import { APP_ROUTES } from "../../app/routes";
import {
  PraiseReveal,
  StarRating,
  useCelebrationSequence,
} from "../../features/feedback";
import { KeywordBanner } from "../classroom/components/KeywordBanner";
import { SiteHeader } from "../classroom/components/SiteHeader";
import "../classroom/classroom.css";
import "./feedback.css";

export function FeedbackRoute() {
  const { speechAnalysis } = useApplicationServices();
  const [feedback] = useState(() => speechAnalysis.getLatestResult());
  const dimensions = [
    {
      name: "Rhythm",
      rating: feedback.rhythm,
      message: feedback.comments.rhythm,
    },
    {
      name: "Fluency",
      rating: feedback.fluency,
      message: feedback.comments.fluency,
    },
    {
      name: "Clarity",
      rating: feedback.clarity,
      message: feedback.comments.clarity,
    },
  ] as const;
  const { praiseWord, isRevealed } = useCelebrationSequence(
    feedback.praise,
  );

  return (
    <main className="classroom-page feedback-page">
      <SiteHeader />
      <KeywordBanner />

      <section className="feedback-main" aria-labelledby="feedback-title">
        <div className="feedback-content">
          <div className="feedback-heading">
            <Heart aria-hidden="true" />
            <p>Your Reading Reflection</p>
            <h1 id="feedback-title">Listen to what you achieved.</h1>
          </div>

          <div className="praise-stage">
            {isRevealed ? (
              <PraiseReveal praiseWord={praiseWord} />
            ) : (
              <div className="praise-stage__waiting" role="status">
                <span />
                <span />
                <span />
                <p>Celebrating your reading…</p>
              </div>
            )}
          </div>

          {isRevealed && (
            <div className="feedback-results">
              <div className="feedback-panel">
                {dimensions.map((dimension, index) => (
                  <article
                    className="feedback-dimension"
                    key={dimension.name}
                    style={{ animationDelay: `${index * 110}ms` }}
                  >
                    <h2>{dimension.name}</h2>
                    <StarRating
                      label={dimension.name}
                      rating={dimension.rating}
                    />
                    <p>{dimension.message}</p>
                  </article>
                ))}
              </div>

              <p className="feedback-encouragement">
                <Heart aria-hidden="true" />
                Keep following the rhythm of your voice.
              </p>

              <Link className="read-again-button" to={APP_ROUTES.classroom}>
                <ArrowLeft aria-hidden="true" />
                Read Again
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
