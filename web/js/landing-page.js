/**
 * Landing Page - Swiper & Interactivity
 * Handles profile carousel swiper functionality
 */

// Global Configuration Safety Check
if (typeof JODII_CONFIG === 'undefined') {
    console.warn('JODII_CONFIG not found, using defaults');
    window.JODII_CONFIG = {
        API_BASE_URL: 'https://stgoapi.jodii.app',
        CONFIG_JSON_URL: 'https://stgimg.jodii.app/pwa/js/config.json',
        SUCCESS_STORY_ENDPOINTS: {
            'en': 'https://jodii.matrimonycdn.com/jodii/success/story/jodii_1_en.json'
        },
        APP_TYPE: '600',
        APP_VERSION: '7.0',
        DEFAULT_LANG: 'en'
    };
}

// Global Variables
let selectedProfile = "";
let isDropdownTouched = false;
let isOTPTouch = [];
let otpTimer;
let timeCountdown = 60;
let extraSpaceTimer = null;
let lastDropdownInteractionTime = 0;

/**
 * Open Popup by ID
 */
window.openPopup = function (id, type = '') {
    const overlay = document.getElementById("popupOverlay");
    const popups = document.querySelectorAll(".popup-container");

    if (!overlay) {
        console.error('Popup overlay not found');
        return;
    }

    if (id == "otpPopup") {
        document.querySelectorAll(".otp-inputs input").forEach(inp => {
            inp.value = ""
        })
        document.getElementById("otpError").innerText = "";

        document.querySelectorAll(".otp-inputs input").forEach(inp => {
            inp.classList.remove("error-border");
        });
    }

    if (id == "EnterMobile" && type == 'login') {
        document.getElementById("mobilepopup").value = "";
        document.getElementById("mobilePopupError").innerText = "";
        document.querySelectorAll(".mobile-field").forEach(h => h.classList.remove("error-border"));
    }
    const isAnyActive = document.querySelector(".popup-container.active");
    if (!isAnyActive) {
        window.history.pushState({ popup: id }, "");
    }

    // Close all popups first
    popups.forEach(p => p.classList.remove("active"));

    const targetPopup = document.getElementById(id);
    if (targetPopup) {
        targetPopup.classList.add("active");
        overlay.classList.add("active");
        document.body.style.overflow = "hidden";

        // ✅ AUTO FOCUS FOR OTP 1
        if (id === "otpPopup") {
            setTimeout(() => {
                document.getElementById("otp1")?.focus();
            }, 300);
        }
    } else {
        console.error(`Popup with id "${id}" not found`);
    }
};

/**
 * Handle hardware back button
 */
window.addEventListener('popstate', function (event) {
    const activePopup = document.querySelector(".popup-container.active");
    if (activePopup) {
        window.closePopup(false);
    }
});

/**
 * Close any active popup
 */
window.closePopup = function (shouldGoBack = true) {
    const overlay = document.getElementById("popupOverlay");
    const popups = document.querySelectorAll(".popup-container");
    isOTPTouch = [];
    if (popups) popups.forEach(p => p.classList.remove("active"));
    if (overlay) overlay.classList.remove("active");
    document.body.style.overflow = "";

    if (shouldGoBack && window.history.state && window.history.state.popup) {
        window.history.back();
    }
};

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    // Initialize UI Components
    initializeCardImageSwipers();
    setupDownloadButtonListeners();
    setupCloseButtonListeners();
    genrateDeviceId();
    // Initialize Popups & Overlays
    // const overlay = document.getElementById("popupOverlay");
    // if (overlay) {
    //     overlay.addEventListener("click", window.closePopup);
    // }

    // OTP Auto Focus Logic
    const inputs = document.querySelectorAll(".otp-inputs input");
    inputs.forEach((input, index) => {
        input.addEventListener("input", (e) => {
            const value = input.value;
            // Handle multi-digit input (e.g., from keyboard suggestion or autofill)
            if (value.length > 1) {
                preFillOTP(inputs, value);
                return;
            }
            if (value && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
        });

        input.addEventListener("keydown", (e) => {
            if (e.key === "Backspace" && !input.value && index > 0) {
                inputs[index - 1].focus();
            }
        });

        input.addEventListener('paste', function(event) {
            // ✅ Get pasted text
            const text = event.clipboardData.getData('text');
            console.log('Pasted value:', text);
            preFillOTP(inputs, text);
            event.preventDefault(); // Prevent default paste to avoid double entry
        });
    });

    function preFillOTP(elements, otpval) {
        if (otpval && elements?.length > 0) {
            // Clean the input (remove non-digits)
            const cleanVal = otpval.toString().replace(/\D/g, '').slice(0, elements.length);
            elements.forEach((input, index) => {
                input.value = cleanVal[index] || "";
            });
            // Focus the last filled input or the first empty one
            const lastFilledIdx = Math.min(cleanVal.length - 1, elements.length - 1);
            if (lastFilledIdx >= 0) {
                elements[lastFilledIdx].focus();
            }
        }
    }


    // Load success stories
    fetchAndRenderSuccessStories()
        .catch((error) => {
            console.error('Error while rendering success stories:', error);
        })
        .finally(() => {
            initializeCouplersCarouselSwiper();
        });
    // Load dynamic data
    // loadData();
    loadRegData();

    // Trigger validation for pre-filled mobile number
    // const mobileno = document.getElementById("mobileno");
    // if (mobileno && mobileno.value) {
    //     mobileno.dispatchEvent(new Event('input', { bubbles: true }));
    // }
});


// Fallback: Also initialize when window loads (for older browsers)
window.addEventListener('load', function () {
    // Initialize Bootstrap Tooltips (Vanilla JS)
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
});

/**
 * Initialize couples carousel swiper for mobile view
 * Shows couple cards in a horizontal carousel on mobile devices
 */
function initializeCouplersCarouselSwiper() {
    // Check Swiper library
    if (typeof Swiper === 'undefined') {
        console.error('❌ CRITICAL: Swiper library not loaded!');
        return;
    }

    // Get couples carousel swiper element
    const couplesCarouselElement = document.querySelector('.couples-carousel-swiper');

    if (!couplesCarouselElement) {
        console.warn('⚠ No .couples-carousel-swiper element found in DOM');
        return;
    }

    try {
        const couplesSwipers = new Swiper(couplesCarouselElement, {
            direction: 'horizontal',
            slidesPerView: 1.3,
            spaceBetween: 16,
            speed: 500,
            touchRatio: 1,
            grabCursor: true,

            // Pagination dots - disabled
            pagination: {
                el: '.couples-pagination',
                enabled: false,
            },

            // Breakpoints for responsive behavior
            breakpoints: {
                320: {
                    slidesPerView: 1.3,
                    spaceBetween: 12,
                },
                480: {
                    slidesPerView: 1.3,
                    spaceBetween: 16,
                },
                768: {
                    slidesPerView: 1.3,
                    spaceBetween: 16,
                },
            },
        });
    } catch (error) {
        console.error('❌ Error initializing couples carousel swiper:');
        console.error(`- Message: ${error.message}`);
        console.error(`- Stack: ${error.stack}`);
    }

}

