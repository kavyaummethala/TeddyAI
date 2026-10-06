import type { StoryPhase } from "../../../shared/types";
import type { SessionStatus } from "../hooks/useStorySession";

interface Props {
  status: SessionStatus;
  phase: StoryPhase;
}

/**
 * Teddy's face. It shows what's happening without any words, for children who can't read:
 * ears perk up while listening, eyes look up while thinking, the mouth moves while talking,
 * eyes get heavy during wind down, and close when the story is over.
 */
export function TeddyBear({ status, phase }: Props) {
  const asleep = status === "finished";
  const sleepy = !asleep && (phase === "windDown" || phase === "ending");
  const lookUp = status === "thinking";

  return (
    <svg className="bear" viewBox="0 0 200 200" aria-hidden>
      <defs>
        <radialGradient id="bear-fur" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#d9a06a" />
          <stop offset="100%" stopColor="#a8693a" />
        </radialGradient>
      </defs>

      {/* Ears */}
      <g className="bear__ears">
        <circle cx="48" cy="52" r="28" fill="url(#bear-fur)" />
        <circle cx="152" cy="52" r="28" fill="url(#bear-fur)" />
        <circle cx="48" cy="52" r="15" fill="#e9c296" />
        <circle cx="152" cy="52" r="15" fill="#e9c296" />
      </g>

      {/* Head, cheeks, muzzle */}
      <circle cx="100" cy="108" r="74" fill="url(#bear-fur)" />
      <circle cx="58" cy="128" r="11" fill="#f2a1a1" opacity="0.45" />
      <circle cx="142" cy="128" r="11" fill="#f2a1a1" opacity="0.45" />
      <ellipse cx="100" cy="138" rx="36" ry="28" fill="#f3d7ad" />

      {/* Eyes */}
      {asleep ? (
        <g stroke="#3b2416" strokeWidth="4" strokeLinecap="round" fill="none">
          <path d="M62 100 Q72 108 82 100" />
          <path d="M118 100 Q128 108 138 100" />
        </g>
      ) : (
        <g className={sleepy ? "bear__eyes bear__eyes--sleepy" : "bear__eyes"}>
          <ellipse cx="72" cy={lookUp ? 94 : 99} rx="8" ry={sleepy ? 4 : 9} fill="#2b1a10" />
          <ellipse cx="128" cy={lookUp ? 94 : 99} rx="8" ry={sleepy ? 4 : 9} fill="#2b1a10" />
          {!sleepy && (
            <>
              <circle cx="75" cy={lookUp ? 90 : 95} r="2.6" fill="#fff" />
              <circle cx="131" cy={lookUp ? 90 : 95} r="2.6" fill="#fff" />
            </>
          )}
        </g>
      )}

      {/* Nose and mouth */}
      <ellipse cx="100" cy="125" rx="12" ry="8.5" fill="#3b2416" />
      {status === "speaking" ? (
        <ellipse className="bear__mouth--talking" cx="100" cy="146" rx="9" ry="7" fill="#7a3b2e" />
      ) : (
        <path d="M86 142 Q100 154 114 142" stroke="#3b2416" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      )}

      {/* Little z's when Teddy falls asleep at the end */}
      {asleep && (
        <g className="bear__zzz" fill="#f6e7b0" fontFamily="Fraunces, Georgia, serif" fontWeight="600">
          <text x="150" y="40" fontSize="22">z</text>
          <text x="166" y="22" fontSize="16">z</text>
        </g>
      )}
    </svg>
  );
}
