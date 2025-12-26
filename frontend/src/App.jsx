import { useState, useEffect } from "react";
import "./App.css";

function App() {
  const totalPages = 100;
  const [currentPage, setCurrentPage] = useState(1);
  const [content, setContent] = useState("");
  const [isFlipping, setIsFlipping] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Save & Next");
  const [loading, setLoading] = useState(false);

  // Load page content from backend
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`http://localhost:5000/notes/${currentPage}`);
        const data = await res.json();
        if (mounted) setContent(data.content || "");
      } catch (err) {
        console.error("Failed to load page", err);
        if (mounted) setContent("");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => (mounted = false);
  }, [currentPage]);

  const saveNote = async () => {
    try {
      await fetch("http://localhost:5000/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, page: currentPage }),
      });
      return true;
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

    // Clear in the middle of flip and go to next page
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

  return (
    <>
      <div className="notebook-container">
        <div className={`page-wrapper ${isFlipping ? "flipping" : ""}`}>
          <div className="front">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                loading ? "Loading..." : "Start writing your thoughts..."
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
          <button onClick={handlePrev} disabled={currentPage === 1}>
            Prev
          </button>
          <button onClick={handleSaveOnly}>{saveStatus}</button>
          <button onClick={handleSaveAndNext}>
            {currentPage === totalPages ? "Save" : "Save & Next"}
          </button>
        </div>
      </div>
    </>
  );
}

export default App;
