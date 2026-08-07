import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";

import { formatElapsedTime } from "../../reading-session";

const WAVEFORM_HEIGHTS = [
  8, 14, 20, 12, 24, 17, 10, 21, 27, 15, 9, 19, 24, 13, 7, 17, 25, 20,
  11, 23, 16, 8, 18, 26, 14, 21, 11, 7,
];

interface AudioMiniPlayerProps {
  src: string;
  fallbackDurationSeconds?: number;
}

export function AudioMiniPlayer({
  src,
  fallbackDurationSeconds = 0,
}: AudioMiniPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(0);
  const duration = mediaDuration || fallbackDurationSeconds;
  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

  useEffect(() => {
    const audio = audioRef.current;
    audio?.pause();
    audio?.load();
    setIsPlaying(false);
    setCurrentTime(0);
    setMediaDuration(0);
  }, [src]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (!audio.paused) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    if (duration > 0 && audio.currentTime >= duration) {
      audio.currentTime = 0;
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  };

  const updateDuration = () => {
    const nextDuration = audioRef.current?.duration ?? 0;
    setMediaDuration(Number.isFinite(nextDuration) ? nextDuration : 0);
  };

  const seek = (event: ChangeEvent<HTMLInputElement>) => {
    const nextTime = Number(event.target.value);
    const audio = audioRef.current;

    if (audio) {
      audio.currentTime = nextTime;
    }
    setCurrentTime(nextTime);
  };

  return (
    <div className="audio-mini-player">
      <audio
        ref={audioRef}
        preload="metadata"
        src={src}
        onDurationChange={updateDuration}
        onLoadedMetadata={updateDuration}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onEnded={() => setIsPlaying(false)}
      />

      <button
        className="audio-mini-player__toggle"
        type="button"
        aria-label={isPlaying ? "Pause your reading" : "Play your reading"}
        onClick={togglePlayback}
      >
        {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
      </button>

      <div className="audio-mini-player__waveform">
        <div className="audio-mini-player__bars" aria-hidden="true">
          {WAVEFORM_HEIGHTS.map((height, index) => (
            <span
              className={
                (index + 1) / WAVEFORM_HEIGHTS.length <= progress
                  ? "audio-mini-player__bar audio-mini-player__bar--played"
                  : "audio-mini-player__bar"
              }
              key={`${height}-${index}`}
              style={{ height }}
            />
          ))}
        </div>
        <input
          type="range"
          aria-label="Seek your recorded reading"
          min="0"
          max={duration || 0}
          step="0.05"
          value={Math.min(currentTime, duration || 0)}
          disabled={duration === 0}
          onChange={seek}
        />
      </div>

      <time className="audio-mini-player__duration">
        {formatElapsedTime(Math.floor(currentTime))}
        <span aria-hidden="true"> / </span>
        {formatElapsedTime(Math.ceil(duration))}
      </time>
    </div>
  );
}
