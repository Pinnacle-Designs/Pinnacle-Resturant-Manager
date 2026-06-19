"use client";

import {
  CollapsibleSection,
  CollapsibleGroup,
  CollapsibleGroupControls,
} from "@/components/ui";

/** Groups collapsible sections on a page — expand/collapse all. */
export function PageSectionShell({
  pageId,
  defaultExpanded = "first",
  children,
}: {
  pageId: string;
  defaultExpanded?: "all" | "first" | "none" | string[];
  children: React.ReactNode;
}) {
  return (
    <CollapsibleGroup defaultExpanded={defaultExpanded} expandKey={pageId}>
      <CollapsibleGroupControls className="mb-4" />
      <div className="space-y-4">{children}</div>
    </CollapsibleGroup>
  );
}

export function PageSection({
  id,
  title,
  description,
  children,
  defaultOpen,
  className,
  headerActions,
  badge,
  variant = "default",
}: {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  headerActions?: React.ReactNode;
  badge?: React.ReactNode;
  variant?: "default" | "card" | "plain";
}) {
  return (
    <CollapsibleSection
      id={id}
      title={title}
      description={description}
      defaultOpen={defaultOpen}
      className={className}
      headerActions={headerActions}
      badge={badge}
      variant={variant}
      bodyClassName="!pt-2"
    >
      {children}
    </CollapsibleSection>
  );
}