/**
 * Get endpoint based on current language
 */
function getSuccessStoryEndpoint() {
    const currentLang = document.documentElement.lang || JODII_CONFIG.DEFAULT_LANG;
    const langCode = currentLang.split('-')[0]; // Handle 'en-US' format
    return JODII_CONFIG.SUCCESS_STORY_ENDPOINTS[langCode] || JODII_CONFIG.SUCCESS_STORY_ENDPOINTS['en'];
}

/**
 * Hide the happily married section
 */
function hideHappilyMarriedSection(desktopContainer, mobileContainer) {
    // Try to find and hide the section
    let section = desktopContainer?.closest('section');

    if (!section) {
        // If no section found, try finding by common parent divs
        section = desktopContainer?.closest('.married-section, [class*="married"], [class*="happily"]');
    }

    if (section) {
        section.style.display = 'none';
    } else {
        // Fallback: hide containers directly
        if (desktopContainer) desktopContainer.style.display = 'none';
        if (mobileContainer) mobileContainer.style.display = 'none';
        // Hide the header if it exists nearby
        const header = desktopContainer?.parentElement?.querySelector('.married-header');
        if (header) header.style.display = 'none';
    }
}

/**
 * Fetch and bind success story data in Happily Married section
 */
async function fetchAndRenderSuccessStories() {
    const endpoint = getSuccessStoryEndpoint();
    const desktopContainer = document.getElementById('marriedDesktopList');
    const mobileContainer = document.getElementById('marriedMobileList');

    if (!desktopContainer || !mobileContainer) {
        console.warn('Success story containers are not available on this page');
        return;
    }

    const response = await fetch(endpoint);
    if (!response.ok) {
        throw new Error(`Success story API failed with status ${response.status}`);
    }

    const result = await response.json();

    // Check for error response codes
    if (result?.RESPONSECODE === '0' && result?.ERRCODE === '1') {
        console.warn('API returned error - hiding happily married section');
        hideHappilyMarriedSection(desktopContainer, mobileContainer);
        return;
    }

    const stories = result?.SUCCESSSTORY;

    if (!Array.isArray(stories) || stories.length === 0) {
        console.warn('No success story data returned from API');
        hideHappilyMarriedSection(desktopContainer, mobileContainer);
        return;
    }

    const desktopStories = stories.slice(0, 3);
    const mobileStories = stories.slice(0, 3);

    desktopContainer.innerHTML = desktopStories
        .map((story) => {
            const names = buildCoupleName(story);
            // const displayName = truncateText(names, 45);
            const TimePosted = sanitizeText(story?.TimePosted) || 'Posted on : 14th Jan 2024';
            const image = getStoryImage(story);
            const district = sanitizeText(story?.DISTRICT)

            return `
                <div class="col-lg-4 col-md-6">
                    <div class="couple-card">
                        <img src="${image}" alt="${names}" class="couple-image">
                        <div class="couple-info">
                            <h5 class="name-truncate" >${names}</h5>
                            <p>${district}</p>
                            <p>${TimePosted}</p>
                        </div>
                    </div>
                </div>
            `;
        })
        .join('');

    mobileContainer.innerHTML = mobileStories
        .map((story) => {
            const names = buildCoupleName(story);
            // const displayName = truncateText(names, 40);
            const TimePosted = sanitizeText(story?.TimePosted) || 'Posted on : 14th Jan 2024';
            const image = getStoryImage(story);
            const district = sanitizeText(story?.DISTRICT)

            return `
                <div class="swiper-slide">
                    <div class="couple-card">
                        <img src="${image}" alt="${names}" class="couple-image">
                        <div class="couple-info">
                            <h5 class="name-truncate">${names}</h5>
                            <p>${district}</p>
                            <p>${TimePosted}</p>
                        </div>
                    </div>
                </div>
            `;
        })
        .join('');
}

function buildCoupleName(story) {
    const brideName = sanitizeText(story?.BrideName);
    const groomName = sanitizeText(story?.GroomName);
    const combined = [brideName, groomName].filter(Boolean).join(' & ');
    return combined || 'Happy Couple';
}

function getStoryImage(story) {
    const thumbImage = sanitizeText(story?.THUMBIMG);
    const photoImage = sanitizeText(story?.PHOTO?.[0]?.IMG);
    return thumbImage || photoImage || './assets/images/couple-1.jpg';
}

function truncateText(value, maxLength) {
    if (typeof value !== 'string') {
        return '';
    }

    if (value.length <= maxLength) {
        return value;
    }

    const trimmed = value.slice(0, Math.max(0, maxLength - 3)).trimEnd();
    return `${trimmed}...`;
}

function decodeHtmlEntities(value) {
    const textArea = document.createElement('textarea');
    textArea.innerHTML = value;
    return textArea.value;
}

function sanitizeText(value) {
    if (typeof value !== 'string') {
        return '';
    }

    // First decode HTML entities
    let decoded = decodeHtmlEntities(value);

    // Then sanitize dangerous characters (but not &)
    return decoded
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;')
        .trim();
}

/**
 * Initialize card image swipers
 * Creates horizontal swipers for profile card images without pagination bullets
 */
function initializeCardImageSwipers() {
    // Check Swiper library
    if (typeof Swiper === 'undefined') {
        return;
    }

    // Get all card image swipers
    const cardImageSwipers = document.querySelectorAll('.card-images-swiper');

    if (cardImageSwipers.length === 0) {
        console.warn('⚠ No .card-images-swiper elements found in DOM');
        return;
    }

    // Initialize each swiper individually
    cardImageSwipers.forEach((swiperElement, index) => {
        try {
            const swiper = new Swiper(swiperElement, {
                direction: 'horizontal',
                slidesPerView: 1,
                spaceBetween: 0,
                speed: 800,
                touchRatio: 1,
                shortSwipes: true,
                longSwipesMs: 200,
                longSwipesRatio: 0.5,
                watchSlidesProgress: true,
                grabCursor: true, // Show grab cursor on hover
                // Autoplay configuration
                autoplay: {
                    delay: 3000, // 3 seconds delay between slides
                    disableOnInteraction: false, // Continue autoplay after interaction
                    pauseOnMouseEnter: true, // Pause on hover
                    waitForTransition: true,
                },
                // Loop through slides - CRITICAL FOR INFINITE ROTATION
                loop: true,
                loopAdditionalSlides: 1,
                loopedSlides: 5,
                // No pagination bullets
                pagination: {
                    enabled: false,
                },
                // No navigation arrows for this swiper
                navigation: {
                    enabled: false,
                },
            });
        } catch (error) {
            console.error(`❌ Error initializing card image swiper :`);
        }
    });

}

