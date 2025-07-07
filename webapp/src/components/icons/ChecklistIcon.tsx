import React from 'react';

const ChecklistIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {/* Boxes */}
    <rect x="3" y="4" width="6" height="6" rx="1" />
    <rect x="3" y="14" width="6" height="6" rx="1" />
    <rect x="3" y="24" width="6" height="6" rx="1" />

    {/* Ticks */}
    <polyline points="4.5 7 6.5 9 9 5.5" />
    <polyline points="4.5 17 6.5 19 9 15.5" />

    {/* Cross */}
    <line x1="4.5" y1="26.5" x2="8.5" y2="30.5" />
    <line x1="8.5" y1="26.5" x2="4.5" y2="30.5" />

    {/* Text lines */}
    <line x1="12" y1="7" x2="29" y2="7" />
    <line x1="12" y1="17" x2="29" y2="17" />
    <line x1="12" y1="27" x2="29" y2="27" />
  </svg>
);

export default ChecklistIcon; 