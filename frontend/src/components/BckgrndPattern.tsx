export default function BackgroundPattern() {
  return (
    <svg
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
    >
      {/* hand-drawn dashed grid */}
      <g stroke="rgba(255,255,255,0.025)" strokeWidth="1" fill="none">
        {[80, 160, 240, 320, 400, 480, 560].map((y) => (
          <line key={`h${y}`} x1="0" y1={y} x2="100%" y2={y} strokeDasharray="3,10" />
        ))}
        {[80, 180, 280, 380, 480, 580].map((x) => (
          <line key={`v${x}`} x1={x} y1="0" x2={x} y2="100%" strokeDasharray="3,10" />
        ))}
      </g>

      {/* corner brackets */}
      <g stroke="rgba(34,211,238,0.15)" strokeWidth="1.2" fill="none" strokeLinecap="round">
        <path d="M20,20 L20,10 L10,10" />
        <path d="M calc(100% - 20px),20 L calc(100% - 20px),10 L calc(100% - 10px),10" />
        <path d="M20,calc(100% - 20px) L20,calc(100% - 10px) L10,calc(100% - 10px)" />
        <path d="M calc(100% - 20px),calc(100% - 20px) L calc(100% - 20px),calc(100% - 10px) L calc(100% - 10px),calc(100% - 10px)" />
      </g>

      {/* faint accent curve */}
      <path
        d="M0,70% Q25%,65% 50%,70% Q75%,75% 100%,68%"
        stroke="rgba(34,211,238,0.04)"
        strokeWidth="1.5"
        fill="none"
      />

      {/* scattered dots */}
      {[
        [40, 100], [620, 80], [60, 300], [580, 250],
        [30, 500], [650, 420], [120, 580], [500, 560],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="1.5" fill="rgba(34,211,238,0.08)" />
      ))}
    </svg>
  );
}