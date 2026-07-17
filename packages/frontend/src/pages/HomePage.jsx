import { useRef, useState, useEffect } from "react";
import { useReveal } from "../hooks/useReveal";
import {
  ArrowRight,
  BookOpen,
  Bot,
  Camera,
  CheckCircle,
  FileText,
  FolderUp,
  ShoppingCart,
  Sparkles,
  Star,
  Target,
  X,
  Zap,
} from "lucide-react";
import { importGoodreads, savePreferences } from "../services/api";

const GENRE_SUGGESTIONS = [
  "Literary Fiction", "Mystery", "Sci-Fi", "Fantasy", "Historical Fiction",
  "Thriller", "Biography", "Romance", "Dark Romance", "Non-fiction",
  "Horror", "Psychological Thriller", "Short Stories", "Graphic Novel",
  "Self Help", "True Crime", "Memoir", "Young Adult", "Children's",
  "Dystopian", "Magical Realism", "Contemporary Fiction", "Adventure",
  "Crime Fiction", "Cozy Mystery", "Epic Fantasy", "Space Opera",
  "Paranormal", "Satire", "Poetry", "Essays", "Philosophy",
  "Science", "History", "Politics", "Travel", "Cooking", "Art",
];

const PACE = ["Quick reads", "Long epics", "Either"];
const LENGTH = ["Under 300pp", "300-500pp", "500pp+", "No preference"];

const SHELF_SPINES = [
  { title: "Dune", author: "F. Herbert", height: "78%", tone: "#F0A843", z: 18 },
  { title: "Circe", author: "M. Miller", height: "66%", tone: "#8B5E3C", z: -8 },
  { title: "Klara", author: "Ishiguro", height: "84%", tone: "#C47B28", z: 24 },
  { title: "Hail Mary", author: "A. Weir", height: "72%", tone: "#E8924A", z: -4 },
  { title: "Library", author: "M. Haig", height: "88%", tone: "#6B3F1A", z: 30 },
  { title: "Archive", author: "A. Core", height: "61%", tone: "#D4803A", z: -14 },
  { title: "Orbit", author: "S. Nova", height: "76%", tone: "#F5B865", z: 12 },
  { title: "Atlas", author: "N. Code", height: "69%", tone: "#A0522D", z: -20 },
];

const STEPS = [
  {
    n: "01",
    icon: Target,
    title: "Set your taste",
    desc: "Choose genres, authors, pace, length, and your minimum recommendation quality.",
  },
  {
    n: "02",
    icon: Camera,
    title: "Photograph a shelf",
    desc: "Capture a sale shelf, library shelf, or home bookshelf in one wide frame.",
  },
  {
    n: "03",
    icon: Bot,
    title: "Read the spines",
    desc: "Vision and OCR extract candidate titles with confidence before ranking begins.",
  },
  {
    n: "04",
    icon: Sparkles,
    title: "Review and rank",
    desc: "Correct uncertain detections, then rank only the confirmed book list.",
  },
  {
    n: "05",
    icon: ShoppingCart,
    title: "Save or buy",
    desc: "Send books to your reading list or open buying options from the same flow.",
  },
];

