/**
 * SBBG Yatra 2026 – Travel Details
 * Google Apps Script backend (copy into Extensions → Apps Script)
 *
 * This file is NOT loaded by the website.
 *
 * ============================================================================
 * GOOGLE SHEETS SETUP
 * ============================================================================
 *
 * Step 1
 *   Create a Google Sheet named:
 *   SBBG Yatra 2026 – Travel Submissions
 *
 * Step 2
 *   Rename the first worksheet to:
 *   Submissions
 *
 * Step 3
 *   Put these headings in row 1 (the script can also create them if row 1 is empty):
 *
 *   Submission ID
 *   Submission Date
 *   Client Request ID
 *   Yatri Name
 *   Registered Mobile Number
 *   Email Address
 *   Submission Type
 *   Yatrika Application Number
 *   Yatrika Reg Number
 *   Yatrika Name
 *   Onward Travel Mode
 *   Onward Train / Flight Number & Name
 *   Onward Arrival Station / Destination
 *   Onward Arrival Date
 *   Onward Arrival Time
 *   Return Travel Mode
 *   Return Train / Flight Number & Name
 *   Return Departure Station / Destination
 *   Return Departure Date
 *   Return Departure Time
 *   Full Submission JSON
 *
 * Step 4
 *   Open: Extensions → Apps Script
 *
 * Step 5
 *   Delete any default code and paste THIS ENTIRE FILE.
 *
 * Step 6
 *   Keep the script bound to this spreadsheet (recommended).
 *   SpreadsheetApp.getActiveSpreadsheet() is used automatically.
 *   If you ever deploy from a standalone script, set SPREADSHEET_ID below.
 *
 * Step 7
 *   Deploy → New deployment → Type: Web app
 *     Description: SBBG Travel Form
 *     Execute as: Me
 *     Who has access: Anyone
 *   (The site needs "Anyone" so the browser can POST without Google login.
 *    The web app URL is public, but it only accepts valid travel payloads.)
 *
 * Step 8
 *   Copy the Web App URL.
 *
 * Step 9
 *   In script.js set:
 *     const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/..../exec';
 *
 * Step 10
 *   Submit a test from the form:
 *     - Confirm a row appears in Submissions
 *     - Confirm a Submission ID like SBBG-2026-00001
 *     - If Email Address was filled, confirm the confirmation email arrived
 *
 * After you change this Apps Script, Deploy → Manage deployments → Edit
 * → Version: New version → Deploy. Then keep the same URL in script.js.
 * ============================================================================
 */

var SPREADSHEET_ID = ""; // leave empty when this script is bound to the sheet
var SHEET_NAME = "Submissions";
var SUBMISSION_PREFIX = "SBBG-2026-";
var EMAIL_SUBJECT = "SBBG Yatra 2026 – Travel Details Submission Confirmation";
var EMAIL_FROM = "kinchitdharma@gmail.com";
var EMAIL_REPLY_TO = "kinchitdharmam@gmail.com";
var ALREADY_SUBMITTED_MESSAGE =
  "Travel details have already been submitted for this mobile number.";

var HEADERS = [
  "Submission ID",
  "Submission Date",
  "Client Request ID",
  "Yatri Name",
  "Registered Mobile Number",
  "Email Address",
  "Submission Type",
  "Yatrika Application Number",
  "Yatrika Reg Number",
  "Yatrika Name",
  "Onward Travel Mode",
  "Onward Train / Flight Number & Name",
  "Onward Arrival Station / Destination",
  "Onward Arrival Date",
  "Onward Arrival Time",
  "Return Travel Mode",
  "Return Train / Flight Number & Name",
  "Return Departure Station / Destination",
  "Return Departure Date",
  "Return Departure Time",
  "Full Submission JSON",
];