/**
 * Dummy profile data (for demonstration)
 * This would typically come from an API
 */
const dummyProfiles = [
    {
        id: 1,
        name: 'Anjali',
        age: 26,
        location: 'Chennai, TN',
        image: '/assets/images/profile-1.jpg',
        about: 'Software engineer, loves reading and travel',
        interests: ['Reading', 'Travel', 'Cooking', 'Yoga'],
    },
    {
        id: 2,
        name: 'Deepika',
        age: 24,
        location: 'Bangalore, KA',
        image: '/assets/images/profile-2.jpg',
        about: 'Marketing professional with a passion for art',
        interests: ['Art', 'Music', 'Photography', 'Hiking'],
    },
    {
        id: 3,
        name: 'Pooja',
        age: 25,
        location: 'Coimbatore, TN',
        image: '/assets/images/profile-3.jpg',
        about: 'Doctor by profession, family-oriented',
        interests: ['Medicine', 'Family', 'Volunteering', 'Sports'],
    },
    {
        id: 4,
        name: 'Shriya',
        age: 23,
        location: 'Madurai, TN',
        image: '/assets/images/profile-4.jpg',
        about: 'Fashion enthusiast and entrepreneur',
        interests: ['Fashion', 'Entrepreneurship', 'Social Work', 'Dancing'],
    },
    {
        id: 5,
        name: 'Neha',
        age: 27,
        location: 'Delhi, DL',
        image: '/assets/images/profile-5.jpg',
        about: 'Architect with passion for innovation',
        interests: ['Architecture', 'Design', 'Travel', 'Photography'],
    },
    {
        id: 6,
        name: 'Ritika',
        age: 22,
        location: 'Pune, MH',
        image: '/assets/images/profile-6.jpg',
        about: 'College student pursuing engineering',
        interests: ['Technology', 'Sports', 'Movies', 'Gaming'],
    },
];

/**
 * Setup download button listeners to show QR code modal
 */
function setupDownloadButtonListeners() {
    // Get all download app buttons
    const downloadButtons = document.querySelectorAll('.btn-explore, .lang-download-btn, .btn-download-app, .mobile-download-btn');
    downloadButtons.forEach((button, index) => {
        button.addEventListener('click', function (e) {
            let isMobile = window.matchMedia("only screen and (max-width: 767px)").matches;
            // Prevent default navigation for all buttons
            if (isMobile) {
                document.body.click();
                return;
            } else {
                e.preventDefault();
                e.stopPropagation();

                // Show QR modal
                showQRModal();
            }
        });
    });
}

/**
 * Setup download button listeners to show QR code modal
 */
function setupCloseButtonListeners() {

    // Get all download app buttons
    const downloadButtons = document.querySelectorAll('.qr-modal-header');

    downloadButtons.forEach((button, index) => {
        button.addEventListener('click', function (e) {
            // Prevent default navigation for all buttons
            e.preventDefault();
            e.stopPropagation();

            // Show QR modal
            hideQRModal();
        });
    });
}

/**
 * Show QR Modal using Bootstrap
 */
function showQRModal() {
    const qrCodeModal = document.getElementById('qrCodeModal');
    if (qrCodeModal) {
        // Use Bootstrap's modal API
        const modal = new bootstrap.Modal(qrCodeModal, {
            backdrop: true,
            keyboard: false
        });
        modal.show();
    } else {
        console.error('QR Code modal element not found');
    }
}

function hideQRModal() {
    const qrCodeModal = document.getElementById('qrCodeModal');
    if (qrCodeModal) {
        // Use Bootstrap's modal API
        const modal = new bootstrap.Modal(qrCodeModal, {
            backdrop: true,
            keyboard: false
        });
        modal.hide();
    } else {
        console.error('QR Code modal element not found');
    }
}

// Tooltip handling (Vanilla JS fallback for dynamic clicks)
document.addEventListener('click', function (e) {
    const tooltipTrigger = e.target.closest('[data-bs-toggle="tooltip"]');
    if (!tooltipTrigger) {
        // Hide all tooltips if clicking outside
        const tooltips = document.querySelectorAll('.tooltip');
        tooltips.forEach(t => {
            const instance = bootstrap.Tooltip.getInstance(t);
            if (instance) instance.hide();
        });
    }
});

window.addEventListener('scroll', function () {
    const tooltips = document.querySelectorAll('.tooltip');
    tooltips.forEach(t => {
        const instance = bootstrap.Tooltip.getInstance(t);
        if (instance) instance.hide();
    });
}, { passive: true });

// PWA


// =============================
// DROPDOWN TOGGLE (profile + country)
// =============================
document.querySelectorAll(".dropdown-header, .country-header, .country-pop-header").forEach(header => {
    let lastToggleTime = 0;
    // Function to handle the toggle logic
    const handleToggle = function (e) {
        const now = Date.now();
        if (now - lastToggleTime < 300) return;
        lastToggleTime = now;
        lastDropdownInteractionTime = now;

        e.stopPropagation();

        // Close keyboard if open
        if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")) {
            document.activeElement.blur();
        }

        const parent = this.parentElement;
        const dropdown = parent.querySelector(".dropdown-list");

        const isOpen = dropdown.style.display === "block";

        // Close all dropdowns
        document.querySelectorAll(".dropdown-list").forEach(d => d.style.display = "none");
        document.querySelectorAll(".dropdown-header, .country-pop-header, .country-header")
            .forEach(h => h.classList.remove("active"));

        // Open current
        if (!isOpen) {
            dropdown.style.display = "block";
            this.classList.add("active");

            let selectedValue = "";

            // ✅ COUNTRY DROPDOWN
            if (parent.classList.contains("country-dropdown")) {
                selectedValue = document.getElementById("selectedCode").innerText.trim();
            }

            if (parent.classList.contains("popup")) {
                selectedValue = document.getElementById("selectedPopUpCode").innerText.trim();
            }

            // ✅ PROFILE DROPDOWN
            else if (parent.classList.contains("dropdown")) {
                selectedValue = document.getElementById("selectedOption").innerText.trim();
            }

            // apply highlight
            dropdown.querySelectorAll(".item-cc, .item, div").forEach(item => {

                let itemValue = item.querySelector(".ccode")?.innerText || item.innerText;

                if (itemValue.includes(selectedValue)) {
                    item.classList.add("selected");
                } else {
                    item.classList.remove("selected");
                }
            });

            // mark dropdown touched
            if (parent.classList.contains("dropdown")) {
                isDropdownTouched = true;
            }
        }
    };

    // Use mousedown/touchstart for immediate response before keyboard dismissal layout shifts
    // header.addEventListener("mousedown", handleToggle);
    header.addEventListener("touchstart", function (e) {
        handleToggle.call(this, e);
    });
});

