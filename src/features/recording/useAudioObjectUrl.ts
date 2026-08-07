import { useEffect, useState } from "react";

/** Creates and safely revokes a temporary playback URL for an in-memory Blob. */
export function useAudioObjectUrl(audio: Blob | null): string | null {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!audio) {
      setObjectUrl(null);
      return;
    }

    const nextObjectUrl = URL.createObjectURL(audio);
    setObjectUrl(nextObjectUrl);

    return () => URL.revokeObjectURL(nextObjectUrl);
  }, [audio]);

  return objectUrl;
}
