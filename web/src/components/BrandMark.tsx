export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="Berachain 助手"
      className="shrink-0"
    >
      <rect width="32" height="32" rx="9" fill="#E8C060" />
      <circle cx="10.2" cy="9.6" r="3.1" fill="#080808" />
      <circle cx="21.8" cy="9.6" r="3.1" fill="#080808" />
      <path
        d="M16 11.4c4.3 0 7.7 3.2 7.7 7.1 0 4-3.4 7.2-7.7 7.2s-7.7-3.2-7.7-7.2c0-3.9 3.4-7.1 7.7-7.1Z"
        fill="#080808"
      />
      <circle cx="13.1" cy="18.2" r="1.05" fill="#E8C060" />
      <circle cx="18.9" cy="18.2" r="1.05" fill="#E8C060" />
      <ellipse cx="16" cy="21.6" rx="2.1" ry="1.35" fill="#E8C060" />
    </svg>
  )
}
