"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

export default function SignupPage() {
  const r = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordStrength, setPasswordStrength] = useState<{
    score: number;
    label: string;
    color: string;
    suggestions: string[];
  }>({ score: 0, label: '', color: '', suggestions: [] });

  function calculatePasswordStrength(password: string) {
    let score = 0;
    const suggestions: string[] = [];

    if (!password) {
      setPasswordStrength({ score: 0, label: '', color: '', suggestions: [] });
      return;
    }

    // Length check
    if (password.length >= 8) score += 1;
    else suggestions.push("Use at least 8 characters");

    if (password.length >= 12) score += 1;

    // Complexity checks
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
      score += 1;
    } else {
      suggestions.push("Include both uppercase and lowercase letters");
    }

    if (/\d/.test(password)) {
      score += 1;
    } else {
      suggestions.push("Include at least one number");
    }

    if (/[^A-Za-z0-9]/.test(password)) {
      score += 1;
    } else {
      suggestions.push("Include at least one special character");
    }

    // Determine label and color based on score
    let label = '';
    let color = '';

    if (score <= 1) {
      label = 'Weak';
      color = 'bg-red-500';
    } else if (score <= 2) {
      label = 'Fair';
      color = 'bg-orange-500';
    } else if (score <= 3) {
      label = 'Good';
      color = 'bg-yellow-500';
    } else if (score <= 4) {
      label = 'Strong';
      color = 'bg-green-500';
    } else {
      label = 'Very Strong';
      color = 'bg-green-600';
    }

    setPasswordStrength({ score, label, color, suggestions });
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
    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters");
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
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, name, password }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.warning === 'SMTP_NOT_CONFIGURED') {
          toast({
            title: "Development Mode",
            description: data.message,
          });
        } else {
          toast({
            title: "Account created",
            description: "Please check your email to verify your account.",
          });
        }
        // Redirect to login with verification message
        r.push(data.next);
      } else {
        const errorMessage = data.error === "EMAIL_TAKEN" ? "Email already in use" :
                           data.message || "Sign up failed";
        toast({
          title: "Sign up failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Sign up failed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Create account</h1>
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
          <label className="text-sm font-medium">Name</label>
          <input
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            value={name}
            onChange={e => setName(e.target.value)}
          />
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
              const newPassword = e.target.value;
              setPassword(newPassword);
              calculatePasswordStrength(newPassword);
              if (passwordError) setPasswordError("");
            }}
            required
          />
          {passwordError && (
            <p className="mt-1 text-sm text-red-600">{passwordError}</p>
          )}

          {/* Password Strength Indicator */}
          {password && passwordStrength.label && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Password strength:</span>
                <span className={`text-xs font-medium ${
                  passwordStrength.score <= 1 ? 'text-red-600' :
                  passwordStrength.score <= 2 ? 'text-orange-600' :
                  passwordStrength.score <= 3 ? 'text-yellow-600' :
                  'text-green-600'
                }`}>
                  {passwordStrength.label}
                </span>
              </div>
              <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${passwordStrength.color} transition-all duration-300`}
                  style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                />
              </div>
              {passwordStrength.suggestions.length > 0 && (
                <ul className="text-xs text-gray-600 space-y-1">
                  {passwordStrength.suggestions.map((suggestion, idx) => (
                    <li key={idx} className="flex items-start">
                      <span className="mr-1">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <button
          className="w-full rounded-md border px-3 py-2 text-sm bg-black text-white disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Creating..." : "Sign up"}
        </button>
      </form>
      <p className="text-sm">
        Have an account? <a className="underline" href="/login">Log in</a>
      </p>
    </div>
  );
}