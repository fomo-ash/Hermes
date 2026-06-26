import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "../lib/auth"; // Explicit relative path matching your tree

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  imageUrl: string | null;
}

export function useAuth(redirectToLogin = true) {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    api
      .get("/api/v1/auth/me")
      .then((res) => {
        if (isMounted) {
          // Unwraps your backend's successResponse envelope: { success: true, data: { user } }
          setUser(res.data.user);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setUser(null);
          setIsLoading(false);
          if (redirectToLogin) {
            router.push("/login");
          }
        }
      });

    return () => {
      isMounted = false;
    };
  }, [router, redirectToLogin]);

  const logout = async () => {
    try {
      await api.post("/api/v1/auth/logout");
      setUser(null);
      router.push("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return { user, isLoading, logout };
}
