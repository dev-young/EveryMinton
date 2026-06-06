import type { SVGProps } from "react";

type BadmintonIconProps = SVGProps<SVGSVGElement> & {
  size?: number;
  strokeWidth?: number;
};

export function BadmintonIcon({
  size = 24,
  strokeWidth = 2,
  className,
  ...props
}: BadmintonIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      {...props}
    >
      <path d="M5 4h10l4 10-5 5L5 4Z" />
      <path d="M8 4l7.5 12.5" />
      <path d="M11 4l5.5 10.5" />
      <path d="M14 4l3.5 8.5" />
      <path d="M14 19l5-5" />
      <path d="M16.5 21.5l4-4" />
    </svg>
  );
}