function doGet() {
  return jsonOutput_({
    success: false,
    message: "This web app accepts POST submissions only.",
  });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (lockErr) {
    return jsonOutput_({
      success: false,
      message: "Unable to save the submission.",
    });
  }

  try {
    var payload = parsePayload_(e);

    if (payload && payload.action === "checkPhone") {
      var checkSheet = getSubmissionsSheet_();
      var existingId = findSubmissionByPhone_(checkSheet, payload.phone);
      return jsonOutput_({
        success: true,
        alreadySubmitted: !!existingId,
        submissionId: existingId || "",
        message: existingId ? ALREADY_SUBMITTED_MESSAGE : "",
      });
    }

    var validation = validatePayload_(payload);
    if (!validation.ok) {
      return jsonOutput_({
        success: false,
        message: validation.message || "Unable to save the submission.",
      });
    }

    var sheet = getSubmissionsSheet_();
    var duplicateId = findDuplicateSubmissionId_(sheet, payload.clientRequestId);
    if (duplicateId) {
      return jsonOutput_({
        success: true,
        submissionId: duplicateId,
        emailSent: false,
        duplicate: true,
        message: "Travel details submitted successfully.",
      });
    }

    var phoneDuplicateId = findSubmissionByPhone_(sheet, payload.phone);
    if (phoneDuplicateId) {
      return jsonOutput_({
        success: false,
        alreadySubmitted: true,
        submissionId: phoneDuplicateId,
        message: ALREADY_SUBMITTED_MESSAGE,
      });
    }

    var submissionId = nextSubmissionId_(sheet);
    var saved = saveSubmissionRows_(sheet, payload, submissionId);
    if (!saved) {
      return jsonOutput_({
        success: false,
        message: "Unable to save the submission.",
      });
    }

    var emailResult = { sent: false, error: false };
    if (payload.email) {
      if (!isValidEmail_(payload.email)) {
        emailResult.error = true;
      } else {
        try {
          sendConfirmationEmail_(payload, submissionId);
          emailResult.sent = true;
        } catch (emailErr) {
          emailResult.error = true;
        }
      }
    }

    var response = {
      success: true,
      submissionId: submissionId,
      emailSent: emailResult.sent,
      message: "Travel details submitted successfully.",
    };
    if (emailResult.error) {
      response.emailError = true;
      response.message = "Submission saved successfully. Email could not be sent.";
    }
    return jsonOutput_(response);
  } catch (err) {
    return jsonOutput_({
      success: false,
      message: "Unable to save the submission.",
    });
  } finally {
    lock.releaseLock();
  }
}

function parsePayload_(e) {
  var raw = "";
  if (e && e.postData && e.postData.contents) {
    raw = e.postData.contents;
  } else if (e && e.parameter && e.parameter.payload) {
    raw = e.parameter.payload;
  }
  if (!raw) {
    throw new Error("Empty request");
  }
  return JSON.parse(raw);
}

function validatePayload_(payload) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, message: "Unable to save the submission." };
  }
  if (!String(payload.yatriName || "").trim()) {
    return { ok: false, message: "Yatri Name is required." };
  }
  if (!String(payload.phone || "").trim()) {
    return { ok: false, message: "Registered Mobile Number is required." };
  }
  var type = String(payload.submissionType || "");
  if (type !== "Single" && type !== "Common" && type !== "Separate") {
    return { ok: false, message: "Submission type is required." };
  }
  if (!payload.yatris || !payload.yatris.length) {
    return { ok: false, message: "Yatrika information is required." };
  }
  if (type !== "Separate" && !payload.travelDetails) {
    return { ok: false, message: "Travel details are required." };
  }
  if (type === "Separate") {
    for (var i = 0; i < payload.yatris.length; i++) {
      if (!payload.yatris[i].travelDetails) {
        return { ok: false, message: "Travel details are required." };
      }
    }
  }
  return { ok: true };
}

function getSpreadsheet_() {
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSubmissionsSheet_() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  var firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  var empty = !firstRow.join("");
  if (empty) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function findDuplicateSubmissionId_(sheet, clientRequestId) {
  if (!clientRequestId) return "";
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return "";
  var values = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][2]) === String(clientRequestId)) {
      return String(values[i][0] || "");
    }
  }
  return "";
}

