/**
 * SBBG Yatra 2026 – Travel Details Form
 * Custom vanilla JS (not Quform).
 *
 * Passenger lookup is isolated in findPassengersByPhone() so it can later
 * be swapped for a backend API without changing the rest of the UI.
 */

(function () {
  "use strict";

  /* =========================================================================
   * Constants – train / flight options from SBBG travel form reference
   * ========================================================================= */

  const ONWARD_TRAINS = {
    "12433": {
      label: "12433 – MAS NZM RAJ",
      arrivalStation: "NZM",
      arrivalDate: "24.10.2026",
      arrivalTime: "10:30 HRS",
    },
    "12269": {
      label: "12269 – MAS NZM DUR",
      arrivalStation: "NZM",
      arrivalDate: "24.10.2026",
      arrivalTime: "10:40 HRS",
    },
    "12615": {
      label: "12615 – GT EXP",
      arrivalStation: "NDLS",
      arrivalDate: "25.10.2026",
      arrivalTime: "05:10 HRS",
    },
    "12621": {
      label: "12621 – TN SF EXP",
      arrivalStation: "NDLS",
      arrivalDate: "25.10.2026",
      arrivalTime: "06:30 HRS",
    },
    "12625": {
      label: "12625 – KERALA EXP",
      arrivalStation: "NDLS",
      arrivalDate: "24.10.2026",
      arrivalTime: "13:30 HRS",
    },
    "12627": {
      label: "12627 – KARNATAKA EXP",
      arrivalStation: "NDLS",
      arrivalDate: "24.10.2026",
      arrivalTime: "09:00 HRS",
    },
    "22691": {
      label: "22691 – BLR RAJ",
      arrivalStation: "NZM",
      arrivalDate: "25.10.2026",
      arrivalTime: "05:30 HRS",
    },
    "12925": {
      label: "12925 – PASCHIM EXP",
      arrivalStation: "KKDE",
      arrivalDate: "24.10.2026",
      arrivalTime: "13:09 HRS",
    },
  };

  const RETURN_TRAINS = {
    "12190": {
      label: "12190 – MAHAKAUSHAL EXP (TO BOARD 12270 / MAS DURONTO AT GWALIOR)",
      shortLabel: "12190 – MAHAKAUSHAL EXP",
      departureStation: "MTJ",
      departureDate: "31.10.2026",
      departureTime: "14:50 HRS",
    },
    "16032": {
      label: "16032 – ANDAMAN EXP",
      shortLabel: "16032 – ANDAMAN EXP",
      departureStation: "MTJ",
      departureDate: "31.10.2026",
      departureTime: "16:05 HRS",
    },
    "12616": {
      label: "12616 – GT EXP",
      shortLabel: "12616 – GT EXP",
      departureStation: "MTJ",
      departureDate: "31.10.2026",
      departureTime: "17:45 HRS",
    },
    "12622": {
      label: "12622 – TN SF EXP",
      shortLabel: "12622 – TN SF EXP",
      departureStation: "AGC",
      departureDate: "31.10.2026",
      departureTime: "23:27 HRS",
    },
    "12626": {
      label: "12626 – KERALA EXP",
      shortLabel: "12626 – KERALA EXP",
      departureStation: "MTJ",
      departureDate: "31.10.2026",
      departureTime: "21:40 HRS",
    },
    "12628": {
      label: "12628 – KARNATAKA EXP",
      shortLabel: "12628 – KARNATAKA EXP",
      departureStation: "MTJ",
      departureDate: "31.10.2026",
      departureTime: "21:55 HRS",
    },
    "22692": {
      label: "22692 – BLR RAJ",
      shortLabel: "22692 – BLR RAJ",
      departureStation: "AGC",
      departureDate: "31.10.2026",
      departureTime: "21:47 HRS",
    },
    "12472": {
      label: "12472 – SWARAJ EXP",
      shortLabel: "12472 – SWARAJ EXP",
      departureStation: "MTJ",
      departureDate: "31.10.2026",
      departureTime: "23:25 HRS",
    },
  };

  const FLIGHT_HOUR_SLOTS = [
    { value: "12.00-13.00", label: "12.00 to 13.00 hrs" },
    { value: "13.01-14.00", label: "13.01 to 14.00 hrs" },
    { value: "14.01-15.00", label: "14.01 to 15.00 hrs" },
    { value: "15.01-16.00", label: "15.01 to 16.00 hrs" },
    { value: "16.01-17.00", label: "16.01 to 17.00 hrs" },
    { value: "17.01-18.00", label: "17.01 to 18.00 hrs" },
    { value: "18.01-19.00", label: "18.01 to 19.00 hrs" },
    { value: "19.01-20.00", label: "19.01 to 20.00 hrs" },
    { value: "20.01-21.00", label: "20.01 to 21.00 hrs" },
    { value: "21.00-22.00", label: "21.00 to 22.00 hrs" },
  ];

  const PHONE_DEBOUNCE_MS = 500;
  const ALREADY_SUBMITTED_MESSAGE =
    "Travel details have already been submitted for this mobile number.";

  function isFlightMode(mode) {
    return (
      mode === "flight" ||
      mode === "flight-own-drop" ||
      mode === "flight-trust-drop"
    );
  }

  function needsFlightFields(mode) {
    return mode === "flight";
  }

  /**
   * Public Google Apps Script Web App URL only.
   * Never put Google passwords, private keys, or OAuth secrets here.
   */
  const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbywnTn8Lkk81seiPvQ4P4kh6JzPjInuy8C1mlG35VPWBYubRA9e8T-rwWeRTlMsYK1O/exec';

  /* =========================================================================
   * App state
   * ========================================================================= */

  const state = {
    matchedPassengers: [],
    submissionType: null, // null | "single" | "common" | "separate"
    lookupToken: 0,
    submitting: false,
  };

  /* =========================================================================
   * DOM refs
   * ========================================================================= */

  const formEl = document.getElementById("sbbg-travel-form");
  const phoneInput = document.getElementById("registeredMobile");
  const emailInput = document.getElementById("emailAddress");
  const phoneStatus = document.getElementById("phone-status");
  const passengerResult = document.getElementById("passenger-result");
  const defaultTravelBlock = document.getElementById("default-travel-block");
  const commonYatrikasList = document.getElementById("common-yatrikas-list");
  const travelHost = document.getElementById("travel-details-host");
  const formMessage = document.getElementById("form-message");
  const successPanel = document.getElementById("success-panel");
  const submitAnotherBtn = document.getElementById("submit-another");
  const verifiedDetails = document.getElementById("verified-details");

  /* =========================================================================
   * Phone helpers
   * ========================================================================= */

  /**
   * Normalize a phone number for comparison.
   * Strips formatting and Indian country code 91; returns last 10 digits.
   */
  function normalizePhoneNumber(phone) {
    if (phone == null) return "";

    let s = String(phone).trim();
    if (s.endsWith(".0")) s = s.slice(0, -2);

    // Remove spaces, hyphens, brackets, parentheses, plus, and other non-digits
    const digits = s.replace(/\D/g, "");

    if (!digits) return "";

    // Handle Indian country code 91 (e.g. 919443425813 → 9443425813)
    if (digits.length >= 12 && digits.startsWith("91")) {
      return digits.slice(-10);
    }

    // If longer than 10 (other country codes / formatting leftovers), use last 10
    if (digits.length > 10) {
      return digits.slice(-10);
    }

    return digits;
  }

  function isValidTenDigitMobile(normalized) {
    return /^[6-9]\d{9}$/.test(normalized) || /^\d{10}$/.test(normalized);
  }

  /**
   * Lookup against local PASSENGER_DATA (from All Passengers List 07092026).
   *
   * @param {string} phone - raw or normalized phone
   * @returns {Promise<Array<{registrationNumber:string,name:string,phone:string}>>}
   */
  async function findPassengersByPhone(phone) {
    const normalized = normalizePhoneNumber(phone);
    if (!normalized || normalized.length < 10) {
      return [];
    }

    await delay(180);

    const source = Array.isArray(window.PASSENGER_DATA)
      ? window.PASSENGER_DATA
      : [];

    return source
      .filter(function (p) {
        const pNorm = p.normalizedPhone || normalizePhoneNumber(p.phone);
        return pNorm === normalized;
      })
      .map(function (p) {
        return {
          applicationNumber: p.applicationNumber || "",
          registrationNumber: p.registrationNumber,
          name: p.name,
          phone: p.phone,
        };
      });
  }

  function delay(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  /* =========================================================================
   * UI helpers
   * ========================================================================= */

  function show(el) {
    if (el) el.classList.remove("is-hidden");
  }

  function hide(el) {
    if (el) el.classList.add("is-hidden");
  }

  function setFormMessage(text, type) {
    if (!text) {
      formMessage.textContent = "";
      formMessage.className = "form-message is-hidden";
      return;
    }
    formMessage.textContent = text;
    formMessage.className =
      "form-message form-message--" + (type || "error");
  }

  function clearFieldErrors(root) {
    const scope = root || formEl;
    scope.querySelectorAll(".is-invalid").forEach(function (el) {
      el.classList.remove("is-invalid");
    });
    scope.querySelectorAll(".field-error").forEach(function (el) {
      el.textContent = "";
    });
  }

  function setFieldError(inputEl, message) {
    if (!inputEl) return;
    inputEl.classList.add("is-invalid");
    const group = inputEl.closest(".field-group");
    if (!group) return;
    let err = group.querySelector(".field-error");
    if (!err) {
      err = document.createElement("p");
      err.className = "field-error";
      err.setAttribute("role", "alert");
      group.appendChild(err);
    }
    err.textContent = message;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function optionList(items, placeholder) {
    var html =
      '<option value="">' + escapeHtml(placeholder || "Please select") + "</option>";
    items.forEach(function (item) {
      html +=
        '<option value="' +
        escapeHtml(item.value) +
        '">' +
        escapeHtml(item.label) +
        "</option>";
    });
    return html;
  }

  /* =========================================================================
   * Reset / clear
   * ========================================================================= */

  function restoreDefaultTravelForm() {
    travelHost.innerHTML = "";
    hide(commonYatrikasList);
    commonYatrikasList.innerHTML = "";
    show(defaultTravelBlock);
    defaultTravelBlock.dataset.formMode = "single";
  }

  function clearPassengerLookup() {
    state.matchedPassengers = [];
    state.submissionType = null;
    passengerResult.innerHTML = "";
    restoreDefaultTravelForm();
    setFormMessage("");
    hide(verifiedDetails);
  }

  function resetEntireForm() {
    formEl.reset();
    clearPassengerLookup();
    phoneStatus.innerHTML = "";
    defaultTravelBlock.querySelectorAll(".mode-fields").forEach(function (el) {
      hide(el);
    });
    defaultTravelBlock.querySelectorAll(".train-info").forEach(function (el) {
      el.innerHTML = "";
      hide(el);
    });
    hide(successPanel);
    var successId = document.getElementById("success-submission-id");
    var successTitle = document.getElementById("success-title");
    var successBody = document.getElementById("success-body");
    if (successId) successId.textContent = "";
    if (successTitle) {
      successTitle.textContent = "Travel details submitted successfully.";
    }
    if (successBody) {
      successBody.textContent =
        "Thank you. Your travel details for Srimad Bhagavata Bhagavad Gita Yatra 2026 have been recorded.";
    }
    show(formEl);
    phoneInput.focus();
  }

  /* =========================================================================
   * Phone input handling
   * ========================================================================= */

  let debounceTimer = null;

  function handlePhoneInput() {
    const raw = phoneInput.value;
    const normalized = normalizePhoneNumber(raw);

    // Clear previous passenger match when phone changes; keep the main form visible
    clearPassengerLookup();
    phoneStatus.innerHTML = "";

    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    // Incomplete – wait for more digits
    if (normalized.length < 10) {
      return;
    }

    // Too long after normalize shouldn't happen often; still attempt if 10
    if (normalized.length !== 10) {
      phoneStatus.innerHTML =
        '<p class="field-error">Please enter a valid 10-digit mobile number.</p>';
      return;
    }

    debounceTimer = setTimeout(function () {
      runPhoneLookup(normalized);
    }, PHONE_DEBOUNCE_MS);
  }

  async function runPhoneLookup(normalizedPhone) {
    const token = ++state.lookupToken;

    phoneStatus.innerHTML =
      '<div class="loading-row"><span class="spinner" aria-hidden="true"></span>' +
      "<span>Checking registered mobile number...</span></div>";

    try {
      const matches = await findPassengersByPhone(normalizedPhone);

      // Stale response (user typed again)
      if (token !== state.lookupToken) return;

      phoneStatus.innerHTML = "";
      state.matchedPassengers = matches;
      renderPassengerResult(matches);

      if (matches && matches.length) {
        const already = await checkPhoneAlreadySubmitted(
          registeredPhoneFromMatches(matches, normalizedPhone)
        );
        if (token !== state.lookupToken) return;
        if (already) {
          renderAlreadySubmitted();
        }
      }
    } catch (err) {
      if (token !== state.lookupToken) return;
      phoneStatus.innerHTML =
        '<p class="field-error">Unable to check the mobile number. Please try again.</p>';
      console.error(err);
    }
  }

  /* =========================================================================
   * Passenger result rendering
   * ========================================================================= */

  function renderPassengerResult(matches) {
    passengerResult.innerHTML = "";
    restoreDefaultTravelForm();

    if (!matches || matches.length === 0) {
      renderNoMatch();
      return;
    }

    if (matches.length === 1) {
      renderSingleYatrika(matches[0]);
      return;
    }

    renderMultipleYatrikas(matches);
  }

  function renderAlreadySubmitted() {
    hide(verifiedDetails);
    state.submissionType = null;
    passengerResult.innerHTML =
      '<div class="result-card result-card--error">' +
      '<p class="result-heading"><span class="result-mark" aria-hidden="true">✕</span> Already submitted</p>' +
      '<p class="result-body">' +
      escapeHtml(ALREADY_SUBMITTED_MESSAGE) +
      "</p>" +
      "</div>";
  }

  function renderNoMatch() {
    state.submissionType = null;
    hide(verifiedDetails);
    passengerResult.innerHTML =
      '<div class="result-card result-card--error">' +
      '<p class="result-heading"><span class="result-mark" aria-hidden="true">✕</span> No registered applicant found</p>' +
      '<p class="result-body">No registered Yatrika found for this mobile number. Please enter the registered mobile number used in the application.</p>' +
      "</div>";
  }

  function renderSingleYatrika(passenger) {
    state.submissionType = "single";
    defaultTravelBlock.dataset.formMode = "single";
    show(verifiedDetails);

    passengerResult.innerHTML =
      '<div class="result-card result-card--success">' +
      '<p class="result-heading"><span class="result-mark" aria-hidden="true">✓</span> Registered Yatrika Found</p>' +
      '<dl class="result-meta">' +
      "<div><dt>Yatrika Reg Number</dt><dd>" +
      escapeHtml(passenger.registrationNumber) +
      "</dd></div>" +
      "<div><dt>Yatrika Name</dt><dd>" +
      escapeHtml(passenger.name) +
      "</dd></div>" +
      "</dl></div>";
  }

  function renderMultipleYatrikas(passengers) {
    state.submissionType = null;
    show(verifiedDetails);

    var listHtml = passengers
      .map(function (p) {
        return (
          "<li><span class=\"reg\">" +
          escapeHtml(p.registrationNumber) +
          "</span> — " +
          escapeHtml(p.name) +
          "</li>"
        );
      })
      .join("");

    passengerResult.innerHTML =
      '<div class="result-card result-card--multi">' +
      '<p class="result-heading"><span class="result-mark" aria-hidden="true">✓</span> Multiple Yatrikas Found</p>' +
      '<p class="result-body">The following Yatrikas are registered with this mobile number:</p>' +
      '<ul class="yatrika-list">' +
      listHtml +
      "</ul>" +
      '<p class="multi-prompt">How would you like to submit the travel details?</p>' +
      '<div class="radio-group" role="radiogroup" aria-label="Submission type">' +
      '<label class="radio-option">' +
      '<input type="radio" name="submissionType" value="common" />' +
      "<span>Common</span></label>" +
      '<label class="radio-option">' +
      '<input type="radio" name="submissionType" value="separate" />' +
      "<span>Separate</span></label>" +
      "</div>" +
      '<p class="field-error" id="submission-type-error"></p>' +
      "</div>";

    passengerResult
      .querySelectorAll('input[name="submissionType"]')
      .forEach(function (radio) {
        radio.addEventListener("change", handleSubmissionTypeChange);
      });
  }

  function handleSubmissionTypeChange(event) {
    const value = event.target.value;
    state.submissionType = value;

    const err = document.getElementById("submission-type-error");
    if (err) err.textContent = "";

    if (value === "common") {
      showCommonTravelForm(state.matchedPassengers);
    } else if (value === "separate") {
      showSeparateTravelForms(state.matchedPassengers);
    }
  }

  /* =========================================================================
   * Travel form generation (Separate mode only; default form is in HTML)
   * ========================================================================= */

  function showCommonTravelForm(passengers) {
    travelHost.innerHTML = "";
    show(defaultTravelBlock);
    defaultTravelBlock.dataset.formMode = "common";
    commonYatrikasList.innerHTML =
      "<h3>Yatrikas included</h3><ul class=\"yatrika-list\">" +
      passengers
        .map(function (p) {
          return (
            "<li><span class=\"reg\">" +
            escapeHtml(p.registrationNumber) +
            "</span> — " +
            escapeHtml(p.name) +
            "</li>"
          );
        })
        .join("") +
      "</ul>";
    show(commonYatrikasList);
  }

  function showSeparateTravelForms(passengers) {
    hide(commonYatrikasList);
    commonYatrikasList.innerHTML = "";
    hide(defaultTravelBlock);
    travelHost.innerHTML = "";
    passengers.forEach(function (p, index) {
      travelHost.appendChild(createYatrikaTravelForm(p, index + 1));
    });
  }

  function createYatrikaTravelForm(passenger, index) {
    const prefix = "yatrika-" + index;
    const block = document.createElement("div");
    block.className = "travel-block";
    block.dataset.formPrefix = prefix;
    block.dataset.formMode = "separate";
    block.dataset.registrationNumber = passenger.registrationNumber;
    block.dataset.yatrikaName = passenger.name;

    const banner = document.createElement("div");
    banner.className = "yatrika-banner";
    banner.innerHTML =
      "<h3>Yatrika " +
      index +
      "</h3>" +
      "<p><strong>Registration Number:</strong> " +
      escapeHtml(passenger.registrationNumber) +
      "</p>" +
      "<p><strong>Name:</strong> " +
      escapeHtml(passenger.name) +
      "</p>";
    block.appendChild(banner);

    block.appendChild(buildJourneySection(prefix, "onward"));
    block.appendChild(buildJourneySection(prefix, "return"));
    return block;
  }

  function buildJourneySection(prefix, direction) {
    const isOnward = direction === "onward";
    const title = isOnward
      ? "Enter Your Onward Journey Details"
      : "Enter Your Return Journey Details";
    const modeId = prefix + "-" + direction + "TravelMode";
    const modeName = prefix + "-" + direction + "TravelMode";

    const panel = document.createElement("div");
    panel.className = "journey-panel";
    panel.dataset.direction = direction;
    panel.dataset.prefix = prefix;

    const modeOptions = isOnward
      ? '<option value="">Please select</option>' +
        '<option value="train">Train</option>' +
        '<option value="flight">Flight</option>' +
        '<option value="own">Own</option>'
      : '<option value="">Please select</option>' +
        '<option value="train">Train</option>' +
        '<option value="flight-own-drop">Flight – Will make own arrangement for drop</option>' +
        '<option value="flight-trust-drop">Flight - Trust to arrange to drop at an additional cost of Rs.500/- per each</option>' +
        '<option value="own">Own</option>';

    panel.innerHTML =
      '<h3 class="subsection-title">' +
      title +
      "</h3>" +
      '<div class="field-group">' +
      '<label class="field-label" for="' +
      modeId +
      '">' +
      (isOnward ? "Onward" : "Return") +
      ' Travel Mode <span class="required">*</span></label>' +
      '<select id="' +
      modeId +
      '" name="' +
      modeName +
      '" class="field-select travel-mode-select" data-direction="' +
      direction +
      '" data-prefix="' +
      prefix +
      '" required>' +
      modeOptions +
      "</select>" +
      '<p class="field-error"></p>' +
      (isOnward
        ? ""
        : '<p class="field-note trust-drop-note is-hidden">Trust will arrange drop for flights departing from <strong>New Delhi</strong> or <strong>Noida airports</strong> after <strong>6 pm only</strong>. Those departing from <strong>Ghaziabad airport</strong> have to make their <strong>own arrangements</strong> from Delhi airport.</p>') +
      "</div>" +
      '<div class="mode-fields is-hidden" data-mode-panel="train" data-direction="' +
      direction +
      '" data-prefix="' +
      prefix +
      '">' +
      buildTrainFields(prefix, direction) +
      "</div>" +
      '<div class="mode-fields is-hidden" data-mode-panel="flight" data-direction="' +
      direction +
      '" data-prefix="' +
      prefix +
      '">' +
      buildFlightFields(prefix, direction) +
      "</div>" +
      (isOnward
        ? '<div class="mode-fields is-hidden" data-mode-panel="own" data-direction="' +
          direction +
          '" data-prefix="' +
          prefix +
          '">' +
          '<p class="field-note">Those who are arriving on their own will have to directly come to the <strong>accomodation in Kurukshetra</strong>. The accommodation detail will be given by bus volunteer on 24th October. Those who are coming <strong>before 10 am on 24th October to New Delhi</strong> can select the matching time slots in Railway Stations. If you don\'t come on time, you will have to make your own arrangement to come to Kurukshetra.</p>' +
          "</div>"
        : "");

    return panel;
  }

  function buildTrainFields(prefix, direction) {
    const isOnward = direction === "onward";
    const selectId = prefix + "-" + direction + "Train";
    const trains = isOnward ? ONWARD_TRAINS : RETURN_TRAINS;
    const options = Object.keys(trains).map(function (key) {
      return { value: key, label: trains[key].label };
    });

    return (
      '<div class="field-group">' +
      '<label class="field-label" for="' +
      selectId +
      '">Train Number &amp; Name <span class="required">*</span></label>' +
      '<select id="' +
      selectId +
      '" name="' +
      selectId +
      '" class="field-select train-select" data-direction="' +
      direction +
      '" data-prefix="' +
      prefix +
      '">' +
      optionList(options, "Please select") +
      "</select>" +
      '<p class="field-error"></p>' +
      "</div>" +
      '<div id="' +
      prefix +
      "-" +
      direction +
      'TrainInfo" class="train-info is-hidden" data-train-info="' +
      direction +
      '" data-prefix="' +
      prefix +
      '"></div>'
    );
  }

  function buildFlightFields(prefix, direction) {
    const isOnward = direction === "onward";
    const flightId = prefix + "-" + direction + "FlightNumber";
    const destId = prefix + "-" + direction + "FlightDestination";
    const dateId = prefix + "-" + direction + "FlightDate";
    const timeId = prefix + "-" + direction + "FlightTime";

    if (isOnward) {
      return (
        '<p class="field-note"><strong>Kindly note:</strong> As mentioned in the form, flights arriving within the given time slots only will be accepted in the fields below. Those arriving by other timings to enter details under “own” in Travel mode above</p>' +
        '<div class="field-group">' +
        '<label class="field-label" for="' +
        flightId +
        '">Airways (Flight Number &amp; Name of Airways) <span class="required">*</span></label>' +
        '<input type="text" id="' +
        flightId +
        '" name="' +
        flightId +
        '" class="field-input" autocomplete="off" />' +
        '<p class="field-error"></p></div>' +
        '<div class="field-group">' +
        '<label class="field-label" for="' +
        destId +
        '">Arrival Destination <span class="required">*</span></label>' +
        '<select id="' +
        destId +
        '" name="' +
        destId +
        '" class="field-select onward-destination-select">' +
        '<option value="">Please select</option>' +
        '<option value="New Delhi">New Delhi</option>' +
        '<option value="Ghaziabad">Ghaziabad</option>' +
        '<option value="Noida">Noida</option>' +
        "</select>" +
        '<p class="field-error"></p>' +
        '<p class="field-note pickup-note is-hidden">Those who are arriving at <strong>Ghaziabad</strong> and <strong>Noida</strong> must come to any of the <strong>pick up points in New Delhi</strong></p>' +
        "</div>" +
        '<div class="field-group">' +
        '<label class="field-label" for="' +
        dateId +
        '">Arrival Date <span class="required">*</span></label>' +
        '<select id="' +
        dateId +
        '" name="' +
        dateId +
        '" class="field-select">' +
        '<option value="">Please select</option>' +
        '<option value="24-Oct-2026">24-Oct-2026</option>' +
        "</select>" +
        '<p class="field-error"></p></div>' +
        '<div class="field-group">' +
        '<label class="field-label" for="' +
        timeId +
        '">Arrival Hours <span class="required">*</span></label>' +
        '<select id="' +
        timeId +
        '" name="' +
        timeId +
        '" class="field-select">' +
        optionList(FLIGHT_HOUR_SLOTS) +
        "</select>" +
        '<p class="field-error"></p></div>'
      );
    }

    // Return flight – mirrors SBBG structure (departure from New Delhi)
    return (
      '<div class="field-group">' +
      '<label class="field-label" for="' +
      flightId +
      '">Airways (Flight Number &amp; Name of Airways) <span class="required">*</span></label>' +
      '<input type="text" id="' +
      flightId +
      '" name="' +
      flightId +
      '" class="field-input" autocomplete="off" />' +
      '<p class="field-error"></p></div>' +
      '<div class="field-group">' +
      '<label class="field-label" for="' +
      destId +
      '">Departure Airport <span class="required">*</span></label>' +
      '<select id="' +
      destId +
      '" name="' +
      destId +
      '" class="field-select">' +
      '<option value="">Please select</option>' +
      '<option value="New Delhi">New Delhi</option>' +
      "</select>" +
      '<p class="field-error"></p></div>' +
      '<div class="field-group">' +
      '<label class="field-label" for="' +
      dateId +
      '">Departure Date <span class="required">*</span></label>' +
      '<select id="' +
      dateId +
      '" name="' +
      dateId +
      '" class="field-select">' +
      '<option value="">Please select</option>' +
      '<option value="31-Oct-2026">31-Oct-2026</option>' +
      "</select>" +
      '<p class="field-error"></p></div>' +
      '<div class="field-group">' +
      '<label class="field-label" for="' +
      timeId +
      '">Departure Hours <span class="required">*</span></label>' +
      '<select id="' +
      timeId +
      '" name="' +
      timeId +
      '" class="field-select">' +
      optionList(FLIGHT_HOUR_SLOTS) +
      "</select>" +
      '<p class="field-error"></p></div>' +
      '<p class="field-note">Yatris traveling by Flights have to make their own arrangement to reach New Delhi Airport. Or if they inform Trust in advance, they will be dropped by the Trust by collecting additional charge.</p>'
    );
  }

  /* =========================================================================
   * Travel conditional logic (event delegation)
   * ========================================================================= */

  function setupTravelEventDelegation() {
    formEl.addEventListener("change", function (event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      if (target.classList.contains("travel-mode-select")) {
        const prefix = target.getAttribute("data-prefix");
        const direction = target.getAttribute("data-direction");
        handleTravelModeChange(prefix, direction, target.value);
      }

      if (target.classList.contains("train-select")) {
        const prefix = target.getAttribute("data-prefix");
        const direction = target.getAttribute("data-direction");
        if (direction === "onward") {
          updateOnwardTrainInfo(prefix, target.value);
        } else {
          updateReturnTrainInfo(prefix, target.value);
        }
      }

      if (target.classList.contains("onward-destination-select")) {
        updateOnwardDestinationNote(target);
      }
    });
  }

  function updateOnwardDestinationNote(selectEl) {
    const group = selectEl.closest(".field-group");
    if (!group) return;
    const note = group.querySelector(".pickup-note");
    if (!note) return;
    if (selectEl.value === "Ghaziabad" || selectEl.value === "Noida") {
      show(note);
    } else {
      hide(note);
    }
  }

  function handleTravelModeChange(prefix, direction, mode) {
    const panel = formEl.querySelector(
      '.journey-panel[data-prefix="' +
        prefix +
        '"][data-direction="' +
        direction +
        '"]'
    );
    if (!panel) return;

    panel.querySelectorAll(".mode-fields").forEach(function (el) {
      hide(el);
      // Clear values when hiding so stale data isn't submitted
      el.querySelectorAll("input, select").forEach(function (field) {
        field.value = "";
        field.classList.remove("is-invalid");
        field.removeAttribute("required");
      });
      el.querySelectorAll(".field-error").forEach(function (e) {
        e.textContent = "";
      });
      const info = el.querySelector(".train-info");
      if (info) {
        info.innerHTML = "";
        hide(info);
      }
    });

    if (mode === "train" || needsFlightFields(mode)) {
      const panelKey = mode === "train" ? "train" : "flight";
      const modePanel = panel.querySelector(
        '[data-mode-panel="' + panelKey + '"]'
      );
      if (modePanel) {
        show(modePanel);
        modePanel.querySelectorAll("input, select").forEach(function (field) {
          field.setAttribute("required", "required");
        });
        const pickup = modePanel.querySelector(".pickup-note");
        if (pickup) hide(pickup);
      }
    }

    if (mode === "own") {
      const ownPanel = panel.querySelector('[data-mode-panel="own"]');
      if (ownPanel) show(ownPanel);
    }

    const trustNote = panel.querySelector(".trust-drop-note");
    if (trustNote) {
      if (mode === "flight-trust-drop") {
        show(trustNote);
      } else {
        hide(trustNote);
      }
    }
  }

  function updateOnwardTrainInfo(prefix, trainKey) {
    const infoEl = document.getElementById(prefix + "-onwardTrainInfo");
    if (!infoEl) return;

    const train = ONWARD_TRAINS[trainKey];
    if (!train) {
      infoEl.innerHTML = "";
      hide(infoEl);
      return;
    }

    infoEl.innerHTML =
      "<h4>Arrival Information</h4>" +
      "<dl>" +
      "<dt>Train</dt><dd>" +
      escapeHtml(train.label) +
      "</dd>" +
      "<dt>Arrival Station</dt><dd>" +
      escapeHtml(train.arrivalStation) +
      "</dd>" +
      "<dt>Arrival Date</dt><dd>" +
      escapeHtml(train.arrivalDate) +
      "</dd>" +
      "<dt>Arrival Time</dt><dd>" +
      escapeHtml(train.arrivalTime) +
      "</dd>" +
      "</dl>";
    show(infoEl);
  }

  function updateReturnTrainInfo(prefix, trainKey) {
    const infoEl = document.getElementById(prefix + "-returnTrainInfo");
    if (!infoEl) return;

    const train = RETURN_TRAINS[trainKey];
    if (!train) {
      infoEl.innerHTML = "";
      hide(infoEl);
      return;
    }

    infoEl.innerHTML =
      "<h4>Departure Information</h4>" +
      "<dl>" +
      "<dt>Train</dt><dd>" +
      escapeHtml(train.shortLabel || train.label) +
      "</dd>" +
      "<dt>Departure Station</dt><dd>" +
      escapeHtml(train.departureStation) +
      "</dd>" +
      "<dt>Departure Date</dt><dd>" +
      escapeHtml(train.departureDate) +
      "</dd>" +
      "<dt>Departure Time</dt><dd>" +
      escapeHtml(train.departureTime) +
      "</dd>" +
      "</dl>";
    show(infoEl);
  }

  /* =========================================================================
   * Validation
   * ========================================================================= */

  function validateTravelSection(block) {
    const prefix = block.dataset.formPrefix;
    let valid = true;
    let firstInvalid = null;

    ["onward", "return"].forEach(function (direction) {
      const modeSelect = document.getElementById(
        prefix + "-" + direction + "TravelMode"
      );
      if (!modeSelect) return;

      const mode = modeSelect.value;
      if (!mode) {
        setFieldError(
          modeSelect,
          "Please select " + direction + " travel mode."
        );
        valid = false;
        if (!firstInvalid) firstInvalid = modeSelect;
        return;
      }

      if (mode === "own" || mode === "flight-own-drop" || mode === "flight-trust-drop") {
        return; // no further fields
      }

      if (mode === "train") {
        const trainSelect = document.getElementById(
          prefix + "-" + direction + "Train"
        );
        if (!trainSelect || !trainSelect.value) {
          setFieldError(trainSelect, "Please select Train Number & Name.");
          valid = false;
          if (!firstInvalid) firstInvalid = trainSelect;
        }
        return;
      }

      if (needsFlightFields(mode)) {
        const fields = [
          {
            id: prefix + "-" + direction + "FlightNumber",
            msg: "Please enter Airways (Flight Number & Name of Airways).",
          },
          {
            id: prefix + "-" + direction + "FlightDestination",
            msg:
              direction === "onward"
                ? "Please select Arrival Destination."
                : "Please select Departure Airport.",
          },
          {
            id: prefix + "-" + direction + "FlightDate",
            msg:
              direction === "onward"
                ? "Please select Arrival Date."
                : "Please select Departure Date.",
          },
          {
            id: prefix + "-" + direction + "FlightTime",
            msg:
              direction === "onward"
                ? "Please select Arrival Hours."
                : "Please select Departure Hours.",
          },
        ];

        fields.forEach(function (f) {
          const el = document.getElementById(f.id);
          if (!el || !String(el.value).trim()) {
            setFieldError(el, f.msg);
            valid = false;
            if (!firstInvalid) firstInvalid = el;
          }
        });
      }
    });

    return { valid: valid, firstInvalid: firstInvalid };
  }

  function getActiveTravelBlocks() {
    if (state.submissionType === "separate") {
      return Array.prototype.slice.call(
        travelHost.querySelectorAll(".travel-block")
      );
    }
    return [defaultTravelBlock];
  }

  function validateEntireForm() {
    clearFieldErrors();
    setFormMessage("");

    const normalized = normalizePhoneNumber(phoneInput.value);

    if (!normalized || normalized.length !== 10) {
      setFieldError(phoneInput, "Please enter a valid 10-digit mobile number.");
      setFormMessage("Please correct the highlighted fields before submitting.");
      phoneInput.focus();
      return false;
    }

    if (!state.matchedPassengers.length) {
      setFormMessage(
        "No registered Yatrika found for this mobile number. Please enter the registered mobile number used in the application."
      );
      phoneInput.focus();
      return false;
    }

    const email = emailInput.value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError(emailInput, "Please enter a valid email address.");
      setFormMessage("Please correct the highlighted fields before submitting.");
      emailInput.focus();
      return false;
    }

    if (
      state.matchedPassengers.length > 1 &&
      state.submissionType !== "common" &&
      state.submissionType !== "separate"
    ) {
      const err = document.getElementById("submission-type-error");
      if (err) {
        err.textContent = "Please choose Common or Separate.";
      }
      setFormMessage("Please choose how you would like to submit travel details.");
      const firstRadio = passengerResult.querySelector(
        'input[name="submissionType"]'
      );
      if (firstRadio) firstRadio.focus();
      return false;
    }

    const blocks = getActiveTravelBlocks();
    if (!blocks.length) {
      setFormMessage("Travel details are not available. Please try again.");
      return false;
    }

    let allValid = true;
    let firstInvalid = null;

    blocks.forEach(function (block) {
      const result = validateTravelSection(block);
      if (!result.valid) {
        allValid = false;
        if (!firstInvalid && result.firstInvalid) {
          firstInvalid = result.firstInvalid;
        }
      }
    });

    if (!allValid) {
      setFormMessage("Please complete all required travel fields.");
      if (firstInvalid) {
        if (typeof firstInvalid.scrollIntoView === "function") {
          firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        if (typeof firstInvalid.focus === "function") {
          firstInvalid.focus();
        }
      }
      return false;
    }

    return true;
  }

  /* =========================================================================
   * Collect & submit
   * ========================================================================= */

  function collectJourneyDetails(prefix, direction) {
    const modeSelect = document.getElementById(
      prefix + "-" + direction + "TravelMode"
    );
    const mode = modeSelect ? modeSelect.value : "";
    const details = { mode: mode };

    if (mode === "train") {
      const trainKey = document.getElementById(
        prefix + "-" + direction + "Train"
      ).value;
      const trainMeta =
        direction === "onward"
          ? ONWARD_TRAINS[trainKey]
          : RETURN_TRAINS[trainKey];

      details.train = {
        number: trainKey,
        name: trainMeta ? trainMeta.label : trainKey,
      };

      if (direction === "onward" && trainMeta) {
        details.arrival = {
          station: trainMeta.arrivalStation,
          date: trainMeta.arrivalDate,
          time: trainMeta.arrivalTime,
        };
      }
      if (direction === "return" && trainMeta) {
        details.departure = {
          station: trainMeta.departureStation,
          date: trainMeta.departureDate,
          time: trainMeta.departureTime,
        };
      }
    } else if (needsFlightFields(mode)) {
      const number = document.getElementById(
        prefix + "-" + direction + "FlightNumber"
      ).value.trim();
      const destination = document.getElementById(
        prefix + "-" + direction + "FlightDestination"
      ).value;
      const date = document.getElementById(
        prefix + "-" + direction + "FlightDate"
      ).value;
      const time = document.getElementById(
        prefix + "-" + direction + "FlightTime"
      ).value;

      details.flight = {
        numberAndName: number,
        destination: destination,
        date: date,
        timeSlot: time,
        timeSlotLabel: flightTimeLabel(direction, time),
      };
    }

    return details;
  }

  function flightTimeLabel(direction, value) {
    const list = FLIGHT_HOUR_SLOTS;
    for (let i = 0; i < list.length; i++) {
      if (list[i].value === value) return list[i].label;
    }
    return value || "";
  }

  function formatSubmissionType(type) {
    if (type === "common") return "Common";
    if (type === "separate") return "Separate";
    return "Single";
  }

  function createClientRequestId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return (
      "req-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 12)
    );
  }

  function mapYatriRecord(p) {
    const record = {
      registrationNumber: p.registrationNumber,
      name: p.name,
    };
    if (p.applicationNumber) {
      record.applicationNumber = p.applicationNumber;
    }
    return record;
  }

  function registeredPhoneFromMatches(matches, fallback) {
    if (matches && matches[0] && matches[0].phone) {
      const fromRecord = normalizePhoneNumber(matches[0].phone);
      if (fromRecord) {
        return fromRecord;
      }
    }
    return fallback || normalizePhoneNumber(phoneInput.value);
  }

  function collectFormData() {
    const phone = registeredPhoneFromMatches(
      state.matchedPassengers,
      normalizePhoneNumber(phoneInput.value)
    );
    const type = state.submissionType;
    const contact = {
      yatriName: state.matchedPassengers
        .map(function (p) {
          return p.name;
        })
        .filter(Boolean)
        .join(", "),
      email: emailInput.value.trim(),
    };

    const base = {
      clientRequestId: createClientRequestId(),
      yatriName: contact.yatriName,
      phone: phone,
      email: contact.email,
      submissionType: formatSubmissionType(type),
    };

    if (type === "single" || type === "common") {
      return Object.assign({}, base, {
        yatris: state.matchedPassengers.map(mapYatriRecord),
        travelDetails: {
          onward: collectJourneyDetails("group", "onward"),
          return: collectJourneyDetails("group", "return"),
        },
      });
    }

    const yatris = [];
    state.matchedPassengers.forEach(function (p, index) {
      const prefix = "yatrika-" + (index + 1);
      const record = mapYatriRecord(p);
      record.travelDetails = {
        onward: collectJourneyDetails(prefix, "onward"),
        return: collectJourneyDetails(prefix, "return"),
      };
      yatris.push(record);
    });

    return Object.assign({}, base, {
      yatris: yatris,
    });
  }

  function isAppsScriptConfigured() {
    return (
      typeof GOOGLE_APPS_SCRIPT_URL === "string" &&
      GOOGLE_APPS_SCRIPT_URL.indexOf("https://") === 0 &&
      GOOGLE_APPS_SCRIPT_URL.indexOf("YOUR_WEB_APP_URL") === -1
    );
  }

  /**
   * POST JSON to the Google Apps Script Web App.
   * text/plain avoids a CORS preflight; Apps Script still receives the body.
   */
  async function postToAppsScript(payload) {
    if (!isAppsScriptConfigured()) {
      const err = new Error("Google Apps Script URL is not configured.");
      err.code = "CONFIG";
      throw err;
    }

    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (parseErr) {
      throw new Error("Unexpected response from the server.");
    }
  }

  async function checkPhoneAlreadySubmitted(phone) {
    if (!isAppsScriptConfigured()) return false;
    try {
      const data = await postToAppsScript({
        action: "checkPhone",
        phone: phone,
      });
      return !!(data && data.alreadySubmitted);
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  async function submitTravelDetails(payload) {
    return postToAppsScript(payload);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (state.submitting) {
      return;
    }

    const submitBtn = document.getElementById("submitBtn");
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    if (!validateEntireForm()) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
      return;
    }

    state.submitting = true;
    setFormMessage("Submitting your travel details...", "info");

    try {
      const payload = collectFormData();
      const result = await submitTravelDetails(payload);

      if (result && result.alreadySubmitted) {
        renderAlreadySubmitted();
        setFormMessage(result.message || ALREADY_SUBMITTED_MESSAGE);
        return;
      }

      if (!result || result.success !== true) {
        throw new Error(
          (result && result.message) || "Unable to save the submission."
        );
      }

      showSuccessState(result, payload);
    } catch (err) {
      console.error(err);
      setFormMessage(
        "Unable to submit your travel details at this time.\n\nPlease try again."
      );
    } finally {
      state.submitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
    }
  }

  function showSuccessState(result, payload) {
    const titleEl = document.getElementById("success-title");
    const idEl = document.getElementById("success-submission-id");
    const bodyEl = document.getElementById("success-body");
    const submissionId = result && result.submissionId ? result.submissionId : "";
    const hadEmail = !!(payload && payload.email);
    const emailSent = !!(result && result.emailSent);

    if (titleEl) {
      titleEl.textContent = "Travel details submitted successfully.";
    }

    if (idEl) {
      idEl.textContent = submissionId ? "Submission ID: " + submissionId : "";
    }

    if (bodyEl) {
      if (hadEmail && emailSent) {
        bodyEl.textContent =
          "A copy of your submitted details has been sent to your email address.";
      } else if (hadEmail && result && result.emailError) {
        bodyEl.textContent =
          "Your details have been saved. A copy could not be sent to your email address.";
      } else {
        bodyEl.textContent =
          "Thank you. Your travel details for Srimad Bhagavata Bhagavad Gita Yatra 2026 have been recorded.";
      }
    }

    setFormMessage("");
    hide(formEl);
    show(successPanel);
    if (typeof successPanel.scrollIntoView === "function") {
      successPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  /* =========================================================================
   * Init
   * ========================================================================= */

  function init() {
    if (!Array.isArray(window.PASSENGER_DATA)) {
      console.warn(
        "PASSENGER_DATA not loaded. Phone lookup will return no matches."
      );
    }

    phoneInput.addEventListener("input", handlePhoneInput);
    phoneInput.addEventListener("blur", function () {
      const n = normalizePhoneNumber(phoneInput.value);
      if (phoneInput.value && n.length > 0 && n.length < 10) {
        phoneStatus.innerHTML =
          '<p class="field-error">Please enter a complete 10-digit mobile number.</p>';
      }
    });

    setupTravelEventDelegation();
    formEl.addEventListener("submit", handleSubmit);
    submitAnotherBtn.addEventListener("click", resetEntireForm);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Expose helpers for manual testing in console
  window.SBBGTravelForm = {
    normalizePhoneNumber: normalizePhoneNumber,
    findPassengersByPhone: findPassengersByPhone,
    collectFormData: collectFormData,
    getState: function () {
      return state;
    },
  };
})();
