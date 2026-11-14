import { useEffect, useRef, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { dark } from '@clerk/themes';
import { Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { usePlayerAccount } from '@/hooks/use-player-account';
import { isAccountConnectionError } from '@/lib/account-query-policy';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Starfield } from '@/components/starfield';
import { FullScreenLoader, Wordmark } from '@/components/shell';
import { ErrorState } from '@/components/ui-kit';
import { RealtimeProvider } from '@/hooks/use-realtime';
import { PrefsProvider } from '@/lib/prefs';
import { errMsg, imgUrl } from '@/lib/game';
import NotFound from '@/pages/not-found';
import Landing from '@/pages/landing';
import CharacterPage from '@/pages/character';
import PlayPage from '@/pages/play';
import FriendsPage from '@/pages/friends';
import ProfilePage from '@/pages/profile';
import SettingsPage from '@/pages/settings';
import SessionPage from '@/pages/session';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: true, staleTime: 2000 } },
});

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: dark,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: 'hsl(186 92% 56%)',
    colorForeground: 'hsl(210 40% 94%)',
    colorMutedForeground: 'hsl(215 22% 68%)',
    colorDanger: 'hsl(356 78% 62%)',
    colorBackground: 'hsl(222 48% 8%)',
    colorInput: 'hsl(224 50% 5%)',
    colorInputForeground: 'hsl(210 40% 94%)',
    colorNeutral: 'hsl(210 40% 94%)',
    fontFamily: "'Manrope', sans-serif",
    borderRadius: '0.375rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[hsl(222_48%_8%)] rounded-xl w-[440px] max-w-full overflow-hidden border border-white/10 shadow-[0_30px_80px_-20px_hsl(186_92%_40%/.25)]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: "text-[hsl(210_40%_96%)] font-['Chakra_Petch'] uppercase tracking-wider text-2xl",
    headerSubtitle: 'text-[hsl(215_22%_70%)]',
    socialButtonsBlockButtonText: 'text-[hsl(210_40%_94%)] font-semibold',
    formFieldLabel: 'text-[hsl(210_40%_88%)]',
    footerActionLink: 'text-[hsl(186_92%_60%)] hover:text-[hsl(186_92%_70%)]',
    footerActionText: 'text-[hsl(215_22%_68%)]',
    dividerText: 'text-[hsl(215_22%_62%)]',
    identityPreviewEditButton: 'text-[hsl(186_92%_60%)]',
    formFieldSuccessText: 'text-[hsl(150_70%_55%)]',
    alertText: 'text-[hsl(210_40%_94%)]',
    logoBox: 'h-12 justify-center',
    logoImage: 'h-12 w-12',
    socialButtonsBlockButton: 'border border-white/10 bg-white/[.03]',
    formButtonPrimary: "bg-[hsl(186_92%_56%)] text-[hsl(224_52%_6%)] font-['Chakra_Petch'] uppercase tracking-[.14em] font-bold",
    formFieldInput: 'bg-[hsl(224_50%_5%)] border-white/15 text-[hsl(210_40%_94%)]',
    footerAction: 'justify-center',
    dividerLine: 'bg-white/10',
    alert: 'border border-[hsl(356_78%_58%/.4)] bg-[hsl(356_78%_58%/.08)]',
    otpCodeFieldInput: 'border-white/20 text-[hsl(210_40%_94%)]',
    formFieldRow: 'gap-3',
    main: 'gap-5',
  },
};

function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="grain relative flex min-h-[100dvh] overflow-hidden bg-background">
      <div className="relative hidden flex-1 lg:block">
        <img src={imgUrl('/images/headquarters.png')} alt="" className="kenburns absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-background/40 to-background" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/60" />
        <div className="absolute bottom-12 left-12 max-w-md">
          <div className="kicker mb-3">Asterion Aerospace / Badge office</div>
          <p className="font-display text-4xl font-bold uppercase leading-tight">Your first spacecraft is waiting for a signature.</p>
        </div>
      </div>
      <div className="relative flex w-full flex-col items-center justify-center px-4 py-10 lg:w-[560px]">
        <Starfield density={0.6} />
        <div className="relative z-10 mb-8 lg:hidden">
          <Wordmark />
        </div>
        <div className="relative z-10 w-full">{children}</div>
      </div>
    </div>
  );
}

