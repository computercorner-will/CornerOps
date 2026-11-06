import { ComingSoon } from '@/components/coming-soon';

export const metadata = { title: 'Onboarding' };

export default function OnboardingPage() {
  return (
    <ComingSoon
      title="Onboarding / Offboarding"
      description="Guided user onboarding and offboarding checklists for client tenants via Microsoft Graph."
    />
  );
}
