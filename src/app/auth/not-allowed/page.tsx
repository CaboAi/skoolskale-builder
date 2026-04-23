import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function NotAllowedPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Access not authorized</CardTitle>
          <CardDescription>
            Your email isn&rsquo;t on the Skool Skale team allowlist.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          If you think this is a mistake, contact an admin to be added to the
          allowlist.
        </CardContent>
        <CardFooter>
          <Link
            href="/auth/login"
            className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}
          >
            Try a different email
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}
