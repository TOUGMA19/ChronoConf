import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { signIn, signUp, signInWithGoogle } from "@/lib/auth";
import { Loader2 } from "lucide-react";

interface Props {
  onAuth: () => void;
}

/** Programme logo — stylized calendar/agenda mark matching the app's orange gradient. */
const ProgrammeLogo = ({ className = "h-10 w-10" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="pg-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#f97316" />
        <stop offset="100%" stopColor="#ea580c" />
      </linearGradient>
    </defs>
    <rect x="4" y="8" width="40" height="36" rx="8" fill="url(#pg-grad)" />
    <rect x="4" y="8" width="40" height="10" rx="8" fill="#c2410c" opacity="0.35" />
    <rect x="12" y="4" width="4" height="10" rx="2" fill="#7c2d12" />
    <rect x="32" y="4" width="4" height="10" rx="2" fill="#7c2d12" />
    <rect x="11" y="23" width="10" height="3" rx="1.5" fill="white" opacity="0.95" />
    <rect x="11" y="30" width="18" height="3" rx="1.5" fill="white" opacity="0.85" />
    <rect x="11" y="37" width="14" height="3" rx="1.5" fill="white" opacity="0.7" />
    <circle cx="35" cy="32" r="5" fill="white" opacity="0.95" />
    <path d="M35 29.5v3l2 1.2" stroke="#ea580c" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const GoogleIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.2C41.4 35.5 44 30.1 44 24c0-1.3-.1-2.4-.4-3.5z"/>
  </svg>
);

const AuthPage = ({ onAuth }: Props) => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await signIn(email, password);
        if (error) throw error;
        toast.success("Connexion réussie");
        onAuth();
      } else {
        const { error } = await signUp(email, password);
        if (error) throw error;
        toast.success("Compte créé ! Vérifiez votre e-mail pour confirmer.");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) throw error;
      // Redirection Google en cours…
    } catch (err) {
      toast.error((err as Error).message);
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3">
            <ProgrammeLogo className="h-10 w-10" />
            <h1 className="text-2xl font-display font-bold">
              <span className="text-accent">Chrono</span>Conf
            </h1>
          </div>
          <CardTitle className="font-display">
            {mode === "login" ? "Connexion" : "Créer un compte"}
          </CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Accédez à vos projets de conférence depuis n'importe quel appareil."
              : "Créez votre compte organisateur pour gérer vos conférences."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogle}
            disabled={googleLoading || loading}
            className="w-full"
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <GoogleIcon className="h-4 w-4 mr-2" />
            )}
            {mode === "login" ? "Continuer avec Google" : "S'inscrire avec Google"}
          </Button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">ou par e-mail</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="organisateur@conf.org"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
              />
            </div>
            <Button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full gradient-accent text-accent-foreground"
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {mode === "login" ? "Se connecter" : "Créer le compte"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
            >
              {mode === "login"
                ? "Pas encore de compte ? S'inscrire"
                : "Déjà un compte ? Se connecter"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPage;
