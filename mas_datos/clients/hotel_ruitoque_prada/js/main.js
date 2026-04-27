/**
 * main.js - Modern interactions for Hotel Ruitoque
 */

document.addEventListener('DOMContentLoaded', () => {

    /* 1. Navbar Scroll Effect
       ========================================================================== */
    const header = document.querySelector('.header');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    /* 2. Mobile Menu Toggle
       ========================================================================== */
    const navToggle = document.querySelector('.nav-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (navToggle) {
        navToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');

            // Toggle icons or animations if needed
            const spans = navToggle.querySelectorAll('span');
            spans.forEach(span => span.classList.toggle('active'));
        });
    }

    // Close menu when a link is clicked
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
        });
    });

    /* 3. Smooth Scroll Reveal (Intersection Observer)
       ========================================================================== */
    const revealOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const revealCallback = (entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('reveal-active');
            }
        });
    };

    const observer = new IntersectionObserver(revealCallback, revealOptions);

    // Elements to reveal
    const revealElements = document.querySelectorAll('.habitacion, .servicio, .section-header');
    revealElements.forEach(el => {
        el.classList.add('reveal-hidden');
        observer.observe(el);
    });

    /* 4. Lightbox functionality (Minimal)
       ========================================================================== */
    const galleryItems = document.querySelectorAll('.galeria-item');
    galleryItems.forEach(item => {
        item.addEventListener('click', () => {
            // Lightbox logic here
            console.log('Open image:', item.querySelector('img').src);
        });
    });

    /* 5. Date constraints for booking form
       ========================================================================== */
    const today = new Date().toISOString().split('T')[0];
    const checkInInput = document.querySelector('input[type="date"]:nth-of-type(1)');
    const checkOutInput = document.querySelector('input[type="date"]:nth-of-type(2)');

    if (checkInInput) {
        checkInInput.setAttribute('min', today);
        checkInInput.addEventListener('change', () => {
            checkOutInput.setAttribute('min', checkInInput.value);
        });
    }
});