// =============================
// OTP EDIT BUTTON FIX
// =============================
// Ensures the Edit button works even when the keyboard is open on mobile

document.addEventListener("touchstart", function (e) {
    const editBtn = e.target.closest(".otp-subtext .edit");
    if (editBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (document.activeElement) document.activeElement.blur();
        EditMobileno();
    }
}, true);

// =============================
// POPUP CLOSE BUTTON FIX
// =============================
// Ensures the Close button works even when the keyboard is open on mobile
document.addEventListener("touchstart", function (e) {
    const closeBtn = e.target.closest(".close-popup");
    if (closeBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (document.activeElement) document.activeElement.blur();
        closePopup();
    }
}, true);


// =============================
// SELECT OPTION
// =============================
document.addEventListener("click", function (e) {

    const item = e.target.closest(".dropdown-list div");
    if (!item) return;

    e.stopPropagation();

    const dropdown = item.closest(".dropdown-list");
    const parent = dropdown.parentElement;

    dropdown.querySelectorAll("div").forEach(i => i.classList.remove("selected"));
    item.classList.add("selected");

    // PROFILE
    if (parent.classList.contains("dropdown")) {
        parent.querySelector("#selectedOption").innerText = item.innerText;
        parent.querySelector("#selectedOption").classList.add("font-weight-500");

        selectedProfile = item.innerText;
        isDropdownTouched = false;

        document.getElementById("dropdownError").innerText = "";
        document.querySelector(".dropdown-header").classList.remove("error-border");
        document.querySelector("#lbl-created").classList.remove("display-none")
        document.querySelector("#lbl-created").classList.add("created-label")
    }

    // COUNTRY ✅ FIXED
    else if (parent.classList.contains("country-dropdown")) {

        const code = item.querySelector(".ccode")?.innerText || item.innerText;

        parent.querySelector("#selectedCode").innerText = code;

        // close dropdown (optional)
        dropdown.style.display = "none";
        parent.querySelector(".country-header")?.classList.remove("active");
    }
});
// Select option

function loadCreatedby(data) { //data['PROFILECREATED']
    let container = document.getElementById('dd-createdby');
    let content = '';
    for (const key of Object.keys(data)) {
        content += `<div class="item" id="${data[key]}" data-val="${key}" >${data[key]}</div>`;
    }
    container.innerHTML = content;

    container.addEventListener('click', (event) => {
        if (event.target.classList.contains('item')) {
            const Id = event.target.getAttribute('data-val');

            document.querySelector("#selectedOption").innerText = event.target.innerText;
            document.getElementById("createdby").value = Id;

            // ✅ ADD THESE LINES (FIX)
            selectedProfile = event.target.innerText;
            isDropdownTouched = false;

            // ✅ REMOVE ERROR
            document.getElementById("dropdownError").innerText = "";
            document.getElementById("dropdown").classList.remove("error-border");

            // Existing logic
            if (['4', '5', '8', '9'].includes(Id?.toString())) {
                document.getElementById("gender").value = (Id == '4' || Id == '8') ? '1' : '0';
            } else {
                document.getElementById("gender").value = '';
            }
        }
    });
}
function loadCountryList(data) {
    let container = document.getElementById('dd-ccode');
    let containPopup = document.getElementById('countryDropdown');
    let content = '';

    for (const key of data) {
        content += `
            <div class="item-cc" 
                id="country-${key.VALUE}"
                data-val="${key.CCODE}" 
                data-key="${key.COUNTRYKEY}">             
                <span class="ccode">+${key.CCODE}</span>
                <span class="name">(${key.VALUE})</span>
            </div>`;
    }

    container.innerHTML = content;
    containPopup.innerHTML = content;

    // MAIN DROPDOWN
    container.addEventListener('click', (event) => {
        const item = event.target.closest('.item-cc');
        if (item) {
            const code = item.getAttribute('data-val');
            const key = item.getAttribute('data-key');
            const name = item.getAttribute('data-name');

            // ✅ Only code in input/header
            document.querySelector("#selectedCode").innerText = `+${code}`;

            // Hidden fields
            document.getElementById("ccode").value = code;
            document.getElementById("countrykey").value = key;
            // document.getElementById("countryname").value = name;
            document.getElementById("ccodepopup").value = code;
            // document.getElementById("countrynamepopup").value = name;
            document.getElementById("mobileno").focus();
            document.querySelectorAll(".mobile-field").forEach(h => h.classList.remove("error-border"));
            document.getElementById("mobileError").innerText = "";

            // Re-validate mobile number with new country code
            const event = new Event('input', { bubbles: true });
            document.getElementById("mobileno").dispatchEvent(event);
        }
    });

    // POPUP DROPDOWN
    containPopup.addEventListener('click', (event) => {
        const item = event.target.closest('.item-cc');
        if (item) {
            const code = item.getAttribute('data-val');
            const key = item.getAttribute('data-key');
            const name = item.getAttribute('data-name');

            document.querySelector("#selectedPopUpCode").innerText = `+${code}`;

            document.getElementById("ccodepopup").value = code;
            document.getElementById("countrykey").value = key;
            document.getElementById("ccode").value = code;
            // document.getElementById("countrynamepopup").value = name;
            // document.getElementById("countryname").value = name;
            document.getElementById("mobileno").focus();
            document.querySelectorAll(".mobile-field").forEach(h => h.classList.remove("error-border"));
            document.getElementById("mobileError").innerText = "";
        }
    });
}




