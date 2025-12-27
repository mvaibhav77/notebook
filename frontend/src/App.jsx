import { useState, useEffect, useRef } from "react";
import "./App.css";

function App() {
  const totalPages = 100;
  const [currentPage, setCurrentPage] = useState(1);
  const [content, setContent] = useState("");
  const [isFlipping, setIsFlipping] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Save & Next");
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef(null);
  const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

  // auth state
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [username, setUsername] = useState(
    localStorage.getItem("username") || ""
  );
  const [authForm, setAuthForm] = useState({ username: "", password: "" });
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
      localStorage.setItem("username", username);
    } else {
      localStorage.removeItem("token");
      localStorage.removeItem("username");
    }
  }, [token, username]);

  // Load page content from backend (if logged in) or from localStorage when anonymous
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      if (!token) {
        const local = localStorage.getItem(`note:page:${currentPage}`) || "";
        if (mounted) {
          setContent(local);
          textareaRef.current?.focus();
        }
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API}/notes/${currentPage}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          setToken("");
          setUsername("");
          throw new Error("Unauthorized");
        }
        const data = await res.json();
        if (mounted) {
          setContent(data.content || "");
          textareaRef.current?.focus();
        }
      } catch (err) {
        console.error("Failed to load page", err);
        if (mounted) setContent("");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => (mounted = false);
  }, [currentPage, token]);

  const saveNote = async () => {
    // If anonymous, persist locally (so user can write without logging in)
    if (!token) {
      try {
        localStorage.setItem(`note:page:${currentPage}`, content || "");
        return true;
      } catch (err) {
        console.error("Local save failed", err);
        return false;
      }
    }

    try {
      const res = await fetch(`${API}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content, page: currentPage }),
      });
      if (res.status === 401) {
        setToken("");
        setUsername("");
        return false;
      }
      return res.ok;
    } catch (err) {
      console.error("Save failed", err);
      return false;
    }
  };

  const handleSaveAndNext = async () => {
    if (isFlipping) return;
    setIsFlipping(true);
    setSaveStatus("Saving...");

    const ok = await saveNote();
    setSaveStatus(ok ? "Saved!" : "Error!");

    setTimeout(() => {
      setContent("");
      setSaveStatus("Save & Next");
      setCurrentPage((p) => Math.min(p + 1, totalPages));
    }, 600);

    setTimeout(() => setIsFlipping(false), 1200);
  };

  const handlePrev = () => {
    if (isFlipping) return;
    setCurrentPage((p) => Math.max(1, p - 1));
  };

  const handleSaveOnly = async () => {
    setSaveStatus("Saving...");
    const ok = await saveNote();
    setSaveStatus(ok ? "Saved" : "Error");
    setTimeout(() => setSaveStatus("Save & Next"), 1000);
  };

  // Auth helpers
  const register = async () => {
    setAuthLoading(true);
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authForm),
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        setUsername(data.username);
        setAuthForm({ username: "", password: "" });
      } else {
        alert(data.error || "Registration failed");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAuthLoading(false);
    }
  };

  const login = async () => {
    setAuthLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authForm),
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        setUsername(data.username);
        setAuthForm({ username: "", password: "" });
      } else {
        alert(data.error || "Login failed");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    setToken("");
    setUsername("");
  };

  return (
    <>
      <div
        style={{ position: "absolute", top: 12, left: 12, color: "#f1c40f" }}
      >
        {token ? (
          <>
            <div>
              Signed in as <strong>{username}</strong>
            </div>
            <button onClick={logout}>Logout</button>
          </>
        ) : (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              placeholder="username"
              value={authForm.username}
              onChange={(e) =>
                setAuthForm({ ...authForm, username: e.target.value })
              }
            />
            <input
              placeholder="password"
              type="password"
              value={authForm.password}
              onChange={(e) =>
                setAuthForm({ ...authForm, password: e.target.value })
              }
            />
            <button onClick={login} disabled={authLoading}>
              Login
            </button>
            <button onClick={register} disabled={authLoading}>
              Register
            </button>
          </div>
        )}
      </div>

      <div className="notebook-container">
        <div className={`page-wrapper ${isFlipping ? "flipping" : ""}`}>
          <div className="front">
            <textarea
              ref={textareaRef}
              autoFocus
              tabIndex={0}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (!token)
                  localStorage.setItem(
                    `note:page:${currentPage}`,
                    e.target.value
                  );
              }}
              placeholder={
                !token
                  ? "Write here (saved locally). Login to persist to your diary."
                  : loading
                  ? "Loading..."
                  : "Start writing your thoughts..."
              }
              spellCheck="false"
            />
          </div>

          <div className="back"></div>
        </div>
      </div>

      <div className="controls">
        <div style={{ marginBottom: 8, textAlign: "center", color: "#f1c40f" }}>
          Page <strong>{currentPage}</strong> / <strong>{totalPages}</strong>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button
            onClick={() => {
              if (!isFlipping) setCurrentPage((p) => Math.max(1, p - 1));
            }}
            disabled={currentPage === 1}
          >
            Prev
          </button>
          <button
            onClick={async () => {
              setSaveStatus("Saving...");
              const ok = await saveNote();
              setSaveStatus(ok ? "Saved" : "Error");
              setTimeout(() => setSaveStatus("Save & Next"), 1000);
            }}
          >
            {saveStatus}
          </button>
          <button onClick={handleSaveAndNext}>
            {currentPage === totalPages ? "Save" : "Save & Next"}
          </button>
        </div>
      </div>
    </>
  );
}

export default App;
