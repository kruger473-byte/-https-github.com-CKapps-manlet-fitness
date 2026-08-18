"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "./ui";

/**
 * Video player that reports watch progress back to the server.
 *
 * Progress is throttled to one write every 15s of playback (and one on
 * pause/unmount) so a long session doesn't hammer the API. A workout is
 * marked complete at 90% watched — people stop before the outro.
 */
export function VideoPlayer({
  workoutId,
  src,
  poster,
  durationSec,
  initialSeconds,
  initiallyCompleted,
}: {
  workoutId: string;
  src: string;
  poster?: string;
  durationSec: number;
  initialSeconds: number;
  initiallyCompleted: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSaved = useRef(initialSeconds);
  const [completed, setCompleted] = useState(initiallyCompleted);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (initialSeconds > 5 && initialSeconds < durationSec - 5) {
      video.currentTime = initialSeconds;
    }

    const save = async (seconds: number, done: boolean) => {
      lastSaved.current = seconds;
      try {
        const res = await fetch("/api/progress", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ workoutId, secondsWatched: Math.floor(seconds), completed: done }),
          keepalive: true,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setError(null);
      } catch {
        setError("Progress could not be saved — check your connection.");
      }
    };

    const onTimeUpdate = () => {
      const seconds = video.currentTime;
      const total = video.duration || durationSec;
      const reachedEnd = total > 0 && seconds / total >= 0.9;

      if (reachedEnd && !completed) {
        setCompleted(true);
        void save(seconds, true);
        return;
      }
      if (seconds - lastSaved.current >= 15) void save(seconds, false);
    };

    const onPause = () => {
      if (Math.abs(video.currentTime - lastSaved.current) > 1) {
        void save(video.currentTime, completed);
      }
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("pause", onPause);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("pause", onPause);
      if (Math.abs(video.currentTime - lastSaved.current) > 1) {
        void save(video.currentTime, completed);
      }
    };
  }, [workoutId, durationSec, initialSeconds, completed]);

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-ink-700 bg-black">
        {src ? (
          <video
            ref={videoRef}
            src={src}
            poster={poster}
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full"
          />
        ) : (
          <div className="grid aspect-video w-full place-items-center text-sm text-ink-400">
            No video source configured for this session.
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {completed ? <Badge tone="success">Completed</Badge> : null}
        {error ? <Badge tone="danger">{error}</Badge> : null}
      </div>
    </div>
  );
}
