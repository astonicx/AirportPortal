// Local SVG icon module — inline icon components, no external icon library needed.
// All icons accept className and other SVG props.

function SvgIcon({ className = "h-4 w-4", children, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {children}
    </svg>
  );
}

export function Check({ className, ...p }) {
  return <SvgIcon className={className} {...p}><path d="M20 6 9 17l-5-5" /></SvgIcon>;
}

export function X({ className, ...p }) {
  return <SvgIcon className={className} {...p}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></SvgIcon>;
}

export function Circle({ className, ...p }) {
  return <SvgIcon className={className} {...p}><circle cx="12" cy="12" r="10" /></SvgIcon>;
}

export function CheckCircle({ className, ...p }) {
  return <SvgIcon className={className} {...p}><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></SvgIcon>;
}

export function AlertCircle({ className, ...p }) {
  return <SvgIcon className={className} {...p}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></SvgIcon>;
}

export function Info({ className, ...p }) {
  return <SvgIcon className={className} {...p}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></SvgIcon>;
}

export function Menu({ className, ...p }) {
  return <SvgIcon className={className} {...p}><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="18" y2="18" /></SvgIcon>;
}

export function Search({ className, ...p }) {
  return <SvgIcon className={className} {...p}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></SvgIcon>;
}

export function ChevronDown({ className, ...p }) {
  return <SvgIcon className={className} {...p}><path d="m6 9 6 6 6-6" /></SvgIcon>;
}

export function ChevronUp({ className, ...p }) {
  return <SvgIcon className={className} {...p}><path d="m18 15-6-6-6 6" /></SvgIcon>;
}

export function ChevronRight({ className, ...p }) {
  return <SvgIcon className={className} {...p}><path d="m9 18 6-6-6-6" /></SvgIcon>;
}

export function ChevronLeft({ className, ...p }) {
  return <SvgIcon className={className} {...p}><path d="m15 18-6-6 6-6" /></SvgIcon>;
}

export function ArrowRight({ className, ...p }) {
  return <SvgIcon className={className} {...p}><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></SvgIcon>;
}

export function ArrowLeft({ className, ...p }) {
  return <SvgIcon className={className} {...p}><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></SvgIcon>;
}

// Aliases
export const ChevronDownIcon = ChevronDown;
export const ChevronLeftIcon = ChevronLeft;
export const ChevronRightIcon = ChevronRight;
