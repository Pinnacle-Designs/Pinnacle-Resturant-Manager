/** @deprecated Use @/components/layout/PageSections — kept for analytics imports */
import { PageSectionShell, PageSection } from "@/components/layout/PageSections";

export function AnalyticsTabShell({
  tabId,
  pageId,
  children,
  defaultExpanded,
}: {
  tabId?: string;
  pageId?: string;
  children: React.ReactNode;
  defaultExpanded?: "all" | "first" | "none" | string[];
}) {
  const id = pageId ?? tabId ?? "page";
  return (
    <PageSectionShell pageId={id} defaultExpanded={defaultExpanded}>
      {children}
    </PageSectionShell>
  );
}

export function AnalyticsBlock({
  id,
  title,
  description,
  children,
  defaultOpen,
  className,
  headerActions,
  variant = "default",
}: {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  headerActions?: React.ReactNode;
  variant?: "default" | "card" | "plain";
}) {
  return (
    <PageSection
      id={id}
      title={title}
      description={description}
      defaultOpen={defaultOpen}
      className={className}
      headerActions={headerActions}
      variant={variant}
    >
      {children}
    </PageSection>
  );
}
