"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../lib/auth";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  imageUrl?: string;
}

export default function DashboardPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    apiFetch("/api/v1/auth/me")
      .then((res) => {
        if (!res.ok) throw new Error("Unauthorized");
        return res.json();
      })
      .then((data) => {
        setUser(data.user);
        setLoading(false);
      })
      .catch(() => {
        router.push("/login");
      });
  }, [router]);

  const handleLogout = async () => {
    try {
      await apiFetch("/api/v1/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
    }
  };

  if (loading) {
    return (
      <div style={{ color: "#94a3b8", padding: "40px", textAlign: "center" }}>
        Verifying active session...
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "40px",
        color: "#f8fafc",
        maxWidth: "800px",
        margin: "0 auto",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #334155",
          paddingBottom: "20px",
        }}
      >
        <h1>Workspace Dashboard</h1>
        <button
          onClick={handleLogout}
          style={{
            padding: "8px 16px",
            backgroundColor: "#ef4444",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "600",
          }}
        >
          Log Out
        </button>
      </header>

      <main style={{ marginTop: "30px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            padding: "24px",
            backgroundColor: "#1e293b",
            borderRadius: "8px",
          }}
        >
          {user?.imageUrl && (
            <img
              src={user.imageUrl}
              alt="Avatar"
              style={{ width: "60px", height: "60px", borderRadius: "50%" }}
            />
          )}
          <div>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "20px" }}>
              {user?.name}
            </h3>
            <p style={{ margin: 0, color: "#94a3b8" }}>{user?.email}</p>
          </div>
        </div>
      </main>
    </div>
  );
}
