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

interface MicrophonePromptProps {
  referenceText: string;
  passageRevision?: number;
}

export function MicrophonePrompt({
  referenceText,
  passageRevision,
}: MicrophonePromptProps) {
  const navigate = useNavigate();
  const { speechAnalysis } = useApplicationServices();
  const characteristicsPromiseRef = useRef<
    ReturnType<typeof extractRecordingCharacteristics> | null
  >(null);
  const preparedSessionIdRef = useRef<string | null>(null);
  const preparedAudioRef = useRef<Blob | null>(null);
  const preparedPassageKeyRef = useRef<string | null>(null);
  const isNavigatingRef = useRef(false);
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
    speechAnalysis.cancelPreparedAnalysis();
    preparedSessionIdRef.current = null;
    isNavigatingRef.current = false;
    const microphoneIsReady = await requestMicrophone();

    if (microphoneIsReady) {
      startCountdown();
    }
  }, [requestMicrophone, speechAnalysis, startCountdown]);

  const resetReadingSession = useCallback(() => {
    speechAnalysis.cancelPreparedAnalysis();
    preparedSessionIdRef.current = null;
    resetSession();
  }, [resetSession, speechAnalysis]);

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

  useEffect(
    () => () => {
      if (!isNavigatingRef.current) {
        speechAnalysis.cancelPreparedAnalysis();
      }
    },
    [speechAnalysis],
  );

  useEffect(() => {
    if (phase === "recording" && recordedAudio) {
      completeRecording();
    }
  }, [completeRecording, phase, recordedAudio]);

  useEffect(() => {
    if (!recordedAudio) {
      characteristicsPromiseRef.current = null;
      preparedSessionIdRef.current = null;
      preparedAudioRef.current = null;
      preparedPassageKeyRef.current = null;
      return;
    }

    const passageKey = `${passageRevision ?? ""}:${referenceText}`;
    if (
      preparedAudioRef.current === recordedAudio.blob &&
      preparedPassageKeyRef.current === passageKey
    ) {
      return;
    }
    speechAnalysis.cancelPreparedAnalysis(preparedSessionIdRef.current ?? undefined);
    preparedAudioRef.current = recordedAudio.blob;
    preparedPassageKeyRef.current = passageKey;

    const characteristics = extractRecordingCharacteristics(
      recordedAudio.blob,
      elapsedSeconds,
    );
    characteristicsPromiseRef.current = characteristics;
    void characteristics.then((recording) => {
      const prepared = speechAnalysis.prepareAnalysis({
        recording,
        audio: recordedAudio.blob,
        referenceText,
        passageRevision,
      });
      preparedSessionIdRef.current = prepared.sessionId;
    });
  }, [
    elapsedSeconds,
    passageRevision,
    recordedAudio,
    referenceText,
    speechAnalysis,
  ]);

  const analyzeReading = useCallback(() => {
    if (isNavigatingRef.current || !recordedAudio) {
      return;
    }

    isNavigatingRef.current = true;
    prepareCelebrationAudio();

    navigate(APP_ROUTES.reflection, {
      state: { analysisSessionId: preparedSessionIdRef.current },
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
