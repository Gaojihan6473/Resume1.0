export function FishMascot({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 88 68" fill="none" aria-hidden="true">
    <path d="M65 34 80 23Q85 20 83 28L80 36 84 46Q86 52 79 49L65 41" fill="#8cb8ff" stroke="#477ee5" strokeWidth="1.5" />
    <path d="M38 14Q45 3 52 15" fill="#bed8ff" stroke="#477ee5" strokeWidth="1.5" />
    <ellipse cx="43" cy="35" rx="27" ry="23" fill="#8ebaff" stroke="#477ee5" strokeWidth="1.5" />
    <path d="M22 25Q27 17 34 17" stroke="#ddecff" strokeWidth="3" strokeLinecap="round" />
    <g className="landing-fish-eyes"><ellipse cx="34" cy="33" rx="2.3" ry="3" fill="#224f9f" /><ellipse cx="49" cy="33" rx="2.3" ry="3" fill="#224f9f" /></g>
    <ellipse cx="28" cy="40" rx="4" ry="2.2" fill="#efb8d0" /><ellipse cx="55" cy="40" rx="4" ry="2.2" fill="#efb8d0" />
    <path d="M37 41Q42 46 47 41" stroke="#285bac" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M59 50Q63 58 69 51" fill="#bed8ff" stroke="#477ee5" strokeWidth="1.5" />
  </svg>
}