function SignInPage() {
  const [location] = useLocation();
  const isEntryScreen = /^\/sign-in\/?$/.test(location);
  return (
    <AuthFrame>
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        withSignUp
        transferable
        appearance={{
          elements: {
            // Keep callback, verification and account-completion forms functional.
            ...(isEntryScreen ? { form: '!hidden', dividerRow: '!hidden' } : {}),
            footerAction: '!hidden',
          },
        }}
      />
    </AuthFrame>
  );
}

function SignUpPage() {
  const [location] = useLocation();
  // A single entry screen; retain Clerk's existing sign-up callback routes.
  if (/^\/sign-up\/?$/.test(location)) {
    return <Redirect to={`/sign-in${window.location.search}`} />;
  }
  return (
    <AuthFrame>
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} appearance={{ elements: { footerAction: '!hidden' } }} />
    </AuthFrame>
  );
}

function SignedInHome() {
  const { data, isLoading, error, refetch } = usePlayerAccount();
  if (isLoading) return <FullScreenLoader />;
  if (error || !data)
    return (
      <div className="relative flex min-h-[100dvh] items-center justify-center bg-background p-6">
        <Starfield />
        <div className="relative w-full max-w-md">
          <ErrorState
            message={isAccountConnectionError(error) ? 'Mission Control is temporarily unreachable. Reconnecting automatically.' : errMsg(error, 'Could not load your profile.')}
            onRetry={() => refetch({ cancelRefetch: false })}
          />
        </div>
      </div>
    );
  return <Redirect to={data.character ? '/play' : '/character'} />;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <SignedInHome />
      </Show>
      <Show when="signed-out">
        <Landing />
      </Show>
    </>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

const TITLES: [RegExp, string][] = [
  [/^\/sign-in/, 'Sign in'],
  [/^\/sign-up/, 'Create account'],
  [/^\/character/, 'Create your engineer'],
  [/^\/play/, 'Mission board'],
  [/^\/friends/, 'Crew roster'],
  [/^\/profile/, 'Career'],
  [/^\/settings/, 'Settings'],
  [/^\/session\//, 'Mission session'],
];

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  useEffect(() => {
    const t = location === '/' ? null : TITLES.find(([r]) => r.test(location))?.[1] ?? 'Not found';
    document.title = t ? `${t} | Mission: Infinity` : 'Mission: Infinity | Lead your first space mission';
  }, [location]);
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: 'Badge check', subtitle: 'Continue with Google or Apple to join or rejoin Asterion Aerospace' } },
        signUp: { start: { title: 'Badge check', subtitle: 'Continue with Google or Apple to join or rejoin Asterion Aerospace' } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <RealtimeProvider>
          <TooltipProvider>
            <RoutedErrorBoundary>
              <Switch>
                <Route path="/" component={HomeRedirect} />
                <Route path="/sign-in/*?" component={SignInPage} />
                <Route path="/sign-up/*?" component={SignUpPage} />
                <Route path="/character" component={CharacterPage} />
                <Route path="/play" component={PlayPage} />
                <Route path="/friends" component={FriendsPage} />
                <Route path="/profile" component={ProfilePage} />
                <Route path="/settings" component={SettingsPage} />
                <Route path="/session/:id" component={SessionPage} />
                <Route component={NotFound} />
              </Switch>
            </RoutedErrorBoundary>
            <Toaster />
          </TooltipProvider>
        </RealtimeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <PrefsProvider>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
    </PrefsProvider>
  );
}

export default App;
