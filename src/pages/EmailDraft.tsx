import { Mail } from 'lucide-react';
import { Card, EmptyState, PageHeader } from '../components/ui';

// Placeholder: the generator is scheduled for Day 3 (see wireframes.html#email for the agreed layout).
export default function EmailDraft() {
  return (
    <>
      <PageHeader title="Email draft generator" subtitle="Pre-filled claim emails for staff to review and send themselves." />
      <Card>
        <EmptyState icon={Mail} title="Coming on Day 3">
          <p>The layout is agreed in the <a className="font-medium text-brand-700 hover:underline" href="./wireframes.html#email" target="_blank" rel="noreferrer">wireframes</a>.</p>
        </EmptyState>
      </Card>
    </>
  );
}
