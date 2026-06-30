"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
// import { api } from "../lib/auth";
import { api } from "../../../lib/auth";
import {
  AtSign,
  Image as ImageIcon,
  ArrowRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Building2,
} from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [username, setUsername] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch user on mount to check auth status and pre-fill Google values
  useEffect(() => {
    api
      .get("/api/v1/auth/me")
      .then((res) => {
        const user = res.data.user;
        if (user.onboarded) {
          // If already onboarded, redirect straight to dashboard
          router.push("/dashboard");
        } else {
          // Pre-fill image URL from Google if present
          if (user.imageUrl) {
            setImageUrl(user.imageUrl);
          }
          setPageLoading(false);
        }
      })
      .catch(() => {
        // If not logged in at all, redirect to login
        router.push("/login");
      });
  }, [router]);

  // 2. Real-time Username Availability Check
  const checkUsername = (name: string) => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

    const cleanName = name.trim().toLowerCase();
    if (cleanName.length < 3) {
      setIsAvailable(null);
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    setErrorMessage("");

    debounceTimeout.current = setTimeout(() => {
      api
        .get("/api/v1/onboarding/check-username", {
          params: { username: cleanName },
        })
        .then((res) => {
          setIsAvailable(res.data.available);
          setIsChecking(false);
        })
        .catch((err) => {
          setErrorMessage(
            err.message || "Failed to check username availability.",
          );
          setIsChecking(false);
        });
    }, 400); // 400ms debounce
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""); // Allow only clean characters
    setUsername(value);
    checkUsername(value);
  };

  // 3. Handle step transitions
  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAvailable && username.trim().length >= 3) {
      setStep(2);
    }
  };

  const handleAvatarNext = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(3);
  };

  const handleAvatarSkip = () => {
    setImageUrl("");
    setStep(3);
  };

  // 4. Final submission — creates the user profile AND the workspace together
  const handleCompleteSetup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (workspaceName.trim().length < 3) {
      setErrorMessage("Workspace name must be at least 3 characters.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await api.post("/api/v1/onboarding", {
        username: username.trim().toLowerCase(),
        imageUrl: imageUrl.trim() || undefined,
        workspaceName: workspaceName.trim(),
      });
      router.push("/dashboard");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to complete onboarding.");
      setIsSubmitting(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#090d16] text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mr-2" />
        <span>Loading secure onboarding session...</span>
      </div>
    );
  }

  const stepTitles: Record<1 | 2 | 3, string> = {
    1: "Choose a username",
    2: "Setup your profile picture",
    3: "Create your workspace",
  };

  const stepSubtitles: Record<1 | 2 | 3, string> = {
    1: "Choose a unique username so your team can refer to you.",
    2: "Add an image URL so your team can recognize you.",
    3: "Give your workspace a name. You can create more later.",
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[radial-gradient(circle_at_50%_0%,#1e1b4b_0%,#090d16_70%)]">
      {/* Header section */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-white font-extrabold text-2xl shadow-[0_4px_14px_rgba(99,102,241,0.4)] mb-4 select-none">
          H
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-50 mb-2 text-center">
          {stepTitles[step]}
        </h1>
        <p className="text-sm text-slate-400 text-center max-w-xs leading-relaxed">
          {stepSubtitles[step]}
        </p>

        {/* Step progress dots */}
        <div className="flex items-center gap-2 mt-5">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === step ? "w-6 bg-indigo-500" : "w-1.5 bg-white/15"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl w-full max-w-md">
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-950/50 border border-red-500/30 text-red-200 text-sm rounded-lg flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {step === 1 && (
          /* ================= STEP 1: USERNAME ================= */
          <form onSubmit={handleNextStep} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Username
              </label>
              <div className="relative flex items-center">
                <AtSign className="w-5 h-5 text-slate-500 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  value={username}
                  onChange={handleUsernameChange}
                  placeholder="e.g. alex_rivera"
                  className="w-full h-12 pl-10 pr-10 bg-slate-950 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                  autoFocus
                  required
                />

                {/* Inline loading and availability check indicators */}
                <div className="absolute right-3">
                  {isChecking && (
                    <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                  )}
                  {!isChecking && isAvailable === true && (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  )}
                  {!isChecking && isAvailable === false && (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>
              </div>

              {/* Status helper text */}
              {!isChecking && isAvailable === true && (
                <p className="text-xs text-green-400">Username is available.</p>
              )}
              {!isChecking && isAvailable === false && (
                <p className="text-xs text-red-400">
                  Username is already taken.
                </p>
              )}
              {username.length > 0 && username.length < 3 && (
                <p className="text-xs text-slate-500">
                  Username must be at least 3 characters.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!isAvailable || isChecking || username.length < 3}
              className="inline-flex items-center justify-center w-full h-12 px-5 bg-white text-slate-900 border border-white/20 rounded-lg cursor-pointer font-semibold text-sm transition-all duration-200 shadow-sm hover:bg-slate-50 hover:border-indigo-500 hover:-translate-y-0.5 hover:shadow-[0_8px_16px_rgba(99,102,241,0.15)] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </form>
        )}

        {step === 2 && (
          /* ================= STEP 2: AVATAR ================= */
          <form onSubmit={handleAvatarNext} className="space-y-6">
            <div className="flex flex-col items-center mb-6">
              <div className="w-24 h-24 rounded-full bg-slate-950 border-2 border-white/10 overflow-hidden flex items-center justify-center shadow-inner relative group">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Avatar preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://i.pravatar.cc/150?img=12";
                    }}
                  />
                ) : (
                  <ImageIcon className="w-8 h-8 text-slate-600" />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Avatar Image URL
              </label>
              <div className="relative flex items-center">
                <ImageIcon className="w-5 h-5 text-slate-500 absolute left-3 pointer-events-none" />
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full h-12 pl-10 pr-4 bg-slate-950 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="submit"
                className="inline-flex items-center justify-center w-full h-12 px-5 bg-white text-slate-900 border border-white/20 rounded-lg cursor-pointer font-semibold text-sm transition-all duration-200 shadow-sm hover:bg-slate-50 hover:border-indigo-500 hover:-translate-y-0.5 hover:shadow-[0_8px_16px_rgba(99,102,241,0.15)] active:translate-y-0"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
              <button
                type="button"
                onClick={handleAvatarSkip}
                className="inline-flex items-center justify-center w-full h-12 px-5 bg-transparent text-slate-400 hover:text-white hover:bg-white/5 border border-transparent rounded-lg cursor-pointer font-semibold text-sm transition-all"
              >
                Skip for now
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          /* ================= STEP 3: WORKSPACE ================= */
          <form onSubmit={handleCompleteSetup} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Workspace Name
              </label>
              <div className="relative flex items-center">
                <Building2 className="w-5 h-5 text-slate-500 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="Acme Inc."
                  className="w-full h-12 pl-10 pr-4 bg-slate-950 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                  autoFocus
                  required
                />
              </div>
              <p className="text-xs text-slate-500">
                You can create additional workspaces later.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={isSubmitting || workspaceName.trim().length < 3}
                className="inline-flex items-center justify-center w-full h-12 px-5 bg-white text-slate-900 border border-white/20 rounded-lg cursor-pointer font-semibold text-sm transition-all duration-200 shadow-sm hover:bg-slate-50 hover:border-indigo-500 hover:-translate-y-0.5 hover:shadow-[0_8px_16px_rgba(99,102,241,0.15)] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Creating Workspace...
                  </>
                ) : (
                  "Create Workspace"
                )}
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center w-full h-12 px-5 bg-transparent text-slate-400 hover:text-white hover:bg-white/5 border border-transparent rounded-lg cursor-pointer font-semibold text-sm transition-all disabled:opacity-50"
              >
                Back
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
