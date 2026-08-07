import { useCallback, useEffect, useRef, useState } from "react";

import type { MicrophoneStatus, RecordedAudio } from "./types";

const AUDIO_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
];

function getPreferredMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") {
    return undefined;
  }

  return AUDIO_MIME_TYPES.find((mimeType) =>
    MediaRecorder.isTypeSupported(mimeType),
  );
}

function getMicrophoneErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Microphone access was blocked. Please allow access and try again.";
    }

    if (error.name === "NotFoundError") {
      return "No microphone was found. Please connect one and try again.";
    }

    if (error.name === "NotReadableError") {
      return "The microphone is being used by another application.";
    }
  }

  return "The microphone could not be started. Please try again.";
}

/**
 * Owns browser microphone permission and MediaRecorder lifecycle.
 * Completed audio remains as a Blob in React memory until the next recording
 * or until this hook is unmounted.
 */
export function useMediaRecorder() {
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [status, setStatus] = useState<MicrophoneStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [recordedAudio, setRecordedAudio] = useState<RecordedAudio | null>(null);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const requestMicrophone = useCallback(async (): Promise<boolean> => {
    setError(null);

    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setStatus("error");
      setError("This browser does not support microphone recording.");
      return false;
    }

    const currentStream = streamRef.current;
    if (currentStream?.getAudioTracks().some((track) => track.readyState === "live")) {
      setStatus("ready");
      return true;
    }

    setStatus("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
        video: false,
      });

      streamRef.current = stream;
      setRecordedAudio(null);
      setStatus("ready");
      return true;
    } catch (requestError) {
      releaseStream();
      setStatus("error");
      setError(getMicrophoneErrorMessage(requestError));
      return false;
    }
  }, [releaseStream]);

  const startRecording = useCallback((): boolean => {
    const stream = streamRef.current;

    if (!stream || typeof MediaRecorder === "undefined") {
      setStatus("error");
      setError("Microphone access is required before recording can begin.");
      return false;
    }

    try {
      const mimeType = getPreferredMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );

      chunksRef.current = [];
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        releaseStream();
        setStatus("error");
        setError("Recording was interrupted. Please try again.");
      };

      recorder.onstop = () => {
        const resolvedMimeType =
          recorder.mimeType || chunksRef.current[0]?.type || "audio/webm";

        setRecordedAudio({
          blob: new Blob(chunksRef.current, { type: resolvedMimeType }),
          mimeType: resolvedMimeType,
        });
        recorderRef.current = null;
        releaseStream();
        setStatus("idle");
      };

      recorder.start(250);
      setStatus("recording");
      return true;
    } catch (recordingError) {
      releaseStream();
      setStatus("error");
      setError(getMicrophoneErrorMessage(recordingError));
      return false;
    }
  }, [releaseStream]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;

    if (recorder?.state === "recording") {
      recorder.stop();
      return;
    }

    releaseStream();
    setStatus("idle");
  }, [releaseStream]);

  useEffect(
    () => () => {
      const recorder = recorderRef.current;
      recorderRef.current = null;

      if (recorder?.state === "recording") {
        recorder.ondataavailable = null;
        recorder.onerror = null;
        recorder.onstop = null;
        recorder.stop();
      }

      releaseStream();
    },
    [releaseStream],
  );

  return {
    status,
    error,
    recordedAudio,
    requestMicrophone,
    startRecording,
    stopRecording,
  };
}
