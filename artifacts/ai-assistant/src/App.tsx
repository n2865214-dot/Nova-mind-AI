import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, Redirect } from "wouter";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Menu, Plus, MessageSquare, Image as ImageIcon, FileText, Youtube, Code, Music, X, LogOut, User } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import NotFound from "@/pages/not-found";
import ChatPage from "./pages/chat";
import ImageGeneratorPage from "./pages/image-generator";
import TextHumanizerPage from "./pages/text-humanizer";
import YoutubeTranscriptPage from "./pages/youtube-transcript";
import CodeAssistantPage from "./pages/code-assistant";
import SongGeneratorPage from "./pages/song-generator";
import LandingPage from "./pages/landing";

const queryClient = new QueryClient();

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(260, 90%, 65%)",
    colorForeground: "hsl(0, 0%, 98%)",
    colorMutedForeground: "hsl(240, 5%, 60%)",
    colorDanger: "hsl(0, 72%, 51%)",
    colorBackground: "hsl(240, 10%, 6%)",
    colorInput: "hsl(240, 10%, 16%)",
    colorInputForeground: "hsl(0, 0%, 98%)",
    colorNeutral: "hsl(240, 10%, 30%)",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[hsl(240,10%,8%)] border border-[hsl(240,10%,14%)] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[hsl(0,0%,98%)] font-bold",
    headerSubtitle: "text-[hsl(240,5%,60%)]",
    socialButtonsBlockButtonText: "text-[hsl(0,0%,98%)]",
    formFieldLabel: "text-[hsl(0,0%,85%)]",
    footerActionLink: "text-[hsl(260,90%,72%)] hover:text-[hsl(260,90%,80%)]",
    footerActionText: "text-[hsl(240,5%,60%)]",
    dividerText: "text-[hsl(240,5%,55%)]",
    identityPreviewEditButton: "text-[hsl(260,90%,72%)]",
    formFieldSuccessText: "text-green-400",
    alertText: "text-[hsl(0,0%,90%)]",
    logoBox: "flex justify-center mb-2",
    logoImage: "w-12 h-12 rounded-xl",
    socialButtonsBlockButton: "border-[hsl(240,10%,20%)] bg-[hsl(240,10%,10%)] hover:bg-[hsl(240,10%,14%)] text-[hsl(0,0%,98%)]",
    formButtonPrimary: "bg-[hsl(260,90%,65%)] hover:bg-[hsl(260,90%,60%)] text-white",
    formFieldInput: "bg-[hsl(240,10%,16%)] border-[hsl(240,10%,22%)] text-[hsl(0,0%,98%)] focus:border-[hsl(260,90%,65%)]",
    footerAction: "bg-transparent",
    dividerLine: "bg-[hsl(240,10%,18%)]",
    alert: "bg-[hsl(0,30%,15%)] border-[hsl(0,40%,25%)]",
    otpCodeFieldInput: "bg-[hsl(240,10%,16%)] border-[hsl(240,10%,22%)] text-[hsl(0,0%,98%)]",
    formFieldRow: "gap-3",
    main: "gap-4",
  },
};

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

function UserMenuButton() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="flex items-center gap-2 w-full justify-start px-3 py-2">
          {user?.imageUrl ? (
            <img src={user.imageUrl} className="w-7 h-7 rounded-full object-cover" alt={user.fullName ?? "User"} />
          ) : (
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
          )}
          <span className="text-sm truncate max-w-[120px]">{user?.firstName ?? user?.emailAddresses[0]?.emailAddress ?? "Account"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-3 py-2 text-xs text-muted-foreground truncate">
          {user?.emailAddresses[0]?.emailAddress}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut(() => setLocation("/"))}
          className="text-destructive focus:text-destructive cursor-pointer"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navItems = [
    { href: "/chat", label: "Chat", icon: MessageSquare },
    { href: "/image-generator", label: "Image Generator", icon: ImageIcon },
    { href: "/text-humanizer", label: "Text Humanizer", icon: FileText },
    { href: "/youtube-transcript", label: "YouTube Transcript", icon: Youtube },
    { href: "/code-assistant", label: "Code Assistant", icon: Code },
    { href: "/song-generator", label: "Song Generator", icon: Music },
  ];

  const SidebarNav = ({ onClick }: { onClick?: () => void }) => (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClick}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              location === item.href
                ? "bg-primary/10 text-primary font-medium"
                : "hover:bg-accent text-muted-foreground hover:text-foreground"
            }`}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
      <div className="p-3 border-t border-border">
        <UserMenuButton />
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden text-foreground">
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-sidebar shrink-0">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} className="w-7 h-7 rounded-lg" alt="NovaMind AI" />
          <span className="font-bold text-base tracking-tight bg-gradient-to-r from-primary to-pink-500 bg-clip-text text-transparent">
            NovaMind AI
          </span>
        </div>
        <SidebarNav />
      </aside>

      <main className="flex-1 flex flex-col min-w-0 relative">
        <div className="md:hidden p-4 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10">
          <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 flex flex-col">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src={`${import.meta.env.BASE_URL}logo.svg`} className="w-6 h-6 rounded-md" alt="NovaMind AI" />
                  <span className="font-bold">NovaMind AI</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex-1">
                <SidebarNav onClick={() => setIsSidebarOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
          <span className="font-bold text-lg bg-gradient-to-r from-primary to-pink-500 bg-clip-text text-transparent">
            NovaMind AI
          </span>
          <div className="w-9" />
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <AppLayout>
          <Component />
        </AppLayout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/chat" />
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function AppRoutes() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <ClerkProvider
      publishableKey={clerkPubKey ?? ""}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to your NovaMind AI account",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Start creating with NovaMind AI",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route path="/chat" component={() => <ProtectedRoute component={ChatPage} />} />
            <Route path="/image-generator" component={() => <ProtectedRoute component={ImageGeneratorPage} />} />
            <Route path="/text-humanizer" component={() => <ProtectedRoute component={TextHumanizerPage} />} />
            <Route path="/youtube-transcript" component={() => <ProtectedRoute component={YoutubeTranscriptPage} />} />
            <Route path="/code-assistant" component={() => <ProtectedRoute component={CodeAssistantPage} />} />
            <Route path="/song-generator" component={() => <ProtectedRoute component={SongGeneratorPage} />} />
            <Route component={NotFound} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <AppRoutes />
    </WouterRouter>
  );
}

export default App;
