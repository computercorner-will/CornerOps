import { ComingSoon } from '@/components/coming-soon';

export const metadata = { title: 'Client Health' };

export default function ClientHealthPage() {
  return (
    <ComingSoon
      title="Client Health"
      description="A per-client health score combining device status, patching, backups and ticket trends."
    />
  );
}