function normalizePhoneForCompare_(phone) {
  var digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length >= 12 && digits.indexOf("91") === 0) {
    return digits.slice(-10);
  }
  if (digits.length > 10) {
    return digits.slice(-10);
  }
  return digits;
}

function findSubmissionByPhone_(sheet, phone) {
  var needle = normalizePhoneForCompare_(phone);
  if (!needle || needle.length < 10) return "";
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return "";
  var values = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  for (var i = 0; i < values.length; i++) {
    if (normalizePhoneForCompare_(values[i][4]) === needle) {
      return String(values[i][0] || "");
    }
  }
  return "";
}

function nextSubmissionId_(sheet) {
  var props = PropertiesService.getScriptProperties();
  var current = parseInt(props.getProperty("SBBG_SEQ") || "0", 10);
  if (!current) {
    current = scanHighestSequence_(sheet);
  }
  current += 1;
  props.setProperty("SBBG_SEQ", String(current));
  var padded = ("00000" + current).slice(-5);
  return SUBMISSION_PREFIX + padded;
}

function scanHighestSequence_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var max = 0;
  var prefix = SUBMISSION_PREFIX;
  for (var i = 0; i < ids.length; i++) {
    var id = String(ids[i][0] || "");
    if (id.indexOf(prefix) === 0) {
      var n = parseInt(id.slice(prefix.length), 10);
      if (n > max) max = n;
    }
  }
  return max;
}

function saveSubmissionRows_(sheet, payload, submissionId) {
  var now = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone() || "Asia/Kolkata",
    "yyyy-MM-dd HH:mm:ss"
  );
  var rows = [];
  var json = JSON.stringify(payload);

  for (var i = 0; i < payload.yatris.length; i++) {
    var yatri = payload.yatris[i];
    var travel =
      payload.submissionType === "Separate"
        ? yatri.travelDetails
        : payload.travelDetails;
    var flat = flattenTravel_(travel);
    rows.push([
      submissionId,
      now,
      payload.clientRequestId || "",
      payload.yatriName || "",
      payload.phone || "",
      payload.email || "",
      payload.submissionType || "",
      yatri.applicationNumber || "",
      yatri.registrationNumber || "",
      yatri.name || "",
      flat.onwardMode,
      flat.onwardNumber,
      flat.onwardPlace,
      flat.onwardDate,
      flat.onwardTime,
      flat.returnMode,
      flat.returnNumber,
      flat.returnPlace,
      flat.returnDate,
      flat.returnTime,
      json,
    ]);
  }

  if (!rows.length) return false;
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, HEADERS.length).setValues(rows);
  return true;
}

function flattenTravel_(travel) {
  travel = travel || {};
  var onward = flattenLeg_(travel.onward || {}, "onward");
  var ret = flattenLeg_(travel.return || {}, "return");
  return {
    onwardMode: onward.mode,
    onwardNumber: onward.number,
    onwardPlace: onward.place,
    onwardDate: onward.date,
    onwardTime: onward.time,
    returnMode: ret.mode,
    returnNumber: ret.number,
    returnPlace: ret.place,
    returnDate: ret.date,
    returnTime: ret.time,
  };
}

function flattenLeg_(leg, direction) {
  var mode = prettyMode_(leg.mode);
  if (leg.mode === "train" && leg.train) {
    var trainPlace =
      direction === "onward"
        ? (leg.arrival && leg.arrival.station) || ""
        : (leg.departure && leg.departure.station) || "";
    var trainDate =
      direction === "onward"
        ? (leg.arrival && leg.arrival.date) || ""
        : (leg.departure && leg.departure.date) || "";
    var trainTime =
      direction === "onward"
        ? (leg.arrival && leg.arrival.time) || ""
        : (leg.departure && leg.departure.time) || "";
    return {
      mode: mode,
      number: leg.train.name || leg.train.number || "",
      place: trainPlace,
      date: trainDate,
      time: trainTime,
    };
  }
  if (isFlightMode_(leg.mode) && leg.flight) {
    return {
      mode: mode,
      number: leg.flight.numberAndName || "",
      place: leg.flight.destination || "",
      date: leg.flight.date || "",
      time: leg.flight.timeSlotLabel || leg.flight.timeSlot || "",
    };
  }
  return {
    mode: mode,
    number: "",
    place: "",
    date: "",
    time: "",
  };
}

