/**
 * ApplyOS glyph: three linked nodes rising left-to-right (an application
 * pipeline / career graph) with a small branch node suggesting the
 * contacts/companies network around each stage. Renders in `currentColor`
 * so it drops into the sidebar's gradient badge like any other icon.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M5.5 17L12 11.2M12 11.2L18.5 5M12 11.2L16.5 15"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="5.5" cy="17" r="2.1" fill="currentColor" />
      <circle cx="12" cy="11.2" r="2.4" fill="currentColor" />
      <circle cx="18.5" cy="5" r="2.7" fill="currentColor" />
      <circle cx="16.5" cy="15" r="1.6" fill="currentColor" fillOpacity="0.75" />
    </svg>
  );
}
