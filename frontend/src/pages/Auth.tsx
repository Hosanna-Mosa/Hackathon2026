import { useEffect, useMemo, useState } from "react";
import { Camera } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

type AuthMode = "login" | "signup";

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, signup, isAuthenticated, isAuthReady } = useAuth();

  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const redirectPath = useMemo(() => {
    const state = location.state as { from?: { pathname?: string } } | null;
    const fromPath = state?.from?.pathname;
    return typeof fromPath === "string" && fromPath.trim() ? fromPath : "/";
  }, [location.state]);

  useEffect(() => {
    if (isAuthReady && isAuthenticated) {
      navigate(redirectPath, { replace: true });
    }
  }, [isAuthReady, isAuthenticated, navigate, redirectPath]);

  const resetForm = () => {
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError("");
  };

  const onSwitchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError("");
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedEmail = email.trim();
    const trimmedName = name.trim();
    const safePassword = password;

    if (!trimmedEmail || !safePassword) {
      setError("Email and password are required.");
      return;
    }

    if (mode === "signup") {
      if (!trimmedName) {
        setError("Name is required for signup.");
        return;
      }
      if (safePassword !== confirmPassword) {
        setError("Password and confirm password must match.");
        return;
      }
    }

    try {
      setError("");
      setIsSubmitting(true);
      if (mode === "signup") {
        await signup({ name: trimmedName, email: trimmedEmail, password: safePassword });
      } else {
        await login({ email: trimmedEmail, password: safePassword });
      }
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/30 to-card px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg sm:p-7">
        <Link to="/" className="mb-5 inline-flex items-center gap-2 text-foreground">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Camera className="h-5 w-5 text-primary-foreground" />
          </span>
          <span className="text-lg font-semibold">Drishyamitra</span>
        </Link>

        <h1 className="text-2xl font-bold text-foreground">
          {mode === "signup" ? "Create account" : "Welcome back"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signup"
            ? "Sign up to create your own private memory workspace."
            : "Login to access your own photos, people, faces, and deliveries."}
        </p>

        <div className="mt-5 grid grid-cols-2 rounded-lg border border-border bg-background p-1">
          <button
            type="button"
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              mode === "login" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent"
            }`}
            onClick={() => onSwitchMode("login")}
          >
            Login
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              mode === "signup" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent"
            }`}
            onClick={() => onSwitchMode("signup")}
          >
            Sign up
          </button>
        </div>

        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          {mode === "signup" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                placeholder="Your name"
                disabled={isSubmitting}
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              placeholder="you@example.com"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              placeholder="Enter password"
              disabled={isSubmitting}
            />
          </div>

          {mode === "signup" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                placeholder="Re-enter password"
                disabled={isSubmitting}
              />
            </div>
          )}

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Please wait..." : mode === "signup" ? "Create Account" : "Login"}
          </button>
        </form>

        <p className="mt-4 text-xs text-muted-foreground">
          {mode === "signup" ? (
            <>
              Already have an account?{" "}
              <button
                type="button"
                className="font-semibold text-primary"
                onClick={() => {
                  onSwitchMode("login");
                  resetForm();
                }}
              >
                Login
              </button>
            </>
          ) : (
            <>
              New user?{" "}
              <button
                type="button"
                className="font-semibold text-primary"
                onClick={() => {
                  onSwitchMode("signup");
                  resetForm();
                }}
              >
                Create account
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
};

export default Auth;
