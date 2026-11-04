(() => {
  "use strict";

  const GREEN = "#26fd75";
  const TOTAL_SIGNALS = 11;

  const SIGNALS = [
    { t: 2.8,  x: 49, y: 31, size: 72, glyph: "EYE",   fragment: "KEEP YOUR EYES OPEN" },
    { t: 5.7,  x: 68, y: 43, size: 68, glyph: "+",     fragment: "LOCAL SIGNAL DETECTED" },
    { t: 8.7,  x: 35, y: 48, size: 76, glyph: "D",     fragment: "DRIIA // VOICE + DNB", unlock: "DRIIA" },
    { t: 11.7, x: 72, y: 33, size: 69, glyph: "KH",    fragment: "KEEP HUSH // LIVE CAMERA", unlock: "KEEP HUSH" },
    { t: 14.6, x: 47, y: 61, size: 77, glyph: "N",     fragment: "NOLI // VIOLA + JUNGLE", unlock: "NOLI" },
    { t: 17.5, x: 29, y: 42, size: 70, glyph: "///",   fragment: "BREAKBEAT TRACE FOUND" },
    { t: 20.4, x: 71, y: 53, size: 73, glyph: "160",   fragment: "JUNGLE FREQUENCY // 160" },
    { t: 23.3, x: 42, y: 34, size: 67, glyph: "S",     fragment: "SPECTR TRANSMISSION" },
    { t: 26.2, x: 75, y: 64, size: 75, glyph: "REC",   fragment: "CAMERA STILL ROLLING" },
    { t: 29.2, x: 31, y: 56, size: 70, glyph: "20.11", fragment: "KARMEN CAMINA // 20.11" },
    { t: 32.2, x: 58, y: 38, size: 82, glyph: "GREEN", fragment: "FOLLOW THE GREEN" }
  ].map((signal, index) => ({ ...signal, id: index, duration: 1.2, status: "pending" }));

  const els = {
    intro: document.querySelector("#introScreen"),
    game: document.querySelector("#gameScreen"),
    result: document.querySelector("#resultScreen"),
    start: document.querySelector("#startButton"),
    replay: document.querySelector("#replayButton"),
    share: document.querySelector("#shareButton"),
    sound: document.querySelector("#soundToggle"),
    video: document.querySelector("#gameVideo"),
    stage: document.querySelector("#videoStage"),
    target: document.querySelector("#signalTarget"),
    glyph: document.querySelector("#signalGlyph"),
    feedback: document.querySelector("#feedback"),
    fragment: document.querySelector("#fragment"),
    resume: document.querySelector("#resumeButton"),
    score: document.querySelector("#scoreText"),
    hit: document.querySelector("#hitText"),
    lucidity: document.querySelector("#lucidityText"),
    combo: document.querySelector("#comboText"),
    progress: document.querySelector("#progressBar"),
    profile: document.querySelector("#profileTitle"),
    finalScore: document.querySelector("#finalScore"),
    finalSignals: document.querySelector("#finalSignals"),
    finalLucidity: document.querySelector("#finalLucidity"),
    resultCopy: document.querySelector("#resultCopy"),
    fragments: document.querySelector("#unlockedFragments"),
    story: document.querySelector("#storyCanvas")
  };

  const storyCtx = els.story.getContext("2d");
  let state;
  let raf = 0;
  let muted = false;
  let posterImage = new Image();
  posterImage.src = "assets/poster.jpg";

  function freshState() {
    SIGNALS.forEach(s => { s.status = "pending"; });
    return {
      playing: false,
      finished: false,
      score: 0,
      hits: 0,
      misses: 0,
      falseTaps: 0,
      combo: 0,
      maxCombo: 0,
      lucidity: 100,
      active: null,
      unlocked: new Set(),
      pausedByVisibility: false
    };
  }

  function switchScreen(name) {
    els.intro.hidden = name !== "intro";
    els.game.hidden = name !== "game";
    els.result.hidden = name !== "result";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function startGame() {
    cancelAnimationFrame(raf);
    state = freshState();
    updateHud();
    els.feedback.textContent = "";
    els.fragment.textContent = "";
    els.target.hidden = true;
    els.resume.hidden = true;
    els.stage.style.setProperty("--infection", "0");
    els.stage.style.setProperty("--darkness", "0");
    els.video.currentTime = 0;
    els.video.muted = muted;
    switchScreen("game");

    try {
      await els.video.play();
      state.playing = true;
      raf = requestAnimationFrame(gameLoop);
    } catch (_) {
      els.resume.hidden = false;
    }
  }

  function gameLoop() {
    if (!state?.playing || state.finished) return;
    const current = els.video.currentTime;
    // Le fichier WhatsApp original peut contenir une longue partie noire après le teaser.
    // La progression reste donc volontairement calculée sur les 38 secondes utiles.
    const duration = 38;
    els.progress.style.width = `${Math.min(100, current / duration * 100)}%`;

    for (const signal of SIGNALS) {
      if (signal.status === "pending" && current >= signal.t) showSignal(signal);
      if (signal.status === "visible" && current > signal.t + signal.duration) missSignal(signal);
    }

    if (current >= 37.65) finishGame();
    else raf = requestAnimationFrame(gameLoop);
  }

  function showSignal(signal) {
    signal.status = "visible";
    state.active = signal;
    els.target.style.setProperty("--x", `${signal.x}%`);
    els.target.style.setProperty("--y", `${signal.y}%`);
    els.target.style.setProperty("--size", `${signal.size}px`);
    els.glyph.textContent = signal.glyph;
    els.target.hidden = false;
  }

  function hitSignal(event) {
    event.stopPropagation();
    const signal = state?.active;
    if (!signal || signal.status !== "visible" || !state.playing) return;

    const reaction = Math.max(0, Math.min(1, (els.video.currentTime - signal.t) / signal.duration));
    const speedPoints = Math.round(600 * (1 - reaction));
    state.combo += 1;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    const multiplier = Math.min(3, 1 + Math.max(0, state.combo - 1) * .25);
    const earned = Math.round((400 + speedPoints) * multiplier);

    state.score += earned;
    state.hits += 1;
    state.lucidity = Math.min(100, state.lucidity + 2);
    signal.status = "hit";
    state.active = null;
    els.target.hidden = true;
    if (signal.unlock) state.unlocked.add(signal.unlock);

    showFeedback(`FOUND +${earned}`, false);
    showFragment(signal.fragment);
    updateHud();
  }

  function missSignal(signal) {
    signal.status = "missed";
    if (state.active?.id === signal.id) {
      state.active = null;
      els.target.hidden = true;
    }
    state.misses += 1;
    state.combo = 0;
    state.lucidity = Math.max(0, state.lucidity - 10);
    showFeedback("SIGNAL LOST", true);
    updateHud();
  }

  function falseTap(event) {
    if (!state?.playing || state.finished || event.target === els.target || els.target.contains(event.target)) return;
    state.falseTaps += 1;
    state.score = Math.max(0, state.score - 250);
    state.combo = 0;
    state.lucidity = Math.max(0, state.lucidity - 6);
    showFeedback("FALSE TRACE −250", true);
    updateHud();
  }

  function updateHud() {
    els.score.textContent = String(state?.score || 0).padStart(5, "0");
    els.hit.textContent = String(state?.hits || 0).padStart(2, "0");
    els.lucidity.textContent = `${state?.lucidity ?? 100}%`;
    const multiplier = Math.min(3, 1 + Math.max(0, (state?.combo || 0) - 1) * .25);
    els.combo.textContent = `×${multiplier.toFixed(2).replace(/0$/, "")}`;
    const infection = state ? state.hits / TOTAL_SIGNALS : 0;
    const darkness = state ? (100 - state.lucidity) / 100 : 0;
    els.stage.style.setProperty("--infection", infection.toFixed(2));
    els.stage.style.setProperty("--darkness", darkness.toFixed(2));
  }

  function showFeedback(text, bad) {
    els.feedback.textContent = text;
    els.feedback.className = `feedback${bad ? " bad" : ""}`;
    void els.feedback.offsetWidth;
    els.feedback.classList.add("show");
    window.setTimeout(() => {
      if (els.feedback.textContent === text) els.feedback.textContent = "";
    }, 760);
  }

  function showFragment(text) {
    els.fragment.textContent = text;
    els.fragment.className = "fragment";
    void els.fragment.offsetWidth;
    els.fragment.classList.add("show");
    window.setTimeout(() => {
      if (els.fragment.textContent === text) els.fragment.textContent = "";
    }, 1420);
  }

  function finishGame() {
    if (!state || state.finished) return;
    state.finished = true;
    state.playing = false;
    cancelAnimationFrame(raf);
    els.video.pause();
    els.target.hidden = true;

    let profile = "BLINKED TOO SOON";
    let copy = "L’image t’a échappé. Maintenant que tu connais les signes, recommence et garde les yeux ouverts.";
    if (state.hits >= 10) {
      profile = "GREEN SEER";
      copy = "Tu vois le vert avant même qu’il apparaisse. Aucun signal ne peut vraiment se cacher de toi.";
    } else if (state.hits >= 7) {
      profile = "SIGNAL HUNTER";
      copy = "Tes yeux suivent la transmission. Encore quelques traces et le message sera complet.";
    } else if (state.hits >= 4) {
      profile = "URBAN SLEEPWALKER";
      copy = "Tu as traversé les images entre lucidité et hallucination. Le vert commence à prendre le dessus.";
    }

    els.profile.textContent = profile;
    els.finalScore.textContent = state.score.toLocaleString("fr-FR");
    els.finalSignals.textContent = `${state.hits}/${TOTAL_SIGNALS}`;
    els.finalLucidity.textContent = `${state.lucidity}%`;
    els.resultCopy.textContent = copy;
    els.fragments.innerHTML = "";
    const unlocks = state.unlocked.size ? [...state.unlocked] : ["NO FRAGMENT"];
    unlocks.forEach(item => {
      const tag = document.createElement("span");
      tag.textContent = item;
      els.fragments.appendChild(tag);
    });

    drawStory(profile);
    switchScreen("result");
  }

  function drawStory(profile) {
    const c = storyCtx;
    c.fillStyle = "#050505";
    c.fillRect(0, 0, 1080, 1920);

    if (posterImage.complete) drawCover(c, posterImage, 0, 0, 1080, 1920);
    c.fillStyle = "rgba(0,0,0,.56)";
    c.fillRect(0, 0, 1080, 1920);
    c.fillStyle = "rgba(38,253,117,.28)";
    c.fillRect(0, 0, 1080, 1920);
    c.globalCompositeOperation = "color";
    c.fillStyle = GREEN;
    c.fillRect(0, 0, 1080, 1920);
    c.globalCompositeOperation = "source-over";

    c.strokeStyle = GREEN;
    c.lineWidth = 18;
    c.strokeRect(60, 65, 960, 1790);
    for (let y = 75; y < 1850; y += 13) {
      c.fillStyle = "rgba(255,255,255,.045)";
      c.fillRect(62, y, 956, 3);
    }

    c.fillStyle = GREEN;
    c.font = "900 30px monospace";
    c.fillText("SPECTR × KEEP HUSH", 95, 130);
    c.fillText("● REC", 835, 130);

    drawEye(c, 540, 545, 300);

    c.fillStyle = GREEN;
    c.font = "900 31px monospace";
    c.fillText("FOLLOW THE GREEN", 98, 940);
    c.fillStyle = "#f4f5ef";
    c.font = "900 105px Arial Black, Impact, sans-serif";
    drawWrapped(c, profile, 95, 1065, 880, 96);

    c.fillStyle = GREEN;
    c.font = "900 126px monospace";
    c.fillText(String(state.score).padStart(5, "0"), 92, 1390);
    c.fillStyle = "#f4f5ef";
    c.font = "900 28px monospace";
    c.fillText(`${state.hits}/11 SIGNALS  //  ${state.lucidity}% LUCIDITY`, 98, 1465);

    c.fillStyle = "rgba(0,0,0,.72)";
    c.fillRect(88, 1545, 904, 160);
    c.fillStyle = GREEN;
    c.font = "900 30px monospace";
    c.fillText("KARMEN CAMINA", 118, 1610);
    c.fillText("20.11.2026", 118, 1665);

    c.fillStyle = GREEN;
    c.fillRect(92, 1760, 896, 7);
    c.font = "900 22px monospace";
    c.fillText("DON’T BLINK. FOLLOW THE GREEN.", 98, 1820);
  }

  function drawCover(c, image, x, y, w, h) {
    const ratio = Math.max(w / image.width, h / image.height);
    const sw = w / ratio;
    const sh = h / ratio;
    const sx = (image.width - sw) / 2;
    const sy = (image.height - sh) / 2;
    c.drawImage(image, sx, sy, sw, sh, x, y, w, h);
  }

  function drawEye(c, x, y, size) {
    c.save();
    c.translate(x, y);
    c.strokeStyle = GREEN;
    c.lineWidth = 18;
    c.beginPath();
    c.moveTo(-size, 0);
    c.quadraticCurveTo(0, -size * .68, size, 0);
    c.quadraticCurveTo(0, size * .68, -size, 0);
    c.stroke();
    c.beginPath();
    c.arc(0, 0, size * .32, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = GREEN;
    c.beginPath();
    c.arc(0, 0, size * .13, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  function drawWrapped(c, text, x, y, maxWidth, lineHeight) {
    const words = text.split(" ");
    let line = "";
    let row = 0;
    words.forEach(word => {
      const test = `${line}${word} `;
      if (c.measureText(test).width > maxWidth && line) {
        c.fillText(line.trim(), x, y + row * lineHeight);
        line = `${word} `;
        row += 1;
      } else line = test;
    });
    c.fillText(line.trim(), x, y + row * lineHeight);
  }

  async function shareStory() {
    const blob = await new Promise(resolve => els.story.toBlob(resolve, "image/png"));
    if (!blob) return;
    const file = new File([blob], "spectr-follow-the-green.png", { type: "image/png" });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "FOLLOW THE GREEN",
          text: `J’ai trouvé ${state.hits}/11 signaux et marqué ${state.score} points.`
        });
      } else downloadStory(blob);
    } catch (error) {
      if (error?.name !== "AbortError") downloadStory(blob);
    }
  }

  function downloadStory(blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "spectr-follow-the-green.png";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    els.share.textContent = "STORY TÉLÉCHARGÉE";
  }

  function toggleSound() {
    muted = !muted;
    els.video.muted = muted;
    els.sound.textContent = muted ? "SOUND OFF" : "SOUND ON";
    els.sound.setAttribute("aria-pressed", String(muted));
  }

  async function resumeGame() {
    try {
      await els.video.play();
      state.playing = true;
      state.pausedByVisibility = false;
      els.resume.hidden = true;
      raf = requestAnimationFrame(gameLoop);
    } catch (_) {}
  }

  els.start.addEventListener("click", startGame);
  els.replay.addEventListener("click", startGame);
  els.share.addEventListener("click", shareStory);
  els.sound.addEventListener("click", toggleSound);
  els.target.addEventListener("pointerdown", hitSignal);
  els.stage.addEventListener("pointerdown", falseTap);
  els.resume.addEventListener("click", resumeGame);
  els.video.addEventListener("ended", finishGame);
  els.video.addEventListener("error", () => {
    els.resume.hidden = false;
    els.resume.textContent = "VIDÉO INTROUVABLE — RECHARGER";
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state?.playing && !state.finished) {
      els.video.pause();
      state.playing = false;
      state.pausedByVisibility = true;
    } else if (!document.hidden && state?.pausedByVisibility) {
      els.resume.hidden = false;
    }
  });

  state = freshState();
  updateHud();
})();
