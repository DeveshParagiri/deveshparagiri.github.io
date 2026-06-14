document.addEventListener("DOMContentLoaded", () => {
  const toc = document.querySelector("d-article.has-distill-toc d-contents.distill-toc nav");
  if (!toc) return;

  const links = Array.from(toc.querySelectorAll('a[href^="#"]'));
  if (!links.length) return;

  const targets = links
    .map((link) => {
      const id = decodeURIComponent(link.hash.slice(1));
      return { link, heading: document.getElementById(id) };
    })
    .filter((item) => item.heading);

  if (!targets.length) return;

  const setActive = (activeLink) => {
    links.forEach((link) => {
      const isActive = link === activeLink;
      link.classList.toggle("active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  const activeFromScroll = () => {
    const offset = window.innerHeight * 0.25;
    const current = targets.reduce((active, item) => {
      return item.heading.getBoundingClientRect().top <= offset ? item : active;
    }, targets[0]);

    setActive(current.link);
  };

  links.forEach((link) => {
    link.addEventListener("click", () => setActive(link));
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];

        if (!visible) {
          activeFromScroll();
          return;
        }

        const item = targets.find((target) => target.heading === visible.target);
        if (item) setActive(item.link);
      },
      {
        rootMargin: "-20% 0px -65% 0px",
        threshold: 0,
      },
    );

    targets.forEach((item) => observer.observe(item.heading));
  }

  activeFromScroll();
  window.addEventListener("scroll", activeFromScroll, { passive: true });
});
