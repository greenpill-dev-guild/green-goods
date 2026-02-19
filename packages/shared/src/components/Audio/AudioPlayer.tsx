import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../utils/styles/cn";

export interface AudioPlayerProps {
  /** Audio source URL (blob URL or IPFS gateway URL) */
  src?: string;
  /** Audio file to play (creates a blob URL internally) */
  file?: File;
  /** Compact mode for inline use in cards */
  compact?: boolean;
  /** Called when the user clicks the delete button */
  onDelete?: () => void;
  className?: string;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Audio player with play/pause, progress bar, and elapsed/total time.
 *
 * Supports both direct `src` URLs and `File` objects.
 * Compact variant is designed for inline use in cards.
 */
export function AudioPlayer({ src, file, compact = false, onDelete, className }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Create blob URL from File
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setBlobUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setBlobUrl(null);
  }, [file]);

  const audioSrc = src || blobUrl;

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {
        // Autoplay blocked — user gesture required
      });
    }
  }, [isPlaying]);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (audio) setCurrentTime(audio.currentTime);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (audio) setDuration(audio.duration);
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const time = Number(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!audioSrc) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-stroke-sub-300 bg-bg-white-0",
        compact ? "px-2 py-1.5" : "px-3 py-2.5",
        className
      )}
    >
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioSrc}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={handleEnded}
        preload="metadata"
      >
        <track kind="captions" />
      </audio>

      {/* Play/Pause button */}
      <button
        type="button"
        onClick={handlePlayPause}
        aria-label={isPlaying ? "Pause" : "Play"}
        className={cn(
          "flex-shrink-0 rounded-full transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base",
          compact ? "h-6 w-6" : "h-8 w-8",
          "flex items-center justify-center",
          "bg-primary-base text-white hover:bg-primary-dark"
        )}
      >
        <i
          className={cn(
            isPlaying ? "ri-pause-fill" : "ri-play-fill",
            compact ? "text-xs" : "text-sm"
          )}
          aria-hidden="true"
        />
      </button>

      {/* Progress bar */}
      <div className="flex-1 flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          aria-label="Audio progress"
          aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
          className="flex-1 h-1 accent-primary-base cursor-pointer"
          style={{
            background: `linear-gradient(to right, var(--color-primary-base, #3b82f6) ${progress}%, var(--color-bg-soft-200, #e5e7eb) ${progress}%)`,
          }}
        />

        {/* Time display */}
        <span
          className={cn(
            "tabular-nums text-text-soft-400 flex-shrink-0",
            compact ? "text-[10px]" : "text-xs"
          )}
        >
          {formatTime(currentTime)}
          {!compact && ` / ${formatTime(duration)}`}
        </span>
      </div>

      {/* Delete button */}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete audio"
          className={cn(
            "flex-shrink-0 rounded-full transition-colors",
            "text-text-soft-400 hover:text-error-base",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error-base",
            compact ? "h-5 w-5" : "h-6 w-6",
            "flex items-center justify-center"
          )}
        >
          <i className={cn("ri-close-line", compact ? "text-xs" : "text-sm")} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