export default function HomePage({ setPage, prefs, setPrefs, showToast }) {
  const [dragover, setDragover] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvImportCount, setCsvImportCount] = useState(0);
  const [minRating, setMinRating] = useState(prefs.minRating || 0);
  const [genreInput, setGenreInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef();

  const revealProcess = useReveal();
  const revealPrefs = useReveal();
  const revealTaste = useReveal();

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const root = document.documentElement;
    let magneticButtons = [];
    let frame = 0;
    let lastPointer = null;
    const refreshMagneticButtons = () => {
      magneticButtons = Array.from(document.querySelectorAll(".btn-primary, .btn-secondary, .nav-cta"));
    };
    refreshMagneticButtons();

    const applyPointerEffects = () => {
      if (!lastPointer) return;
      const e = lastPointer;
      const xPct = (e.clientX / window.innerWidth) * 100;
      const yPct = (e.clientY / window.innerHeight) * 100;
      root.style.setProperty("--cursor-x", xPct.toFixed(1));
      root.style.setProperty("--cursor-y", yPct.toFixed(1));

      magneticButtons.forEach((btn) => {
        const rect = btn.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const radius = 90;
        if (dist > 0 && dist < radius) {
          const strength = (1 - dist / radius) * 8;
          btn.style.setProperty("--mag-x", `${(dx / dist) * strength}px`);
          btn.style.setProperty("--mag-y", `${(dy / dist) * strength}px`);
        } else {
          btn.style.setProperty("--mag-x", "0px");
          btn.style.setProperty("--mag-y", "0px");
        }
      });
      frame = 0;
    };

    const onMove = (e) => {
      lastPointer = e;
      if (!frame) {
        frame = window.requestAnimationFrame(applyPointerEffects);
      }
    };

    const onScroll = () => {
      root.style.setProperty("--scroll-y", `${window.scrollY}px`);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", refreshMagneticButtons, { passive: true });
    window.addEventListener("pointerover", refreshMagneticButtons, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", refreshMagneticButtons);
      window.removeEventListener("pointerover", refreshMagneticButtons);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  useEffect(() => {
    setMinRating(prefs.minRating || 0);
  }, [prefs.minRating]);

  const filteredSuggestions = genreInput.length > 0
    ? GENRE_SUGGESTIONS.filter((genre) => (
        genre.toLowerCase().includes(genreInput.toLowerCase()) &&
        !prefs.genres.includes(genre)
      ))
    : GENRE_SUGGESTIONS.filter((genre) => !prefs.genres.includes(genre));

  const tasteSignals = [
    ["Genre memory", prefs.genres.length ? `${prefs.genres.length} active` : "empty", prefs.genres.slice(0, 3).join(" / ") || "Add genres to make ranking personal"],
    ["Author bias", prefs.authors.trim() ? "active" : "empty", prefs.authors.trim() || "Favorite authors tighten discovery"],
    ["Loved books", prefs.loved.trim() ? "active" : "empty", prefs.loved.trim() || "Loved titles explain recommendation logic"],
    ["Quality floor", minRating ? `${minRating}+ stars` : "any", "Minimum rating filter for recommendations"],
  ];

  const addGenre = (genre) => {
    const trimmed = genre.trim();
    if (!trimmed || prefs.genres.includes(trimmed)) return;
    setPrefs((current) => ({ ...current, genres: [...current.genres, trimmed] }));
    setGenreInput("");
    setShowSuggestions(false);
  };

  const removeGenre = (genre) => {
    setPrefs((current) => ({
      ...current,
      genres: current.genres.filter((item) => item !== genre),
    }));
  };

  const handleGenreKeyDown = (event) => {
    if (event.key === "Enter" && genreInput.trim()) {
      addGenre(genreInput);
    }
  };

  const handleFile = async (file) => {
    if (!file) return;
    const isCsvName = file.name.toLowerCase().endsWith(".csv");
    const isCsvType = !file.type || ["text/csv", "application/vnd.ms-excel", "application/csv"].includes(file.type);
    if (!isCsvName || !isCsvType) {
      setCsvFile(null);
      setCsvImportCount(0);
      showToast("Upload a Goodreads CSV file");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setCsvFile(null);
      setCsvImportCount(0);
      showToast("Goodreads CSV must be under 8MB");
      return;
    }
    setImporting(true);
    try {
      const csvData = await file.text();
      if (!/title|book title/i.test(csvData.slice(0, 500))) {
        throw new Error("CSV header must include a book title column");
      }
      const result = await importGoodreads(csvData);
      setCsvFile(file);
      setCsvImportCount(Number(result.imported || 0));
      showToast(result.message || "Goodreads CSV imported");
    } catch (error) {
      setCsvFile(null);
      setCsvImportCount(0);
      showToast(error.message?.includes("Unauthorized") ? "Sign in before importing Goodreads data" : "Goodreads CSV import failed");
    } finally {
      if (fileRef.current) {
        fileRef.current.value = "";
      }
      setImporting(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragover(false);
    handleFile(event.dataTransfer.files[0]);
  };

  const persistPreferences = async (nextPage) => {
    try {
      await savePreferences({
        genres: prefs.genres,
        pace: prefs.pace,
        length: prefs.length,
        authors: prefs.authors,
        loved: prefs.loved,
        minRating: prefs.minRating,
      });
      showToast(nextPage === "scanner" ? "Preferences saved, ready to scan" : "Preferences saved");
    } catch {
      showToast(nextPage === "scanner" ? "Saved for this session, ready to scan" : "Saved for this session");
    }
    setTimeout(() => setPage(nextPage), 550);
  };

  return (
    <div className="page home-page">
      <section className="experience-hero">
        <div className="experience-photo" aria-hidden="true" />
        <iframe
          className="radiant-hero-map"
          aria-hidden="true"
          tabIndex={-1}
          title="Decorative shelf contour animation"
          src="/radiant/shelf-contours.html"
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
        <div className="hero-light-rig" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <div className="operator-grid">
          <div className="command-copy">
            <div className="command-kicker">
              <Sparkles size={15} /> Bookshop decision tool
            </div>
            <h1>Scan a shelf.<br />Leave with the <em>right</em> books.</h1>
            <p>
              ShelfScanner turns a crowded book wall into a short, defensible buying
              list. It reads the spines, asks you to confirm uncertain titles, then
              ranks only the books it can stand behind.
            </p>

            <div className="hero-verdict-card" aria-label="Example ShelfScanner verdict">
              <div className="verdict-lead">
                <span>Bookseller note</span>
                <strong>Buy Dune first.</strong>
                <small>Confirmed title, strong science-fiction fit, no review blockers.</small>
              </div>
              <div className="verdict-factors" aria-label="Verdict factors">
                <span><strong>8</strong> spines read</span>
                <span><strong>2</strong> need review</span>
                <span><strong>1</strong> best pick</span>
              </div>
            </div>

            <div className="command-actions">
              <button className="btn-primary command-primary" onClick={() => setPage("scanner")}>
                <Camera size={18} strokeWidth={2.2} /> Start live scan <ArrowRight size={16} />
              </button>
              <button className="btn-secondary command-secondary" onClick={() => setPage("discover")}>
                <Sparkles size={17} /> Open discovery
              </button>
            </div>
          </div>

          <div className="shelf-intel-model" aria-label="Animated shelf scanner preview">
            <div className="model-topline">
              <span>VISION FIELD</span>
              <strong>INTERACTIVE PREVIEW / REVIEW FIRST</strong>
            </div>

            <div className="model-stage">
              <div className="depth-grid" aria-hidden="true" />
              <div className="scan-aperture" aria-hidden="true">
                <span />
                <span />
              </div>
              <div className="book-spine-rack">
                {SHELF_SPINES.map((book, index) => (
                  <div
                    className="model-spine"
                    key={book.title}
                    style={{
                      "--spine-height": book.height,
                      "--spine-tone": book.tone,
                      "--spine-delay": `${index * 0.11}s`,
                      "--spine-z": `${book.z}px`,
                    }}
                  >
                    <span>{book.title}</span>
                    <small>{book.author}</small>
                  </div>
                ))}
              </div>
              <div className="scan-sheet" aria-hidden="true" />
              <div className="model-beam" aria-hidden="true" />
              <div className="floating-verdicts" aria-hidden="true">
                <span className="verdict-card verdict-card-a">OCR check</span>
                <span className="verdict-card verdict-card-b">Taste profile</span>
                <span className="verdict-card verdict-card-c">Rank next</span>
              </div>
            </div>

            <div className="model-bottombar">
              <span>Gemini vision</span>
              <span>Human review gate</span>
              <span>Ranked output</span>
            </div>
          </div>
        </div>
        <div className="hero-scroll-cue" aria-hidden="true">
          <span />
        </div>
      </section>

      <section className="section process-section reveal reveal-stagger" id="how" ref={revealProcess}>
        <div className="scanner-kicker"><Target size={15} /> The process</div>
        <h2 className="section-title">How ShelfScanner works</h2>
        <div className="divider" />
        <div className="steps">
          {STEPS.map(({ n, icon: Icon, title, desc }) => (
            <div className="step" key={n}>
              <div className="step-num">{n}</div>
              <div className="step-icon">
                <Icon size={30} strokeWidth={1.8} />
              </div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section taste-depth-section reveal reveal-stagger" ref={revealTaste} aria-label="Taste profile depth">
        <div className="scanner-kicker"><Sparkles size={15} /> Personalization depth</div>
        <h2 className="section-title">Your taste model is visible before it ranks anything.</h2>
        <div className="divider" />
        <div className="taste-matrix">
          {tasteSignals.map(([label, value, note]) => (
            <div className="taste-node" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{note}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="preferences-band reveal" ref={revealPrefs}>
        <div className="section">
          <div className="scanner-kicker"><BookOpen size={15} /> Personalise</div>
          <h2 className="section-title">Set your reading preferences</h2>
          <div className="divider" />

          <div className="prefs-grid">
            <div className="pref-column">
              <div className="pref-card">
                <h3><BookOpen size={18} /> Favourite genres</h3>
                <p>Type any genre or pick from suggestions below.</p>

                {prefs.genres.length > 0 && (
                  <div className="selected-chips">
                    {prefs.genres.map((genre) => (
                      <span key={genre}>
                        {genre}
                        <button type="button" onClick={() => removeGenre(genre)} aria-label={`Remove ${genre}`}>
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="genre-input-wrap">
                  <label className="sr-only" htmlFor="home-genre-input">Add a favourite genre</label>
                  <input
                    id="home-genre-input"
                    type="text"
                    placeholder="Type a genre e.g. Dark Romance, Cozy Mystery"
                    value={genreInput}
                    onChange={(event) => {
                      setGenreInput(event.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    onKeyDown={handleGenreKeyDown}
                  />
                  <span>Enter to add</span>

                  {showSuggestions && filteredSuggestions.length > 0 && (
                    <div className="genre-suggestions">
                      {filteredSuggestions.map((genre) => (
                        <button key={genre} type="button" onClick={() => addGenre(genre)}>
                          {genre}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="quick-picks">
                  <p>Popular picks</p>
                  <div className="genre-chips">
                    {GENRE_SUGGESTIONS.filter((genre) => !prefs.genres.includes(genre)).slice(0, 16).map((genre) => (
                      <button key={genre} className="chip" onClick={() => addGenre(genre)}>{genre}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pref-card">
                <h3><Zap size={18} /> Reading pace</h3>
                <div className="genre-chips">
                  {PACE.map((pace) => (
                    <button
                      key={pace}
                      className={`chip${prefs.pace === pace ? " selected" : ""}`}
                      aria-pressed={prefs.pace === pace}
                      onClick={() => setPrefs((current) => ({ ...current, pace }))}
                    >
                      {pace}
                    </button>
                  ))}
                </div>

                <div className="sub-preference">
                  <h4><FileText size={18} /> Book length</h4>
                  <div className="genre-chips">
                    {LENGTH.map((length) => (
                      <button
                        key={length}
                        className={`chip${prefs.length === length ? " selected" : ""}`}
                        aria-pressed={prefs.length === length}
                        onClick={() => setPrefs((current) => ({ ...current, length }))}
                      >
                        {length}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="pref-column">
              <div className="pref-card">
                <h3><Star size={18} /> Favourite authors</h3>
                <div className="form-group">
                  <label className="form-label" htmlFor="home-authors">Authors you love</label>
                  <textarea
                    id="home-authors"
                    className="form-textarea"
                    placeholder="e.g. Kazuo Ishiguro, Donna Tartt, Neil Gaiman"
                    value={prefs.authors}
                    onChange={(event) => setPrefs((current) => ({ ...current, authors: event.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="home-loved-books">Books you have loved</label>
                  <textarea
                    id="home-loved-books"
                    className="form-textarea"
                    placeholder="e.g. The Secret History, Never Let Me Go"
                    value={prefs.loved}
                    onChange={(event) => setPrefs((current) => ({ ...current, loved: event.target.value }))}
                  />
                </div>
                <div className="form-group compact-form-group">
                  <label className="form-label">Minimum rating to recommend</label>
                  <div className="rating-row">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        className={`star${minRating >= rating ? " lit" : ""}`}
                        onClick={() => {
                          const nextRating = minRating === rating ? 0 : rating;
                          setMinRating(nextRating);
                          setPrefs((current) => ({ ...current, minRating: nextRating }));
                        }}
                        aria-label={`${rating} star minimum`}
                      >
                        <Star size={22} fill="currentColor" strokeWidth={1.6} />
                      </button>
                    ))}
                    <span>{minRating ? `${minRating}+ stars` : "Any"}</span>
                  </div>
                </div>
              </div>

              <div className="pref-card">
                <h3><FileText size={18} /> Import Goodreads data</h3>
                <p>Export your library from Goodreads, then upload the CSV here.</p>
                {csvFile ? (
                  <div className="file-success">
                    <CheckCircle size={20} />
                    <div>
                      <strong>{csvFile.name}</strong>
                      <span>{csvImportCount ? `${csvImportCount} books imported` : "Reading history imported"}</span>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`upload-zone${dragover ? " dragover" : ""}`}
                    role="button"
                    tabIndex={0}
                    aria-label="Upload Goodreads CSV"
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragover(true);
                    }}
                    onDragLeave={() => setDragover(false)}
                    onDrop={handleDrop}
                    onClick={() => fileRef.current.click()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        fileRef.current.click();
                      }
                    }}
                  >
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".csv"
                      className="hidden-file-input"
                      onChange={(event) => handleFile(event.target.files[0])}
                    />
                    <div className="upload-zone-icon"><FolderUp size={34} /></div>
                    <h4>{importing ? "Importing CSV" : "Drop your CSV here"}</h4>
                    <p>or <span className="browse-link">browse to upload</span></p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="prefs-actions">
            <button className="prefs-save-btn" onClick={() => persistPreferences("discover")}>
              <Sparkles size={18} /> Discover books by preference <ArrowRight size={16} />
            </button>
            <button className="prefs-save-btn prefs-save-btn-secondary prefs-scan-btn" onClick={() => persistPreferences("scanner")}>
              <Camera size={18} /> Scan a shelf instead <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}
