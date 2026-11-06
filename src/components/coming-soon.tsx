import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-xl">{title}</CardTitle>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{description}</p>
        </CardContent>
      </Card>
    </div>
  );
}
