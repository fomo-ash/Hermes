"use client";

export default function LoginPage() {
  const handleGoogleAuth = () => {
    // This points directly to our future Express backend route
    window.location.href = "http://localhost:8000/api/v1/auth/google";
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Welcome</h2>
        <p style={styles.subtitle}>Sign up or Sign in below</p>
        <button onClick={handleGoogleAuth} style={styles.button}>
          Continue with Google
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    backgroundColor: "#0f172a",
    color: "#fff",
  },
  card: {
    padding: "32px",
    borderRadius: "12px",
    backgroundColor: "#1e293b",
    textAlign: "center" as const,
    boxShadow: "0 4px 6px rgba(0,0,0,0.2)",
  },
  title: { fontSize: "24px", marginBottom: "8px" },
  subtitle: { fontSize: "14px", color: "#94a3b8", marginBottom: "24px" },
  button: {
    padding: "12px 24px",
    backgroundColor: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "600" as const,
  },
};
