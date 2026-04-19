"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";

export default function LoginPage() {
  const r = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [banner, setBanner] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    // Handle URL parameters for verification states
    const verify = searchParams.get('verify');
    const verified = searchParams.get('verified');
    const emailParam = searchParams.get('email');
    
    if (verify === 'sent' && emailParam) {
      setBanner({
        type: 'info',
        message: `Activation email sent to ${decodeURIComponent(emailParam)}. Check your inbox.`
      });
      setEmail(decodeURIComponent(emailParam));
    } else if (verified === '1') {
      setBanner({
        type: 'success',
        message: 'Email verified! You can log in now.'
      });
      if (emailParam) {
        setEmail(decodeURIComponent(emailParam));
      }
    } else if (verify === 'invalid') {
      setBanner({
        type: 'error',
        message: 'Verification link is invalid or expired. Resend verification email below.'
      });
    } else if (verify === 'dev') {
      setBanner({
        type: 'info',
        message: 'Development mode: Email verification is disabled. You can log in directly.'
      });
    }
  }, [searchParams]);

  async function handleResendVerification() {
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address first",
        variant: "destructive",
      });
      return;
    }

    setResendLoading(true);
    try {
      const res = await fetch('/api/auth/verify/resend', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setBanner({
          type: 'info',
          message: 'Verification email sent! Check your inbox.'
        });
        setShowResend(false);
      } else {
        const data = await res.json();
        if (res.status === 429) {
          toast({
            title: "Too many requests",
            description: "Please wait before requesting another verification email.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: data.message || "Failed to send verification email",
            variant: "destructive",
          });
        }
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to send verification email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setResendLoading(false);
    }
  }

  function validateEmail(email: string): boolean {
    setEmailError("");
    if (!email) {
      setEmailError("Email is required");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError("Please enter a valid email address");
      return false;
    }
    return true;
  }

  function validatePassword(password: string): boolean {
    setPasswordError("");
    if (!password) {
      setPasswordError("Password is required");
      return false;
    }
    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return false;
    }
    return true;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate inputs
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: "Success",
          description: "Logged in successfully",
        });
        const nextParam = searchParams.get("next");
        const safeNext =
          nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
            ? nextParam
            : "/dashboard";
        r.push(safeNext);
      } else if (res.status === 403 && data.error === "EMAIL_NOT_VERIFIED") {
        setBanner({
          type: 'error',
          message: data.message || 'Please verify your email to continue.'
        });
        setShowResend(true);
      } else {
        toast({
          title: "Login failed",
          description: data.message || "Invalid credentials",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Login failed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      
      {banner && (
        <div className={`p-3 rounded-md text-sm ${
          banner.type === 'info' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
          banner.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
          'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {banner.message}
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="text-sm font-medium">Email</label>
          <input
            className={`mt-1 w-full rounded-md border px-3 py-2 text-sm ${
              emailError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
            }`}
            type="email"
            value={email}
            onChange={e => {
              setEmail(e.target.value);
              if (emailError) setEmailError("");
            }}
            required
          />
          {emailError && (
            <p className="mt-1 text-sm text-red-600">{emailError}</p>
          )}
        </div>
        <div>
          <label className="text-sm font-medium">Password</label>
          <input
            type="password"
            className={`mt-1 w-full rounded-md border px-3 py-2 text-sm ${
              passwordError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
            }`}
            value={password}
            onChange={e => {
              setPassword(e.target.value);
              if (passwordError) setPasswordError("");
            }}
            required
          />
          {passwordError && (
            <p className="mt-1 text-sm text-red-600">{passwordError}</p>
          )}
        </div>
        <button
          className="w-full rounded-md border px-3 py-2 text-sm bg-black text-white disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Signing in..." : "Continue"}
        </button>
      </form>
      
      {showResend && (
        <div className="border-t pt-4">
          <p className="text-sm text-gray-600 mb-2">Need to verify your email?</p>
          <button
            onClick={handleResendVerification}
            disabled={resendLoading}
            className="text-sm text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
          >
            {resendLoading ? 'Sending...' : 'Resend verification email'}
          </button>
        </div>
      )}
      
      <p className="text-sm">
        New here? <a className="underline" href="/signup">Create account</a>
      </p>
    </div>
  );
}