"use client";

// This component prevents the browser's default hover effects
// It's useful for ensuring consistent interaction patterns across the app
export default function NoHoverClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
