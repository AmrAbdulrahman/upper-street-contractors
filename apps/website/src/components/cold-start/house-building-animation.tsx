"use client";

type HouseBuildingAnimationProps = {
  elapsedMs?: number;
};

export function HouseBuildingAnimation({
  elapsedMs = 0,
}: HouseBuildingAnimationProps) {
  const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1000));

  return (
    <div className="flex flex-col items-center gap-8 px-6 text-center">
      <div className="cold-start-scene" aria-hidden="true">
        <svg
          viewBox="0 0 200 160"
          className="h-40 w-52 max-w-full"
          role="img"
          aria-label="House being built"
        >
          <title>House being built</title>

          {/* Ground */}
          <rect
            x="20"
            y="130"
            width="160"
            height="4"
            rx="2"
            className="cold-start-ground"
          />

          {/* Foundation */}
          <rect
            x="50"
            y="115"
            width="100"
            height="15"
            rx="2"
            className="cold-start-foundation"
          />

          {/* Left wall */}
          <rect
            x="55"
            y="75"
            width="40"
            height="40"
            className="cold-start-wall-left"
          />

          {/* Right wall */}
          <rect
            x="105"
            y="75"
            width="40"
            height="40"
            className="cold-start-wall-right"
          />

          {/* Door */}
          <rect
            x="88"
            y="95"
            width="24"
            height="20"
            rx="2"
            className="cold-start-door"
          />

          {/* Window */}
          <rect
            x="62"
            y="85"
            width="18"
            height="18"
            rx="2"
            className="cold-start-window"
          />

          {/* Roof */}
          <polygon
            points="100,35 45,78 155,78"
            className="cold-start-roof"
          />

          {/* Chimney */}
          <rect
            x="118"
            y="48"
            width="12"
            height="22"
            className="cold-start-chimney"
          />

          {/* Crane arm */}
          <g className="cold-start-crane">
            <line x1="165" y1="130" x2="165" y2="50" />
            <line x1="165" y1="50" x2="130" y2="50" />
            <line x1="130" y1="50" x2="130" y2="65" />
          </g>
        </svg>
      </div>

      <div className="flex max-w-sm flex-col gap-2">
        <p className="text-[11px] font-bold tracking-[0.12em] text-gold uppercase">
          Upper Street Contractors
        </p>
        <h1 className="font-serif text-[clamp(22px,4vw,28px)] leading-tight text-dark">
          Building your experience…
        </h1>
        <p className="text-sm text-muted">
          Waking up our content server
          {elapsedSeconds > 0 ? ` · ${elapsedSeconds}s` : ""}
        </p>
      </div>
    </div>
  );
}
