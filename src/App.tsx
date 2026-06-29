import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import Conference from "./pages/Conference";
import Verify from "./pages/Verify";
import NotFound from "./pages/NotFound";
import AuthPage from "./pages/AuthPage";
import ProjectsPage from "./pages/ProjectsPage";

const queryClient = new QueryClient();

// Inner app — handles auth state
const AppRoutes = () => {
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = loading
  const [activeProject, setActiveProject] = useState<{ slug: string; name: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUser(session?.user ?? null);
      if (!session) setActiveProject(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Still loading auth state
  if (user === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground font-display text-lg">ChronoConf…</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public verify page — accessible without auth */}
        <Route path="/verify" element={<Verify />} />

        {/* Main app — requires auth */}
        <Route
          path="/*"
          element={
            !user ? (
              <AuthPage onAuth={() => {}} />
            ) : !activeProject ? (
              <ProjectsPage
                userEmail={user.email ?? ""}
                onSelectProject={(slug, name) => setActiveProject({ slug, name })}
                onSignOut={() => setActiveProject(null)}
              />
            ) : (
              <Conference
                projectSlug={activeProject.slug}
                projectName={activeProject.name}
                userId={user.id}
                userEmail={user.email ?? ""}
                onBack={() => setActiveProject(null)}
              />
            )
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppRoutes />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
