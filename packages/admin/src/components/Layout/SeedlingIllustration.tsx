/** Inline SVG illustration — seedling sprouting from soil with entrance animation */
export function SeedlingIllustration({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Ground */}
      <ellipse cx="60" cy="85" rx="50" ry="8" className="fill-success-lighter" />
      <ellipse cx="60" cy="85" rx="35" ry="5" className="fill-success-light/40" />
      {/* Stem */}
      <path
        d="M60 82 C60 65 58 55 60 42"
        className="stroke-success-base"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      >
        <animate
          attributeName="d"
          from="M60 82 C60 80 60 78 60 76"
          to="M60 82 C60 65 58 55 60 42"
          dur="0.8s"
          fill="freeze"
        />
      </path>
      {/* Left leaf */}
      <path d="M60 58 C52 48 38 44 32 50 C38 52 48 54 60 58Z" className="fill-success-base/80">
        <animate attributeName="opacity" from="0" to="1" dur="0.4s" begin="0.4s" fill="freeze" />
      </path>
      {/* Right leaf */}
      <path d="M60 48 C68 38 82 34 88 40 C82 42 72 44 60 48Z" className="fill-success-base/60">
        <animate attributeName="opacity" from="0" to="1" dur="0.4s" begin="0.6s" fill="freeze" />
      </path>
      {/* Top bud */}
      <circle cx="60" cy="38" r="4" className="fill-success-base">
        <animate attributeName="r" from="0" to="4" dur="0.3s" begin="0.7s" fill="freeze" />
      </circle>
    </svg>
  );
}
