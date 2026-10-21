import { SearchX } from 'lucide-react';
import { Card, EmptyState, LinkButton } from '../components/ui';

export default function NotFound({ what = 'Page' }: { what?: string }) {
  return (
    <Card>
      <EmptyState icon={SearchX} title={`${what} not found`}>
        <p className="mb-4">It may have been removed, or the demo data was reset.</p>
        <LinkButton to="/" variant="secondary">Back to dashboard</LinkButton>
      </EmptyState>
    </Card>
  );
}