function prettyMode_(mode) {
  if (mode === "train") return "Train";
  if (mode === "flight") return "Flight";
  if (mode === "flight-own-drop") {
    return "Flight – Will make own arrangement for drop";
  }
  if (mode === "flight-trust-drop") {
    return "Flight - Trust to arrange to drop at an additional cost of Rs.500/- per each";
  }
  if (mode === "own") return "Own";
  return mode || "";
}

function isFlightMode_(mode) {
  return (
    mode === "flight" ||
    mode === "flight-own-drop" ||
    mode === "flight-trust-drop"
  );
}

function isValidEmail_(email) {
  var value = String(email || "").trim();
  if (!value) return false;
  if (/[\r\n]/.test(value)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function sendConfirmationEmail_(payload, submissionId) {
  var html = buildEmailHtml_(payload, submissionId);
  var plain = buildEmailPlain_(payload, submissionId);
  GmailApp.sendEmail(payload.email, EMAIL_SUBJECT, plain, {
    htmlBody: html,
    name: "SBBG Yatra 2026",
    from: EMAIL_FROM,
    replyTo: EMAIL_REPLY_TO,
  });
}

function escapeHtml_(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildEmailHtml_(payload, submissionId) {
  var type = payload.submissionType;
  var blocks = "";

  if (type === "Separate") {
    for (var i = 0; i < payload.yatris.length; i++) {
      var y = payload.yatris[i];
      blocks +=
        sectionHtml_("YATRIKA " + (i + 1), y.registrationNumber + " — " + y.name) +
        journeyHtml_("ONWARD JOURNEY", y.travelDetails && y.travelDetails.onward, "onward") +
        journeyHtml_("RETURN JOURNEY", y.travelDetails && y.travelDetails.return, "return");
    }
  } else {
    var list = "";
    for (var j = 0; j < payload.yatris.length; j++) {
      list +=
        "<p style=\"margin:4px 0;\">" +
        escapeHtml_(payload.yatris[j].registrationNumber) +
        " — " +
        escapeHtml_(payload.yatris[j].name) +
        "</p>";
    }
    blocks +=
      '<div style="margin:20px 0;padding:16px;background:#f7f3ec;border-radius:8px;">' +
      '<p style="margin:0 0 8px;font-weight:700;color:#8b3a1a;">Yatra Registration details</p>' +
      (type === "Common"
        ? '<p style="margin:0 0 8px;">Submission Type: Common</p>'
        : "") +
      list +
      "</div>" +
      journeyHtml_("ONWARD JOURNEY", payload.travelDetails && payload.travelDetails.onward, "onward") +
      journeyHtml_("RETURN JOURNEY", payload.travelDetails && payload.travelDetails.return, "return");
  }

  return (
    '<div style="font-family:Georgia,serif;max-width:640px;margin:0 auto;color:#1f1a14;line-height:1.55;">' +
    '<div style="padding:24px 8px 8px;text-align:center;">' +
    '<p style="margin:0;letter-spacing:0.12em;text-transform:uppercase;font-size:12px;color:#b8860b;">Kinchit Dharma Trust</p>' +
    '<h1 style="margin:8px 0 0;font-size:22px;color:#8b3a1a;">SBBG Yatra 2026</h1>' +
    '<p style="margin:8px 0 0;font-size:16px;">Travel Details Submission Confirmation</p>' +
    "</div>" +
    '<p>Dear ' +
    escapeHtml_(payload.yatriName) +
    ",</p>" +
    "<p>Your travel details have been successfully submitted.</p>" +
    '<p><strong>Submission ID:</strong><br>' +
    escapeHtml_(submissionId) +
    "</p>" +
    '<p><strong>Applicant\'s Primary Registered Mobile number:</strong><br>' +
    escapeHtml_(payload.phone) +
    "</p>" +
    blocks +
    "<p>Thank you.</p>" +
    '<p style="color:#8b3a1a;font-weight:700;">SBBG Yatra 2026</p>' +
    "</div>"
  );
}

function sectionHtml_(title, subtitle) {
  return (
    '<div style="margin:20px 0 8px;padding:16px;background:#f3e4d8;border-radius:8px;">' +
    '<p style="margin:0;font-weight:700;color:#8b3a1a;">' +
    escapeHtml_(title) +
    "</p>" +
    '<p style="margin:6px 0 0;">' +
    escapeHtml_(subtitle) +
    "</p></div>"
  );
}

function journeyHtml_(title, leg, direction) {
  var lines = journeyLines_(leg, direction);
  var body = "";
  for (var i = 0; i < lines.length; i++) {
    body +=
      "<p style=\"margin:4px 0;\"><strong>" +
      escapeHtml_(lines[i][0]) +
      ":</strong> " +
      escapeHtml_(lines[i][1]) +
      "</p>";
  }
  return (
    '<div style="margin:16px 0;padding:16px;border:1px solid #d9cfc0;border-radius:8px;">' +
    '<p style="margin:0 0 10px;font-weight:700;letter-spacing:0.04em;">' +
    escapeHtml_(title) +
    "</p>" +
    body +
    "</div>"
  );
}

function journeyLines_(leg, direction) {
  leg = leg || {};
  var lines = [["Travel Mode", prettyMode_(leg.mode) || "—"]];
  if (leg.mode === "train" && leg.train) {
    lines.push(["Train Number & Name", leg.train.name || leg.train.number || ""]);
    if (direction === "onward" && leg.arrival) {
      lines.push(["Arrival Station", leg.arrival.station || ""]);
      lines.push(["Arrival Date", leg.arrival.date || ""]);
      lines.push(["Arrival Time", leg.arrival.time || ""]);
    }
    if (direction === "return" && leg.departure) {
      lines.push(["Departure Station", leg.departure.station || ""]);
      lines.push(["Departure Date", leg.departure.date || ""]);
      lines.push(["Departure Time", leg.departure.time || ""]);
    }
  } else if (isFlightMode_(leg.mode) && leg.flight) {
    lines.push(["Airways (Flight Number & Name of Airways)", leg.flight.numberAndName || ""]);
    if (direction === "onward") {
      lines.push(["Arrival Destination", leg.flight.destination || ""]);
      lines.push(["Arrival Date", leg.flight.date || ""]);
      lines.push(["Arrival Hours", leg.flight.timeSlotLabel || leg.flight.timeSlot || ""]);
    } else {
      lines.push(["Departure Airport", leg.flight.destination || ""]);
      lines.push(["Departure Date", leg.flight.date || ""]);
      lines.push(["Departure Hours", leg.flight.timeSlotLabel || leg.flight.timeSlot || ""]);
    }
  }
  return lines;
}

function buildEmailPlain_(payload, submissionId) {
  var text =
    "SBBG Yatra 2026\nTravel Details Submission Confirmation\n\nDear " +
    payload.yatriName +
    ",\n\nYour travel details have been successfully submitted.\n\nSubmission ID:\n" +
    submissionId +
    "\n\nApplicant's Primary Registered Mobile number:\n" +
    payload.phone +
    "\n\n";

  if (payload.submissionType === "Separate") {
    for (var i = 0; i < payload.yatris.length; i++) {
      var y = payload.yatris[i];
      text +=
        "YATRIKA " +
        (i + 1) +
        "\n" +
        y.registrationNumber +
        " — " +
        y.name +
        "\n\n" +
        plainJourney_("ONWARD JOURNEY", y.travelDetails && y.travelDetails.onward, "onward") +
        plainJourney_("RETURN JOURNEY", y.travelDetails && y.travelDetails.return, "return");
    }
  } else {
    if (payload.submissionType === "Common") {
      text += "Submission Type: Common\n\nYatrikas:\n";
    } else {
      text += "Yatra Registration details\n";
    }
    for (var j = 0; j < payload.yatris.length; j++) {
      text +=
        payload.yatris[j].registrationNumber +
        " — " +
        payload.yatris[j].name +
        "\n";
    }
    text +=
      "\n" +
      plainJourney_("ONWARD JOURNEY", payload.travelDetails && payload.travelDetails.onward, "onward") +
      plainJourney_("RETURN JOURNEY", payload.travelDetails && payload.travelDetails.return, "return");
  }

  text += "Thank you.\n\nSBBG Yatra 2026\n";
  return text;
}

function plainJourney_(title, leg, direction) {
  var lines = journeyLines_(leg, direction);
  var text = title + "\n";
  for (var i = 0; i < lines.length; i++) {
    text += lines[i][0] + ": " + lines[i][1] + "\n";
  }
  return text + "\n";
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/**
 * One-time sheet fix: change onward arrival date for train 22691 from 24.10.2026 to 25.10.2026.
 * In the Apps Script editor: select this function → Run. No web-app redeploy needed.
 */
function updateTrain22691ArrivalDate() {
  var sheet = getSubmissionsSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log("No submission rows to update.");
    return;
  }

  var numberCol = 12;
  var dateCol = 14;
  var jsonCol = 21;
  var oldDate = "24.10.2026";
  var newDate = "25.10.2026";
  var updated = 0;
  var values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();

  for (var i = 0; i < values.length; i++) {
    var number = String(values[i][numberCol - 1] || "");
    if (number.indexOf("22691") === -1) continue;

    var changed = false;
    if (isTrain22691OldDate_(values[i][dateCol - 1], oldDate)) {
      values[i][dateCol - 1] = newDate;
      changed = true;
    }

    var jsonText = values[i][jsonCol - 1];
    if (jsonText) {
      try {
        var payload = JSON.parse(jsonText);
        if (shiftTrain22691DateInPayload_(payload, oldDate, newDate)) {
          values[i][jsonCol - 1] = JSON.stringify(payload);
          changed = true;
        }
      } catch (parseErr) {
        Logger.log("Could not parse JSON on row " + (i + 2) + ": " + parseErr);
      }
    }

    if (changed) updated++;
  }

  if (updated) {
    sheet.getRange(2, 1, values.length, HEADERS.length).setValues(values);
  }
  Logger.log("Updated " + updated + " row(s) for train 22691.");
}

function isTrain22691OldDate_(value, oldDate) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return (
      value.getFullYear() === 2026 &&
      value.getMonth() === 9 &&
      value.getDate() === 24
    );
  }
  return String(value || "").indexOf(oldDate) !== -1;
}

function shiftTrain22691DateInPayload_(payload, oldDate, newDate) {
  var changed = false;
  if (payload.travelDetails && shiftTrain22691Leg_(payload.travelDetails.onward, oldDate, newDate)) {
    changed = true;
  }
  if (payload.yatris) {
    for (var i = 0; i < payload.yatris.length; i++) {
      var travel = payload.yatris[i] && payload.yatris[i].travelDetails;
      if (travel && shiftTrain22691Leg_(travel.onward, oldDate, newDate)) {
        changed = true;
      }
    }
  }
  return changed;
}

function shiftTrain22691Leg_(leg, oldDate, newDate) {
  if (!leg || !leg.train) return false;
  var number = String(leg.train.number || leg.train.name || "");
  if (number.indexOf("22691") === -1) return false;
  if (!leg.arrival || String(leg.arrival.date || "") !== oldDate) return false;
  leg.arrival.date = newDate;
  return true;
}