// =============================
// OUTSIDE CLICK
// =============================
document.addEventListener("click", function () {
    // On mobile, dismissing the keyboard after tapping a dropdown can emit a
    // trailing click on the document. Ignore that immediate close signal.
    if (Date.now() - lastDropdownInteractionTime < 350) {
        return;
    }

    document.querySelectorAll(".dropdown-list").forEach(d => d.style.display = "none");
    document.querySelectorAll(".dropdown-header, .country-pop-header, .country-header")
        .forEach(h => h.classList.remove("active"));

    // dropdown validation on outside click
    if (isDropdownTouched && !selectedProfile) {
        showDropdownError();
    }
});


// =============================
// VALIDATION FUNCTIONS
// =============================

let currentLang = "en"; // dynamic

function showDropdownError() {
    currentLang = document.getElementById("language").value || 'en';
    const errorEl = document.getElementById("dropdownError");
    const dropdownEl = document.querySelector(".dropdown-header");
    let message = errorEl.getAttribute("data-" + currentLang)
        || errorEl.getAttribute("data-en");

    errorEl.innerText = message;
    dropdownEl.classList.add("error-border");
}

function validateDropdown() {
    if (!selectedProfile) {
        showDropdownError();
        return false;
    }

    // clear error when valid
    const errorEl = document.getElementById("dropdownError");
    const dropdownEl = document.getElementById("dropdown");

    errorEl.innerText = "";
    dropdownEl.classList.remove("error-border");

    return true;
}


