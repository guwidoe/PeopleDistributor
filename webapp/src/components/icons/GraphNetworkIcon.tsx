import React from 'react';

const GraphNetworkIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {/* Edges connecting center to outer nodes */}
    <line x1="16" y1="8" x2="16" y2="16" />
    <line x1="16" y1="16" x2="8" y2="16" />
    <line x1="16" y1="16" x2="24" y2="16" />
    <line x1="16" y1="16" x2="16" y2="24" />

    {/* Diagonal edges for extra complexity */}
    <line x1="8" y1="16" x2="16" y2="8" />
    <line x1="24" y1="16" x2="16" y2="24" />
    <line x1="16" y1="8" x2="24" y2="16" />
    <line x1="16" y1="24" x2="8" y2="16" />

    {/* Nodes */}
    <circle cx="16" cy="16" r="2.5" />
    <circle cx="16" cy="8" r="2.5" />
    <circle cx="8" cy="16" r="2.5" />
    <circle cx="24" cy="16" r="2.5" />
    <circle cx="16" cy="24" r="2.5" />
  </svg>
);

export default GraphNetworkIcon; 