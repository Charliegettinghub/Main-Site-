// Footer year
document.getElementById("year").textContent = new Date().getFullYear();

// Scroll-reveal (also fires immediately for hero content already in view)
const revealEls = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );
  revealEls.forEach((el) => observer.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add("is-visible"));
}

// Cursor-follow grid spotlight (skipped for touch / reduced motion)
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const hasFinePointer = window.matchMedia("(pointer: fine)").matches;

if (!prefersReducedMotion && hasFinePointer) {
  const root = document.documentElement;
  let raf = null;

  window.addEventListener("mousemove", (e) => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      root.style.setProperty("--mx", `${e.clientX}px`);
      root.style.setProperty("--my", `${e.clientY}px`);
      raf = null;
    });
  });
}

// Nav background intensifies after scrolling past hero
const nav = document.getElementById("nav");
window.addEventListener(
  "scroll",
  () => {
    nav.classList.toggle("nav--scrolled", window.scrollY > 80);
  },
  { passive: true }
);

// Print card photo carousels (Instagram-style swipe/dots/arrows)
const prefersReducedMotionForCarousel = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

document.querySelectorAll(".print-carousel").forEach((carousel) => {
  const track = carousel.querySelector(".print-carousel__track");
  const slides = Array.from(track.querySelectorAll(".print-carousel__slide"));
  const prevBtn = carousel.querySelector(".print-carousel__arrow--prev");
  const nextBtn = carousel.querySelector(".print-carousel__arrow--next");
  const dotsContainer = carousel.querySelector(".print-carousel__dots");

  if (slides.length < 2) return;

  track.tabIndex = 0;

  function scrollBehavior() {
    return prefersReducedMotionForCarousel ? "auto" : "smooth";
  }

  function currentIndex() {
    return Math.round(track.scrollLeft / track.clientWidth);
  }

  function setActiveDot(index) {
    dots.forEach((dot, i) => {
      dot.classList.toggle("is-active", i === index);
      dot.setAttribute("aria-selected", i === index);
    });
  }

  // Slides with a data-aspect hint (e.g. the Achievements feature card) resize
  // the carousel box to match each photo's own shape, so no letterboxing shows.
  function applyAspect(index) {
    const ratio = slides[index].dataset.aspect;
    if (ratio) carousel.style.aspectRatio = ratio;
  }
  applyAspect(0);

  function goToSlide(index) {
    track.scrollTo({ left: track.clientWidth * index, behavior: scrollBehavior() });
    applyAspect(index);
  }

  const dots = slides.map((_, index) => {
    const dot = document.createElement("button");
    dot.className = "print-carousel__dot";
    dot.setAttribute("role", "tab");
    dot.setAttribute("aria-selected", index === 0);
    dot.setAttribute("aria-label", `Photo ${index + 1} of ${slides.length}`);
    dot.addEventListener("click", () => goToSlide(index));
    dotsContainer.appendChild(dot);
    return dot;
  });
  dots[0].classList.add("is-active");

  prevBtn.addEventListener("click", () => goToSlide(Math.max(0, currentIndex() - 1)));
  nextBtn.addEventListener("click", () =>
    goToSlide(Math.min(slides.length - 1, currentIndex() + 1))
  );

  track.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") goToSlide(Math.max(0, currentIndex() - 1));
    if (e.key === "ArrowRight") goToSlide(Math.min(slides.length - 1, currentIndex() + 1));
  });

  let scrollRaf = null;
  let settleTimeout = null;
  track.addEventListener(
    "scroll",
    () => {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        setActiveDot(currentIndex());
        scrollRaf = null;
      });

      // Only resize the box once the swipe/scroll has settled — resizing
      // mid-drag (based on a still-changing rounded index) clips the photo
      // being dragged into view.
      clearTimeout(settleTimeout);
      settleTimeout = setTimeout(() => applyAspect(currentIndex()), 120);
    },
    { passive: true }
  );
});