function validateName() {
    const input = document.getElementById("name");
    const value = input.value.trim();
    const errorEl = document.getElementById("nameError");
    currentLang = document.getElementById("language").value || 'en';

    // Length validation
    if (value.length < 3) {
        let message = errorEl.getAttribute("data-" + currentLang)
            || errorEl.getAttribute("data-en");

        errorEl.innerText = message;
        input.classList.add("error-border");
        console.log("validateName length false");
        return false;
    }

    // Only letters validation
    const regex = /^[^`~!@#$%\^&*()_+={}|[\]\\:';"<>?,.0-9/]*$/;

    if (!regex.test(value)) {
        let message = errorEl.getAttribute("data-" + currentLang)
            || errorEl.getAttribute("data-en");

        errorEl.innerText = message;
        input.classList.add("error-border");
        console.log("validateName special char false");
        return false;
    }

    errorEl.innerText = "";
    input.classList.remove("error-border");
    return true;
}


function validateMobile(eleId = "mobileno") {
    const input = document.getElementById(eleId);
    const value = input.value.trim();
    let code = document.getElementById("ccode").value || '91';
    let regex = /^[0-9]{10}$/i;

    if (code === '91') {
        regex = /^[6-9][0-9]{9}$/i;
    } else {
        regex = /^[0-9]{8,10}$/i;
    }

    const errorEl = document.getElementById("mobileError");
    currentLang = document.getElementById("language").value || 'en';
    if (!regex.test(value)) {
        let message = errorEl.getAttribute("data-" + currentLang)
            || errorEl.getAttribute("data-en");

        errorEl.innerText = message;
        document.querySelectorAll(".mobile-field").forEach(h => h.classList.add("error-border"));
        return false;
    }

    errorEl.innerText = "";
    document.querySelectorAll(".mobile-field").forEach(h => h.classList.remove("error-border"));
    return true;
}

function limitPhoneInputToTenDigits(input) {
    if (!input) {
        return;
    }

    const digitsOnly = input.value.replace(/\D/g, '').slice(0, 10);
    if (input.value !== digitsOnly) {
        input.value = digitsOnly;
    }
}


// =============================
// BLUR VALIDATION
// =============================
document.getElementById("name").addEventListener("blur", function () {
    validateName();
});

document.getElementById("mobileno").addEventListener("blur", function () {
    validateMobile("mobileno");
});


// =============================
// INPUT (REMOVE ERROR LIVE)
// =============================
document.getElementById("name").addEventListener("input", function () {
    if (this.value.trim().length >= 3) {
        this.classList.remove("error-border");
        document.getElementById("nameError").innerText = "";
    }
});

document.getElementById("mobileno").addEventListener("input", function () {
    limitPhoneInputToTenDigits(this);
    const value = this.value.trim();
    const registerBtn = document.getElementById("registerBtn");
    const code = document.getElementById("ccode").value || '91';

    let isValid = false;
    if (code === '91') {
        // Starts with 6, 7, 8, or 9 and has exactly 10 digits
        isValid = /^[6-9][0-9]{9}$/.test(value);
    } else {
        // For other countries, allow 8 to 10 digits
        isValid = /^[0-9]{8,10}$/.test(value);
    }

    if (isValid) {
        document.querySelectorAll(".mobile-field").forEach(h => h.classList.remove("error-border"));
        document.getElementById("mobileError").innerText = "";
        if (registerBtn) registerBtn.disabled = false;
    } else {
        if (registerBtn) registerBtn.disabled = true;
    }
});



async function loadData() {
    try {
        const response = await fetch(JODII_CONFIG.CONFIG_JSON_URL); // Use centralized config URL
        const data = await response.json();
        const currentLang = document.getElementById("language").value;
        if (!currentLang) {
            currentLang = 'en';
        }
        bindToHtml(data[currentLang]);
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

function bindToHtml(data) {
    console.log(data);
    loadCreatedby(data['PROFILECREATEDBY']);
    loadCountryList(data['COUNTRYLIST']);

}

async function postData(url = '', data = {}) {
    const response = await fetch(url, {
        method: 'POST', // Specify the method
        headers: {
            'Content-Type': "application/x-www-form-urlencoded; charset=UTF-8", // Tell the server the data is JSON
        },
        body: new URLSearchParams(data) // Data must be stringified
    });

    if (!response.ok) {
        console.log(`HTTP error! status: ${response.status}`); // Manually check for errors
    }

    return await response.json(); // Parse the response body as JSON
}

async function getotpFunc(type = 'login') {
    document.getElementById("type").value = type;

    let mobileNo = '';
    let ccode = '';
    let lang = document.getElementById("language").value;

    if (type === 'login') {
        mobileNo = document.getElementById("mobilepopup").value;
        ccode = document.getElementById("ccodepopup").value;
        document.getElementById("mobileno").value = mobileNo;
        // document.getElementById("mobileno").dispatchEvent(new Event('input', { bubbles: true }));
        document.getElementById("ccode").value = ccode;
    } else {
        console.log("register");
        mobileNo = document.getElementById("mobileno").value;
        ccode = document.getElementById("ccode").value;
        document.getElementById("mobilepopup").value = mobileNo
        document.getElementById("ccodepopup").value = ccode;
        const isDropdownValid = validateDropdown();
        if (!isDropdownValid) return;
        const isNameValid = validateName();
        if (!isNameValid) return;
        const isMobileValid = validateMobile('mobileno');
        if (!isMobileValid) return;
    }

    let _postData = {
        MOBILENO: mobileNo,
        MCODE: ccode,
        NEWREG: 1,
        APPTYPE: JODII_CONFIG.APP_TYPE,
        LANG: lang,
        FROMPAGE: type
    };

    let url = `${JODII_CONFIG.API_BASE_URL}/login/loginapi/v1`;
    let response = await postData(url, _postData);

    console.log("OTP RESPONSE:", response);

    if ((response?.RESPONSECODE == '1' && response?.ERRCODE == '0')) {
        document.getElementById("spanMobile").innerText = ('+' + ccode + ' ' + mobileNo);
        document.getElementById("matriId").value = response?.RESPONSE?.MATRIID || '';
        document.getElementById("type").value = 'login';
        let limit = response?.RESPONSE?.OTPLIMIT || "5";
        localStorage.setItem('OTPLIMIT', limit);
        openPopup('otpPopup');
        startOtpTimer();
    } else if (response?.ERRCODE == "1" && response?.RESPONSECODE == "2" && response?.RESPONSE?.WEBVIEWURL) {
        ccode = response?.RESPONSE?.MCODE || ccode || '91';
        document.getElementById("spanMobile").innerText = ('+' + ccode + ' ' + mobileNo);
        document.getElementById("matriId").value = response?.RESPONSE?.MATRIID || '';
        let limit = response?.RESPONSE?.OTPLIMIT || "5";
        localStorage.setItem('OTPLIMIT', limit);
        document.getElementById("ccode").value = ccode;
        document.getElementById("ccodepopup").value = ccode;
        if (type == 'login') {
            document.getElementById("mobileno").value = mobileNo;
            document.getElementById("mobileno").dispatchEvent(new Event('input', { bubbles: true }));
            document.getElementById("type").value = 'register';
            document.getElementById("name").focus();
            closePopup();
        } else {
            partialRegistration();
            openPopup('otpPopup');
            startOtpTimer();
        }
    } else {
        if (response?.RESPONSE?.MSG) {
            document.getElementById("mobileError").innerText = response?.RESPONSE?.MSG;
            document.querySelectorAll(".mobile-field").forEach(h => h.classList.add("error-border"));
        }
        console.log("OTP FAILED", response);
    }
}

async function resend() {
    //https://stgoapi.jodii.app/login/resendotp/v1
    let url = `${JODII_CONFIG.API_BASE_URL}/login/resendotp/v1`;
    let matriId = document.getElementById("matriId").value || '';
    let mobileNo = document.getElementById("mobilepopup")?.value || document.getElementById("mobileno").value || '';
    let ccode = document.getElementById("ccodepopup").value;
    let lang = document.getElementById("language").value;
    let limit = localStorage.getItem('OTPLIMIT') || '5';
    let _postData = {
        ID: matriId,
        MOBILENO: mobileNo,
        MCODE: ccode,
        NEWREG: 1,
        APPTYPE: JODII_CONFIG.APP_TYPE,
        LANG: lang
    }
    if (limit > 0) {
        let response = await postData(url, _postData);
        limit = (parseInt(limit) - 1);
        if (limit <= 0) {
            limit = 0;
        }
        localStorage.setItem('OTPLIMIT', limit)
        console.log(response);
        startOtpTimer();
    }
}

async function submitotpFunc() {

    // ✅ FIX: get correct mobile (popup OR main)
    let mobileNo =
        document.getElementById("mobilepopup")?.value ||
        document.getElementById("mobileno")?.value || '';

    let matriId = document.getElementById("matriId").value || '';
    let ccode = document.getElementById("ccodepopup").value || document.getElementById("ccode").value;
    let type = document.getElementById("type").value || 'login';
    let countryKey = document.getElementById("countrykey").value;
    let createdby = document.getElementById("createdby").value;

    let lang = document.getElementById("language").value;

    // ✅ VALIDATE OTP BEFORE API
    let otp =
        document.getElementById("otp1").value +
        document.getElementById("otp2").value +
        document.getElementById("otp3").value +
        document.getElementById("otp4").value;

    if (otp.length !== 4 || !/^[0-9]{4}$/.test(otp)) {
        document.getElementById("otpError").innerText = "Please enter valid 4 digit OTP";

        document.querySelectorAll(".otp-inputs input").forEach(inp => {
            inp.classList.add("error-border");
        });

        return; // ⛔ STOP API CALL
    }
    let deviceId = genrateDeviceId();
    let _postData = {
        ID: matriId,
        OTP: otp,
        MOBILENO: mobileNo,
        MCODE: ccode,
        NEWREG: 1,
        APPTYPE: JODII_CONFIG.APP_TYPE,
        LANG: lang,
        REGISTERID: '',
        DEVICEDETAIL: '',
        APPVERSION: JODII_CONFIG.APP_VERSION,
        NALLOW: '0',
        DEVICEID: deviceId
    };
    document.getElementById('otp-section').style.display = 'none';
    document.getElementById('otp-loader').style.display = 'grid'
    let url = `${JODII_CONFIG.API_BASE_URL}/login/verifyotp/v1`;
    let response = await postData(url, _postData);

    console.log("OTP VERIFY RESPONSE:", response);
    document.querySelectorAll(".otp-inputs input").forEach(inp => {
        inp.value = '';
    });
    // ✅ SUCCESS
    if (response?.RESPONSECODE == '1' && response?.ERRCODE == '0') {
        setTimeout(() => {
            document.getElementById('otp-loader').style.display = 'none';
            document.getElementById('otp-section').style.display = 'block'
            document.getElementById("otpError").innerText = "";
        }, 1000);
        document.getElementById("matriId").value = response?.MATRIID || '';

        let data = { "ATN": response?.ATN, "RTN": response?.RTN, "FRM": "PWA", DEVICEID: deviceId, APPVERSION: "7.0" };
        let redirectUrl = '';

        if (type == 'register') {
            let name = document.getElementById("name").value;
            let gender = document.getElementById("gender").value;
            data = { "ATN": '', "RTN": '', "FRM": "PWA", DEVICEID: deviceId, APPVERSION: "7.0" }
            let data1 = {
                "MOBILENO": mobileNo,
                "CCODE": ccode,
                "COUNTRY": countryKey,
                "NAME": name,
                "GENDER": gender,
                "CREATEDBY": createdby,
                "REGISTER": '1'
            };
            this.openPopup('otpSuccess');
            setTimeout(() => {
                redirectUrl = response?.RESPONSE?.WEBVIEWURL + '/' + encodeURIComponent(JSON.stringify(data1)) + '/' + encodeURIComponent(JSON.stringify(data));
                redirectUrl = redirectUrl.replace('/jodiiapp/', '/jodii-pwa/');
                window.location.replace(redirectUrl);
            }, 2800);
        } else {
            redirectUrl = response?.RESPONSE?.WEBVIEWURL + '/' + encodeURIComponent(JSON.stringify(data));
            redirectUrl = redirectUrl.replace('/jodiiapp/', '/jodii-pwa/');
            window.location.replace(redirectUrl);
        }

    } else {
        let errorEl = document.getElementById("otpError");
        currentLang = document.getElementById("language").value || 'en';
        document.getElementById('otp-loader').style.display = 'none';
        document.getElementById('otp-section').style.display = 'block'
        // ❌ ERROR HANDLING (THIS WAS MISSING)
        errorEl.innerText = response?.MESSAGE || errorEl.getAttribute("data-" + currentLang);
        document.querySelectorAll(".otp-inputs input").forEach(inp => {
            inp.classList.add("error-border");
            inp.value = ""; // clear OTP
        });

        document.getElementById("otp1").focus();
    }
}
document.querySelectorAll(".otp-inputs input").forEach(input => {
    input.addEventListener("input", function () {
        document.getElementById("otpError").innerText = "";
        this.classList.remove("error-border");
    });
});


document.querySelectorAll("input").forEach((input, index, inputs) => {
    input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
            // Specific handling for Name and Mobile fields to trigger registration/login by clicking inbuilt enter
            if (this.id === "name" || this.id === "mobileno") {
                e.preventDefault();
                getotpFunc('register');
                return;
            }
            if (this.id === "mobilepopup") {
                e.preventDefault();
                handlePopupOtp();
                return;
            }

            e.preventDefault(); // stop form submit

            const nextInput = inputs[index + 1];
            if (nextInput) {
                nextInput.focus();
            }
        }
    });
});

// mobile number popup validation

function validateMobilePopup() {
    const input = document.getElementById("mobilepopup");
    const value = input.value.trim();
    let regex = /^[0-9]{10}$/;
    let code = document.getElementById("ccodepopup").value || '91';
    if (code != '91') {
        regex = /^[0-9]{8,10}$/i;
    }
    const errorEl = document.getElementById("mobilePopupError");
    currentLang = document.getElementById("language").value || 'en';
    // single condition handles both empty + invalid
    if (!regex.test(value)) {
        let message = errorEl.getAttribute("data-" + currentLang)
            || errorEl.getAttribute("data-en");

        errorEl.innerText = message;
        document.querySelectorAll(".mobile-field").forEach(h => h.classList.add("error-border"));
        return false;
    }

    errorEl.innerText = "";
    document.querySelectorAll(".mobile-field").forEach(h => h.classList.remove("error-border"));
    return true;
}

document.getElementById("mobilepopup")?.addEventListener("focus", function () {
    if (extraSpaceTimer) {
        clearTimeout(extraSpaceTimer);
        extraSpaceTimer = null;
    }
    document.getElementById("extraSpacePopup")?.classList.remove("display-none");
});

// document.getElementById("mobileno")?.addEventListener("focus", function () {
//     document.getElementById("extraSpaceMain")?.classList.remove("display-none");
// });

document.querySelectorAll(".otp-inputs input").forEach(input => {
    input.addEventListener("focus", function () {
        if (extraSpaceTimer) {
            clearTimeout(extraSpaceTimer);
            extraSpaceTimer = null;
        }
        document.getElementById("extraSpaceOTP")?.classList.remove("display-none");
    });
});



document.getElementById("mobilepopup")?.addEventListener("blur", function () {
    validateMobilePopup();
    extraSpaceTimer = setTimeout(() => {
        document.getElementById("extraSpacePopup")?.classList.add("display-none");
    }, 200);
});

// document.getElementById("mobileno")?.addEventListener("blur", function () {
//     document.getElementById("extraSpaceMain")?.classList.add("display-none");
// });

document.getElementById("mobilepopup")?.addEventListener("input", function () {
    limitPhoneInputToTenDigits(this);
    if (this.value.trim().length === 10) {
        document.querySelectorAll(".mobile-field").forEach(h => h.classList.remove("error-border"));
        document.getElementById("mobilePopupError").innerText = "";
    }
});
function handlePopupOtp() {
    if (!validateMobilePopup()) return false;

    getotpFunc('login'); // 👈 IMPORTANT
}


// otp Validation


function validateOTP(invalid = 0) {
    const o1 = document.getElementById("otp1").value.trim();
    const o2 = document.getElementById("otp2").value.trim();
    const o3 = document.getElementById("otp3").value.trim();
    const o4 = document.getElementById("otp4").value.trim();

    const otp = o1 + o2 + o3 + o4;

    const errorEl = document.getElementById("otpError");
    const inputs = document.querySelectorAll(".otp-inputs input");
    currentLang = document.getElementById("language").value || 'en';
    if (otp.length !== 4 || !/^[0-9]{4}$/.test(otp)) {
        let message = errorEl.getAttribute("data-" + currentLang)
            || errorEl.getAttribute("data-en");

        errorEl.innerText = message;

        inputs.forEach((inp, i) => {
            if (!inp.value && (isOTPTouch.includes(i) || invalid == 1)) {
                inp.classList.add("error-border")
            } else {
                isOTPTouch.push(i)
            }
        });
        return false;
    }

    errorEl.innerText = "";
    inputs.forEach(inp => inp.classList.remove("error-border"));

    return true;
}
function handleOtpSubmit() {
    if (!validateOTP(1)) return false;

    submitotpFunc();
}

document.querySelectorAll(".otp-inputs input").forEach((input, index, inputs) => {

    // ✅ Set attributes for better mobile experience and to allow pasting
    input.setAttribute('type', 'tel');
    input.setAttribute('inputmode', 'numeric');
    input.removeAttribute('maxlength');

    // Allow only numbers and handle multi-digit input (auto-fill / keyboard suggestion)
    input.addEventListener("input", function (e) {
        let val = this.value.replace(/[^0-9]/g, '');

        if (val.length > 1) {
            // Handle multi-character input (like auto-fill or fast typing)
            const digits = val.split("");
            digits.forEach((digit, i) => {
                if (index + i < inputs.length) {
                    inputs[index + i].value = digit;
                    inputs[index + i].classList.remove("error-border");
                }
            });
            // Focus the next empty input or the last one
            const nextFocusIndex = Math.min(index + digits.length, inputs.length - 1);
            inputs[nextFocusIndex].focus();
        } else {
            this.value = val.slice(0, 1);
            if (this.value.length === 1 && inputs[index + 1]) {
                inputs[index + 1].focus();
                inputs[index + 1].classList.remove("error-border");
            }
        }
        // remove error while typing
        document.getElementById("otpError").innerText = "";
        this.classList.remove("error-border");
    });

    // Explicitly handle Paste event for robustness
    input.addEventListener('paste', function (e) {
        e.preventDefault();
        const pasteData = (e.clipboardData || window.clipboardData).getData('text');
        const digits = pasteData.replace(/[^0-9]/g, '').split('');

        if (digits.length > 0) {
            digits.forEach((digit, i) => {
                if (index + i < inputs.length) {
                    inputs[index + i].value = digit;
                    inputs[index + i].classList.remove("error-border");
                }
            });
            // Focus the next empty input or the last one
            const nextFocusIndex = Math.min(index + digits.length, inputs.length - 1);
            inputs[nextFocusIndex].focus();
            document.getElementById("otpError").innerText = "";
        }
    });

    // Backspace & Enter handling
    input.addEventListener("keydown", function (e) {
        if (e.key === "Backspace" && !this.value && inputs[index - 1]) {
            inputs[index - 1].focus();
        }
        if (e.key === "Enter") {
            e.preventDefault();
            handleOtpSubmit();
        }
    });

});
document.querySelectorAll(".otp-inputs input").forEach(input => {
    input.addEventListener("blur", function () {
        validateOTP();
        extraSpaceTimer = setTimeout(() => {
            document.getElementById("extraSpaceOTP")?.classList.add("display-none");
        }, 200);
    });
});


const ac = new AbortController();
if ('OTPCredential' in window) {
    window.addEventListener('DOMContentLoaded', e => {
        navigator.credentials.get({
            otp: { transport: ['sms'] },
            signal: ac.signal
        }).then(otp => {
            try {
                console.log(otp.code)
               let letters = otp?.code ? otp?.code?.split('') : [];
                if (letters?.length > 3) {
                    document.querySelectorAll(".otp-inputs input").forEach((inp, index) => {
                        inp.value = letters[index];
                    });
                    handleOtpSubmit();
                }
            } catch (error) {
                console.log(error)
            }
        }).catch(err => {
            console.log(err)
        });
    })
} else {
    console.log('WebOTP not supported!.')
}
window.addEventListener('unload', (event) => {
    ac.abort();
})
function EditMobileno() {
    let type = document.getElementById("type").value;

    if (type == 'register') {
        closePopup();
        document.getElementById("mobileno").focus();
    } else {
        openPopup('EnterMobile', 'edit');
    }
}

async function loadRegData() {
    const currentLang = document.getElementById("language").value;
    // https://stgoapi.jodii.app/registrationform/v1?type=all&LANG=en&ccode=91&APPTYPE=300
    if (!currentLang) {
        currentLang = 'en';
    }
    let url = `${JODII_CONFIG.API_BASE_URL}/registrationform/v1`;
    let _postData = {
        "type": "all",
        "LANG": currentLang,
        "ccode": "91",
        "APPTYPE": "600"
    };
    let response = await postData(url, _postData); // Use centralized config URL

    if (response?.RESPONSE) {
        bindToHtml(response?.RESPONSE);
    } else {
        loadData();
    }
}

function pad(n) {
    return n < 10 ? '0' + n : n;
}

function formattedTime() {
    const minutes = Math.floor(timeCountdown / 60);
    const seconds = timeCountdown % 60;
    return `${pad(minutes)}:${pad(seconds)}`;
}

function startOtpTimer() {
    const resendBtn = document.getElementById("resendBtn");
    const timerText = document.getElementById("timerText");
    const otpResendDiv = document.getElementById("otpResendDiv");

    let limit = localStorage.getItem('OTPLIMIT') || '5';
    if (parseInt(limit) <= 0) {
        if (otpResendDiv) otpResendDiv.style.display = 'none';
        return;
    }

    if (otpResendDiv) otpResendDiv.style.display = 'block';
    if (resendBtn) resendBtn.style.display = 'none';
    if (timerText) timerText.style.display = 'inline';

    timeCountdown = 60;
    if (timerText) timerText.innerText = formattedTime();

    clearInterval(otpTimer);
    otpTimer = setInterval(() => {
        timeCountdown--;
        if (timerText) timerText.innerText = formattedTime();
        if (timeCountdown <= 0) {
            clearInterval(otpTimer);
            if (resendBtn) resendBtn.style.display = 'inline';
            if (timerText) timerText.style.display = 'none';
        }
    }, 1000);
}

function genrateDeviceId() {
    if (localStorage.getItem('DEVICEID')) {
        return localStorage.getItem('DEVICEID');
    } else {
        let deviceId = window.crypto.randomUUID();
        localStorage.setItem('DEVICEID', deviceId);
        return deviceId
    }
}

async function partialRegistration() {

    let ccode = document.getElementById("ccode").value || '91';
    let mobileNo = document.getElementById("mobileno").value || '';
    let countryKey = document.getElementById("countrykey").value;
    let createdby = document.getElementById("createdby").value;
    let name = document.getElementById("name").value;
    let gender = document.getElementById("gender").value;
    let _postData = {
        "CountryCode": ccode,
        "MobileNo": mobileNo,
        "ProfileCreatedBy": createdby,
        "Gender": gender,
        "Name": name,
        "MaritalStatus": "",
        "noofchildren": "",
        "EatingHabits": "",
        "physicalstatus": "",
        "Year": "",
        "Month": "",
        "Date": "",
        "Age": "",
        "Height": "",
        "MotherTongue": "",
        "country": countryKey,
        "City": "",
        "State": "",
        "NativeCountry": "",
        "NativeState": "",
        "NativeCity": "",
        "HomeState": "",
        "HomeCity": "",
        "Education": "",
        "Occupation": "",
        "MonthlyIncome": "",
        "IncomeCurrency": "",
        "Religion": "",
        "Caste": "",
        "SubCaste": "",
        "Gothram": "",
        "IpAddress": "",
        "DEVICEID": genrateDeviceId(),
        "REGISTERID": "",
        "DEVICEDETAILS": "",
        "APPVERSION": JODII_CONFIG.APPVERSION
    };
    let url = `${JODII_CONFIG.API_BASE_URL}/registration/partialreg/v1`;
    await postData(url, _postData);
}


