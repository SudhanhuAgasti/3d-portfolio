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
    frameExtension: '.webp',
    canvasId: '#hero-canvas',
    scrollerId: '#main',
    isMobile: window.innerWidth <= 768,
    // Senior Performance Strategy:
    // 1. Initial critical batch: Only wait for first 15 frames to achieve Instant First-Paint (<1s)
    // 2. High-priority keyframes: Next load every 5th frame for fast scrubbing
    // 3. Background stream with concurrency control (max 6 active requests) to prevent network choke
    criticalThreshold: 15,
    concurrencyLimit: 6,
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
   * 2. Smooth Scrolling Architecture (Modern Studio Freight Lenis)
   */
  let lenis = null;

  const initScrollEngine = () => {
    gsap.registerPlugin(ScrollTrigger);

    lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.2,
    });

    // Connect Lenis to GSAP ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });

    gsap.ticker.lagSmoothing(0);
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
   * Helper: Find best rendered frame (nearest loaded neighbor)
   * Prevents black frames or flickering while background assets stream in.
   */
  const getNearestLoadedImage = (targetIndex) => {
    if (images[targetIndex] && images[targetIndex].complete && images[targetIndex].naturalWidth > 0) {
      return images[targetIndex];
    }
    // Search backward
    for (let i = targetIndex - 1; i >= 0; i--) {
      if (images[i] && images[i].complete && images[i].naturalWidth > 0) {
        return images[i];
      }
    }
    // Search forward
    for (let i = targetIndex + 1; i < CONFIG.frameCount; i++) {
      if (images[i] && images[i].complete && images[i].naturalWidth > 0) {
        return images[i];
      }
    }
    return null;
  };

  /**
   * Draw Scaled Frame onto Canvas without Aggressive Zoom/Cropping
   */
  const render = () => {
    if (!canvas || !context) return;
    const currentImg = getNearestLoadedImage(imageSeq.frame);
    if (!currentImg) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const iw = currentImg.naturalWidth || currentImg.width;
    const ih = currentImg.naturalHeight || currentImg.height;

    if (!iw || !ih) return;

    const hRatio = cw / iw;
    const vRatio = ch / ih;
    
    // On desktop, clamp the scale so 1920x1080 3D character isn't blown up/zoomed excessively
    const isDesktop = window.innerWidth > 768;
    const ratio = isDesktop 
      ? Math.max(hRatio, vRatio * 0.95) 
      : Math.max(hRatio, vRatio);

    const shiftX = (cw - iw * ratio) / 2;
    const isMobilePortrait = window.innerWidth <= 768 && window.innerHeight > window.innerWidth;
    const shiftY = isMobilePortrait 
      ? (ch - ih * ratio) / 2 + (ch * 0.08) 
      : (ch - ih * ratio) / 2;

    context.fillStyle = '#06070a';
    context.fillRect(0, 0, cw, ch);
    context.drawImage(currentImg, 0, 0, iw, ih, shiftX, shiftY, iw * ratio, ih * ratio);
  };

  /**
   * Dismiss Preloader & Reveal Canvas Smoothly
   */
  let hasRevealedUI = false;
  const revealSite = () => {
    if (hasRevealedUI) return;
    hasRevealedUI = true;

    if (loaderStatus) loaderStatus.textContent = 'System Ready.';
    if (progressBar) progressBar.style.width = '100%';
    if (percentText) percentText.textContent = '100%';

    setTimeout(() => {
      if (loaderEl) {
        loaderEl.classList.add('is-loaded');
      }
      render();
      ScrollTrigger.refresh();
    }, 250);
  };

  /**
   * Preloader progress handler with Fast First-Paint Strategy
   */
  const onImageLoad = () => {
    loadedCount++;
    
    // Smooth progress indicator
    if (!hasRevealedUI) {
      const initialProgress = Math.min(Math.floor((loadedCount / CONFIG.criticalThreshold) * 100), 100);
      if (progressBar) progressBar.style.width = `${initialProgress}%`;
      if (percentText) percentText.textContent = `${initialProgress}%`;

      // Instant First Paint: As soon as the first critical batch (15 frames) is ready, unveil site!
      if (loadedCount >= CONFIG.criticalThreshold) {
        revealSite();
      }
    }
  };

  /**
   * Preload Image Sequence Asset Pipeline with Concurrency Pool & Keyframing
   * Engineered for instant TTI (Time to Interactive) & 0 network throttling.
   */
  const initAssetPipeline = () => {
    // 1. Initialize image objects slots
    for (let i = 0; i < CONFIG.frameCount; i++) {
      images[i] = new Image();
    }

    // 2. Prioritized loading order queue:
    // Priority 1: Critical initial batch (0 to 14) for instant hero paint
    // Priority 2: Keyframes spaced every 4 frames (scrubbing anchors across the entire page)
    // Priority 3: Remaining intermediate frames (fills in 60fps micro-steps)
    const priorityQueue = [];
    const queuedSet = new Set();

    // Priority 1: First 15 frames
    for (let i = 0; i < Math.min(CONFIG.criticalThreshold, CONFIG.frameCount); i++) {
      priorityQueue.push(i);
      queuedSet.add(i);
    }

    // Priority 2: Keyframes (every 4th frame)
    for (let i = 0; i < CONFIG.frameCount; i += 4) {
      if (!queuedSet.has(i)) {
        priorityQueue.push(i);
        queuedSet.add(i);
      }
    }

    // Priority 3: All remaining frames
    for (let i = 0; i < CONFIG.frameCount; i++) {
      if (!queuedSet.has(i)) {
        priorityQueue.push(i);
        queuedSet.add(i);
      }
    }

    // 3. Worker Pool with bounded concurrency (avoids HTTP/2 stream exhaustion)
    let activeWorkers = 0;
    let queueIndex = 0;

    const pumpQueue = () => {
      while (activeWorkers < CONFIG.concurrencyLimit && queueIndex < priorityQueue.length) {
        const frameIndex = priorityQueue[queueIndex++];
        activeWorkers++;

        const img = images[frameIndex];
        img.onload = () => {
          onImageLoad();
          activeWorkers--;
          pumpQueue();
        };
        img.onerror = () => {
          onImageLoad();
          activeWorkers--;
          pumpQueue();
        };
        img.src = getFramePath(frameIndex);
      }
    };

    // Kickstart worker pool
    pumpQueue();

    // Safety fallback: Never keep user stuck behind loader more than 2.5 seconds
    setTimeout(() => {
      revealSite();
    }, 2500);

    // Smooth Parallax Fade-Out for Hero Text as user scrolls down
    gsap.to('.hero-content-layer', {
      y: -120,
      opacity: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: '#hero',
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      },
    });

    // Scroll scrubbing animation across the entire document scroll
    gsap.to(imageSeq, {
      frame: CONFIG.frameCount - 1,
      snap: 'frame',
      ease: 'none',
      scrollTrigger: {
        trigger: document.body,
        start: 'top top',
        end: 'bottom bottom',
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

      if (isOpen) {
        drawer.removeAttribute('inert');
      } else {
        // Blur any focused element inside drawer before setting inert to avoid W3C accessibility warning
        if (drawer.contains(document.activeElement)) {
          document.activeElement.blur();
        }
        drawer.setAttribute('inert', '');
      }

      document.body.style.overflow = isOpen ? 'hidden' : '';
    };

    toggle.addEventListener('click', () => toggleDrawer());

    const scrollToSection = (targetId, offset = -70) => {
      if (!targetId || !targetId.startsWith('#')) return;
      const targetEl = document.querySelector(targetId);
      if (!targetEl) return;

      if (lenis) {
        lenis.scrollTo(targetEl, { offset: offset, duration: 1.2 });
        return;
      }

      // Fallback
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // Auto-close drawer on link click and trigger smooth scroll
    mobileLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href');
        toggleDrawer(false);
        setTimeout(() => scrollToSection(targetId, -60), 200);
      });
    });

    // Desktop nav smooth jump
    const desktopLinks = document.querySelectorAll('.nav-links a, .brand-link');
    desktopLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href');
        if (targetId && targetId.startsWith('#')) {
          e.preventDefault();
          scrollToSection(targetId, -70);
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
          start: 'top 88%',
          toggleActions: 'play none none reverse',
        },
      });
    });

    // 2. Sequential Stacking Containers (Projects, Skills, About, Experience)
    // Projects Stack: As each card scrolls up, the one below reveals and stacks over it
    const projectCards = document.querySelectorAll('.projects-showcase .project-card');
    projectCards.forEach((card) => {
      gsap.fromTo(
        card,
        {
          opacity: 0.8,
          y: 60,
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: card,
            start: 'top 85%',
            toggleActions: 'play none none reverse',
          },
        }
      );
    });

    const otherContainers = [
      '.about-grid',
      '.timeline-wrapper',
      '.skills-grid',
      '.edu-grid',
      '.contact-cta'
    ];

    otherContainers.forEach((containerSelector) => {
      const container = document.querySelector(containerSelector);
      if (!container) return;

      const cards = container.querySelectorAll('.glass-panel');
      if (!cards.length) return;

      // Sequential stagger entrance when user enters the section (Clean Y-axis translate only, no zoom/scale)
      gsap.fromTo(
        cards,
        {
          opacity: 0,
          y: 60,
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.85,
          stagger: 0.16,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: container,
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

    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeCanvas();
        ScrollTrigger.refresh();
      }, 150);
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
