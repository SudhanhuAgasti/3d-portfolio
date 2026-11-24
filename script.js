/**
 * ==============================================================================
 * PORTFOLIO CLIENT ARCHITECTURE
 * Author: Sudhanshu Kumar Agasti
 * Stack: Locomotive Scroll + GSAP ScrollTrigger + High-DPI HTML5 Canvas Sequencer
 * ==============================================================================
 */

'use strict';

(function () {
  // Global State & Configuration
  const CONFIG = {
    frameCount: 300,
    framePathPrefix: './male',
    frameExtension: '.png',
    canvasId: '#hero-canvas',
    scrollerId: '#main',
    isMobile: window.innerWidth <= 768,
  };

  /**
   * Helper: Pad frame indices (0 -> male0001.png)
   */
  const getFramePath = (index) => {
    const padded = String(index + 1).padStart(4, '0');
    return `${CONFIG.framePathPrefix}${padded}${CONFIG.frameExtension}`;
  };

  /**
   * 1. Initialize Icons (Lucide)
   */
  const initIcons = () => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  };

  /**
   * 2. Smooth Scrolling Architecture (Locomotive Scroll + ScrollTrigger Proxy)
   */
  let locoScroll = null;

  const initScrollEngine = () => {
    gsap.registerPlugin(ScrollTrigger);

    const scrollerEl = document.querySelector(CONFIG.scrollerId);
    if (!scrollerEl) return;

    // Initialize Locomotive
    locoScroll = new LocomotiveScroll({
      el: scrollerEl,
      smooth: true,
      smartphone: { smooth: false },
      tablet: { smooth: true },
      multiplier: 0.95,
    });

    locoScroll.on('scroll', ScrollTrigger.update);

    // ScrollTrigger Proxy Integration
    ScrollTrigger.scrollerProxy(CONFIG.scrollerId, {
      scrollTop(value) {
        return arguments.length
          ? locoScroll.scrollTo(value, 0, 0)
          : locoScroll.scroll.instance.scroll.y;
      },
      getBoundingClientRect() {
        return {
          top: 0,
          left: 0,
          width: window.innerWidth,
          height: window.innerHeight,
        };
      },
      pinType: scrollerEl.style.transform ? 'transform' : 'fixed',
    });

    // Sync on refresh
    ScrollTrigger.addEventListener('refresh', () => locoScroll.update());
  };

  /**
   * 3. Canvas Frame Sequence Engine
   */
  const canvas = document.querySelector(CONFIG.canvasId);
  const context = canvas ? canvas.getContext('2d', { alpha: false }) : null;

  const imageSeq = { frame: 0 };
  const images = [];
  let loadedCount = 0;

  // DOM Elements for Preloader
  const loaderEl = document.getElementById('loader');
  const progressBar = document.getElementById('loader-progress');
  const percentText = document.getElementById('loader-percent');
  const loaderStatus = document.getElementById('loader-status');

  /**
   * Resize Canvas with Device Pixel Ratio (Retina Display Sharpness)
   */
  const resizeCanvas = () => {
    if (!canvas || !context) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2 for GPU efficiency
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    render();
  };

  /**
   * Draw Cover-Scale Frame onto Canvas
   */
  const render = () => {
    if (!canvas || !context) return;
    const currentImg = images[imageSeq.frame];
    if (!currentImg || !currentImg.complete) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const iw = currentImg.naturalWidth || currentImg.width;
    const ih = currentImg.naturalHeight || currentImg.height;

    if (!iw || !ih) return;

    const hRatio = cw / iw;
    const vRatio = ch / ih;
    const ratio = Math.max(hRatio, vRatio);

    const shiftX = (cw - iw * ratio) / 2;
    const shiftY = (ch - ih * ratio) / 2;

    context.fillStyle = '#06070a';
    context.fillRect(0, 0, cw, ch);
    context.drawImage(currentImg, 0, 0, iw, ih, shiftX, shiftY, iw * ratio, ih * ratio);
  };

  /**
   * Preloader progress handler
   */
  const onImageLoad = () => {
    loadedCount++;
    const progress = Math.floor((loadedCount / CONFIG.frameCount) * 100);

    if (progressBar) progressBar.style.width = `${progress}%`;
    if (percentText) percentText.textContent = `${progress}%`;

    // Once 100% or sufficient frames are in memory, remove loader screen
    if (loadedCount >= CONFIG.frameCount) {
      if (loaderStatus) loaderStatus.textContent = 'System Ready.';
      setTimeout(() => {
        if (loaderEl) {
          loaderEl.classList.add('is-loaded');
        }
        render();
        ScrollTrigger.refresh();
      }, 350);
    }
  };

  /**
   * Preload Image Sequence Asset Pipeline
   */
  const initAssetPipeline = () => {
    for (let i = 0; i < CONFIG.frameCount; i++) {
      const img = new Image();
      img.onload = onImageLoad;
      img.onerror = onImageLoad;
      img.src = getFramePath(i);
      images.push(img);
    }

    // Smooth Parallax Fade-Out for Hero Text as user scrolls down
    gsap.to('.hero-content-layer', {
      y: -120,
      opacity: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: '#hero',
        start: 'top top',
        end: 'bottom top',
        scroller: CONFIG.scrollerId,
        scrub: true,
      },
    });

    // Scroll scrubbing animation across the entire document scroll
    gsap.to(imageSeq, {
      frame: CONFIG.frameCount - 1,
      snap: 'frame',
      ease: 'none',
      scrollTrigger: {
        trigger: CONFIG.scrollerId,
        start: 'top top',
        end: 'bottom bottom',
        scroller: CONFIG.scrollerId,
        scrub: 0.15,
      },
      onUpdate: render,
    });
  };

  /**
   * 4. Interactive Custom Cursor (Hardware Accelerated)
   */
  const initCustomCursor = () => {
    if (window.matchMedia('(hover: none)').matches) return;

    const cursorDot = document.querySelector('.cursor-dot');
    const cursorRing = document.querySelector('.cursor-ring');
    if (!cursorDot || !cursorRing) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      cursorDot.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
    }, { passive: true });

    // Smooth RAF trailing ring
    const renderCursor = () => {
      ringX += (mouseX - ringX) * 0.15;
      ringY += (mouseY - ringY) * 0.15;
      cursorRing.style.transform = `translate(${ringX}px, ${ringY}px)`;
      requestAnimationFrame(renderCursor);
    };
    requestAnimationFrame(renderCursor);

    // Hover state on links & interactive elements
    const interactives = document.querySelectorAll('a, button, .icon-btn, .tag-cloud li');
    interactives.forEach((el) => {
      el.addEventListener('mouseenter', () => document.body.classList.add('is-hovering'));
      el.addEventListener('mouseleave', () => document.body.classList.remove('is-hovering'));
    });
  };

  /**
   * 5. Mobile Navigation & Drawer Handling
   */
  const initNavigation = () => {
    const toggle = document.getElementById('mobile-toggle');
    const drawer = document.getElementById('mobile-drawer');
    const mobileLinks = document.querySelectorAll('.mobile-nav-link');

    if (!toggle || !drawer) return;

    const toggleDrawer = (open) => {
      const isOpen = open !== undefined ? open : !drawer.classList.contains('is-open');
      drawer.classList.toggle('is-open', isOpen);
      toggle.classList.toggle('is-active', isOpen);
      toggle.setAttribute('aria-expanded', String(isOpen));
      document.body.style.overflow = isOpen ? 'hidden' : '';
    };

    toggle.addEventListener('click', () => toggleDrawer());

    // Auto-close drawer on link click and trigger smooth scroll
    mobileLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href');
        toggleDrawer(false);

        if (locoScroll && targetId && targetId.startsWith('#')) {
          e.preventDefault();
          const targetEl = document.querySelector(targetId);
          if (targetEl) {
            locoScroll.scrollTo(targetEl, { offset: -60, duration: 1000 });
          }
        }
      });
    });

    // Desktop nav smooth jump
    const desktopLinks = document.querySelectorAll('.nav-links a');
    desktopLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href');
        if (locoScroll && targetId && targetId.startsWith('#')) {
          e.preventDefault();
          const targetEl = document.querySelector(targetId);
          if (targetEl) {
            locoScroll.scrollTo(targetEl, { offset: -70, duration: 900 });
          }
        }
      });
    });
  };

  /**
   * 6. ScrollTrigger Sequential Card Unfold & Stacking Deck Architecture
   */
  const initScrollReveals = () => {
    // 1. Section Header Reveals
    const headers = document.querySelectorAll('.section-header');
    headers.forEach((header) => {
      gsap.from(header, {
        opacity: 0,
        y: 40,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: header,
          scroller: CONFIG.scrollerId,
          start: 'top 88%',
          toggleActions: 'play none none reverse',
        },
      });
    });

    // 2. Sequential Stacking Containers (Projects, Skills, About, Experience)
    const cardContainers = [
      '.about-grid',
      '.timeline-wrapper',
      '.skills-grid',
      '.projects-showcase',
      '.edu-grid',
      '.contact-cta'
    ];

    cardContainers.forEach((containerSelector) => {
      const container = document.querySelector(containerSelector);
      if (!container) return;

      const cards = container.querySelectorAll('.glass-panel');
      if (!cards.length) return;

      // Sequential stagger entrance when user enters the section
      gsap.fromTo(
        cards,
        {
          opacity: 0,
          y: 70,
          scale: 0.94,
          rotateX: 6,
        },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          rotateX: 0,
          duration: 0.85,
          stagger: 0.16,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: container,
            scroller: CONFIG.scrollerId,
            start: 'top 82%',
            toggleActions: 'play none none reverse',
          },
        }
      );
    });
  };

  /**
   * Bootstrap Application Lifecycle
   */
  const bootstrap = () => {
    initIcons();
    initScrollEngine();
    resizeCanvas();
    initAssetPipeline();
    initCustomCursor();
    initNavigation();
    initScrollReveals();

    window.addEventListener('resize', () => {
      resizeCanvas();
      if (locoScroll) locoScroll.update();
    }, { passive: true });

    // Fallback safety: If preloader hangs for any reason, auto dismiss after 5s
    setTimeout(() => {
      if (loaderEl && !loaderEl.classList.contains('is-loaded')) {
        loaderEl.classList.add('is-loaded');
        render();
        ScrollTrigger.refresh();
      }
    }, 5000);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
