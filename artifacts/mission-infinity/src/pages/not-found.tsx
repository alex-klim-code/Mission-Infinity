import { Link } from 'wouter';
import { Starfield } from '@/components/starfield';

export default function NotFound() {
  return (
    <div className="grain relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background px-6 text-center">
      <Starfield />
      <div className="relative">
        <div className="kicker mb-4">Error 404 / Off nominal trajectory</div>
        <h1 className="font-display text-7xl font-bold uppercase md:text-9xl">Lost<span className="text-burn">.</span></h1>
        <p className="mx-auto mt-4 max-w-sm text-muted-foreground">This coordinate is empty space. Let's get you back into a known orbit.</p>
        <Link href="/" className="mt-8 inline-flex min-h-11 items-center rounded-md bg-ion px-6 font-display text-sm font-bold uppercase tracking-[.14em] text-void" data-testid="link-404-home">
          Return to base
        </Link>
      </div>
    </div>
  );
}
