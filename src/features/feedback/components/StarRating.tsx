import { useId } from "react";

type StarFill = "full" | "half" | "empty";

interface StarIconProps {
  fill: StarFill;
  gradientId: string;
}

function StarIcon({ fill, gradientId }: StarIconProps) {
  const fillValue =
    fill === "full"
      ? "#ef4d86"
      : fill === "half"
        ? `url(#${gradientId})`
        : "#f3e5e1";

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {fill === "half" && (
        <defs>
          <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#ef4d86" />
            <stop offset="50%" stopColor="#ef4d86" />
            <stop offset="50%" stopColor="#f3e5e1" />
            <stop offset="100%" stopColor="#f3e5e1" />
          </linearGradient>
        </defs>
      )}
      <path
        d="M12 2.35 14.98 8.4l6.68.97-4.83 4.71 1.14 6.65L12 17.59l-5.97 3.14 1.14-6.65-4.83-4.71 6.68-.97L12 2.35Z"
        fill={fillValue}
        stroke={fill === "empty" ? "#e7cbc4" : "#ef4d86"}
        strokeLinejoin="round"
        strokeWidth="0.85"
      />
    </svg>
  );
}

interface StarRatingProps {
  rating: number;
  label: string;
}

export function StarRating({ rating, label }: StarRatingProps) {
  const id = useId().replaceAll(":", "");

  return (
    <div className="star-rating" aria-label={`${label}: very strong`}>
      {Array.from({ length: 5 }, (_, index) => {
        const remaining = rating - index;
        const fill: StarFill =
          remaining >= 1 ? "full" : remaining >= 0.5 ? "half" : "empty";

        return (
          <StarIcon
            fill={fill}
            gradientId={`${id}-star-${index}`}
            key={index}
          />
        );
      })}
    </div>
  );
}
