import { AudioWaveform, Check, Mic, Square } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { useApplicationServices } from "../../../app/ApplicationServicesProvider";
import { APP_ROUTES } from "../../../app/routes";
import { prepareCelebrationAudio } from "../../../features/feedback";
import {
  formatElapsedTime,
  useReadingSession,
} from "../../../features/reading-session";
import {
  AudioMiniPlayer,
  extractRecordingCharacteristics,
  useAudioObjectUrl,
  useMediaRecorder,
} from "../../../features/recording";
import { BackgroundPreparationGate } from "../../../services/analysis/BackgroundPreparationGate";

interface MicrophonePromptProps {
  referenceText: string;
  passageRevision?: number;
}

function logPreparation(event: string, sessionId?: string): void {
  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")
  ) {
    console.debug("[Speak with Rhythm] background preparation", {
      event,
      sessionId,
    });
  }
}

export function MicrophonePrompt({
  referenceText,
  passageRevision,
}: MicrophonePromptProps) {
  const navigate = useNavigate();
  const { speechAnalysis } = useApplicationServices();
  const preparationGateRef = useRef<BackgroundPreparationGate | null>(null);
  const cleanupTimerRef = useRef<number | null>(null);
  const isNavigatingRef = useRef(false);
  if (!preparationGateRef.current) {
    preparationGateRef.current = new BackgroundPreparationGate(speechAnalysis, {
      onEvent: logPreparation,
    });
  }
  const preparationGate = preparationGateRef.current;
  const {
    phase,
    countdown,
    elapsedSeconds,
    startCountdown,
    completeRecording,
    resetSession,
  } = useReadingSession();
  const {
    status: microphoneStatus,
    error: microphoneError,
    requestMicrophone,
    startRecording,
    stopRecording: stopMediaRecorder,
    recordedAudio,
  } = useMediaRecorder();
  const playbackUrl = useAudioObjectUrl(recordedAudio?.blob ?? null);
  const isCountdown = phase === "countdown";
  const isRecording = phase === "recording";
  const isReview = phase === "review";
  const isRequestingPermission = microphoneStatus === "requesting";

  const beginReading = useCallback(async () => {
    preparationGate.reset();
    isNavigatingRef.current = false;
    const microphoneIsReady = await requestMicrophone();

    if (microphoneIsReady) {
      startCountdown();
    }
  }, [preparationGate, requestMicrophone, startCountdown]);

  const resetReadingSession = useCallback(() => {
    preparationGate.reset();
    resetSession();
  }, [preparationGate, resetSession]);

  const finishReading = useCallback(() => {
    stopMediaRecorder();
  }, [stopMediaRecorder]);

  useEffect(() => {
    if (phase !== "recording") {
      return;
    }

    if (!startRecording()) {
      resetReadingSession();
    }
  }, [phase, resetReadingSession, startRecording]);

  useEffect(() => {
    if (phase === "recording" && microphoneStatus === "error") {
      resetReadingSession();
    }
  }, [microphoneStatus, phase, resetReadingSession]);

  useEffect(() => {
    if (cleanupTimerRef.current !== null) {
      window.clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }
    return () => {
      cleanupTimerRef.current = window.setTimeout(() => {
        if (!isNavigatingRef.current) {
          preparationGate.reset();
        }
      }, 0);
    };
  }, [preparationGate]);

  useEffect(() => {
    preparationGate.setPassage({ referenceText, passageRevision });
  }, [passageRevision, preparationGate, referenceText]);

  useEffect(() => {
    if (phase === "recording" && recordedAudio) {
      completeRecording();
    }
  }, [completeRecording, phase, recordedAudio]);

  useEffect(() => {
    if (!recordedAudio) {
      preparationGate.reset();
      return;
    }

    if (recordedAudio.blob.size === 0 || !recordedAudio.mimeType.trim()) {
      preparationGate.reset();
      return;
    }

    preparationGate.setRecording({
      audio: recordedAudio.blob,
      mimeType: recordedAudio.mimeType,
    });
    logPreparation("recording blob ready");
    void extractRecordingCharacteristics(
      recordedAudio.blob,
      elapsedSeconds,
    ).then((characteristics) => {
      if (recordedAudio.blob.size === 0) {
        return;
      }
      logPreparation("recording characteristics ready", characteristics.attemptId);
      preparationGate.setCharacteristics(recordedAudio.blob, characteristics);
    });
  }, [elapsedSeconds, preparationGate, recordedAudio]);

  const analyzeReading = useCallback(() => {
    if (isNavigatingRef.current || !recordedAudio) {
      return;
    }

    isNavigatingRef.current = true;
    prepareCelebrationAudio();

    navigate(APP_ROUTES.reflection, {
      state: { analysisSessionId: preparationGate.getSessionId() },
    });
  }, [
    navigate,
    recordedAudio,
  ]);

  return (
    <div className={`microphone-prompt microphone-prompt--${phase}`}>
      <div className="microphone-prompt__control">
        <AudioWaveform className="microphone-prompt__wave" aria-hidden="true" />
        <button
          className="microphone-button"
          type="button"
          aria-label={
            isRequestingPermission
              ? "Requesting microphone access"
              : isRecording
                ? "Stop recording"
                : isReview
                  ? "Recording complete"
                : "Start reading"
          }
          aria-pressed={isRecording}
          disabled={isCountdown || isRequestingPermission || isReview}
          onClick={isRecording ? finishReading : beginReading}
        >
          {isCountdown ? (
            <span className="microphone-button__countdown" key={countdown}>
              {countdown}
            </span>
          ) : isRecording ? (
            <Square className="microphone-button__stop-icon" aria-hidden="true" />
          ) : isReview ? (
            <Check className="microphone-button__complete-icon" aria-hidden="true" />
          ) : (
            <Mic aria-hidden="true" />
          )}
        </button>
        <AudioWaveform className="microphone-prompt__wave" aria-hidden="true" />
      </div>

      <div className="microphone-prompt__status" aria-live="polite">
        {phase === "idle" && !isRequestingPermission && !microphoneError && (
          <p className="microphone-prompt__label">I’m Ready</p>
        )}

        {isRequestingPermission && (
          <p className="microphone-prompt__preparing">
            Allow microphone access…
          </p>
        )}

        {phase === "idle" && microphoneError && (
          <p className="microphone-prompt__message" role="alert">
            {microphoneError}
          </p>
        )}

        {isCountdown && (
          <p className="microphone-prompt__preparing">Get ready to read…</p>
        )}

        {isRecording && (
          <div className="recording-status">
            <span className="recording-status__label">
              <span className="recording-status__dot" aria-hidden="true" />
              Recording
            </span>
            <time dateTime={`PT${elapsedSeconds}S`}>
              {formatElapsedTime(elapsedSeconds)}
            </time>
            <button
              className="recording-status__stop"
              type="button"
              onClick={finishReading}
            >
              Stop recording
            </button>
          </div>
        )}

        {isReview && playbackUrl && (
          <div className="recording-review">
            <p className="recording-review__title">Your Reading</p>
            <div className="recording-review__actions">
              <AudioMiniPlayer
                src={playbackUrl}
                fallbackDurationSeconds={elapsedSeconds}
              />
              <button
                className="recording-review__analyze"
                type="button"
                onClick={analyzeReading}
              >
                Analyze My Reading
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
