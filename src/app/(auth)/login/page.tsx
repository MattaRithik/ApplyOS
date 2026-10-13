"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, Mail, Lock, User, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { GlassPanel } from "@/components/shared/glass-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { safeLocalPath } from "@/lib/utils/url";
import { POLICY_VERSION } from "@/lib/legal/policies";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeLocalPath(searchParams?.get("next") ?? null, "/dashboard");

  const [loading, setLoading] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [termsAccepted, setTermsAccepted] = React.useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back.");
    router.push(next);
    router.refresh();
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      toast.error("Accept the Terms of Service and confirm you are at least 18 to continue.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          terms_version: POLICY_VERSION,
          terms_accepted_at: new Date().toISOString(),
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.session) {
      toast.success("Account created — welcome to ApplyOS.");
      router.push(next);
      router.refresh();
    } else {
      toast.success("Check your inbox to confirm your account.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <GlassPanel strong className="p-6 sm:p-8">
        <Tabs defaultValue="signin">
          <TabsList className="mb-6 grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Create account</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    required
                    className="pl-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    required
                    className="pl-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full gap-2">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                Sign in
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="fullName"
                    required
                    className="pl-9"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signupEmail">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="signupEmail"
                    type="email"
                    required
                    className="pl-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signupPassword">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="signupPassword"
                    type="password"
                    required
                    minLength={6}
                    className="pl-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                  />
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-border/50 p-3">
                <input
                  id="acceptTerms"
                  type="checkbox"
                  required
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)]"
                />
                <label htmlFor="acceptTerms" className="text-xs leading-5 text-muted-foreground">
                  I am at least 18 and agree to the{" "}
                  <Link
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-4"
                  >
                    Terms of Service
                  </Link>
                  , including the{" "}
                  <Link
                    href="/acceptable-use"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-4"
                  >
                    Acceptable Use Policy
                  </Link>
                  . I acknowledge the{" "}
                  <Link
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-4"
                  >
                    Privacy Policy
                  </Link>
                  .
                </label>
              </div>
              <Button type="submit" disabled={loading || !termsAccepted} className="w-full gap-2">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                Create account
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </GlassPanel>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Your workspace is associated with your account. See our{" "}
        <Link href="/privacy" className="text-primary hover:underline">
          Privacy Policy
        </Link>{" "}
        for data processing and operator access details.
      </p>
    </motion.div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginForm />
    </React.Suspense>
  );
}
