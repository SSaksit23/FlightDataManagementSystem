// backend/utils/bookingUtils.js
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const BOOKING_REFERENCE_PREFIX = 'ACN'; // AdventureConnect
const PLATFORM_FEE_PERCENTAGE = 0.10; // 10% platform fee

// ====================================
// 1. Booking Reference Generation and Validation
// ====================================

/**
 * Generates a unique booking reference code.
 * Format: ACN-YYYYMMDD-XXXXXX (XXXXXX is a short UUID part)
 * @returns {string} Unique booking reference code
 */
const generateBookingReference = () => {
  const datePart = moment().format('YYYYMMDD');
  const uniquePart = uuidv4().split('-')[0].toUpperCase().substring(0, 6); // Use first 6 chars of a UUID segment
  return `${BOOKING_REFERENCE_PREFIX}-${datePart}-${uniquePart}`;
};

/**
 * Validates the format of a booking reference.
 * @param {string} reference - The booking reference to validate.
 * @returns {boolean} True if the reference format is valid, false otherwise.
 */
const isValidBookingReferenceFormat = (reference) => {
  if (!reference || typeof reference !== 'string') {
    return false;
  }
  const pattern = new RegExp(`^${BOOKING_REFERENCE_PREFIX}-\\d{8}-[A-Z0-9]{6}$`);
  return pattern.test(reference);
};

// ====================================
// 2. Booking Totals and Fees Calculation
// ====================================

/**
 * Calculates the total price of booking components.
 * @param {Array<Object>} components - Array of booking components, each with a 'price' property.
 * @returns {number} The sum of all component prices.
 */
const calculateSubtotal = (components) => {
  if (!Array.isArray(components)) {
    return 0;
  }
  return components.reduce((sum, component) => sum + (parseFloat(component.price) || 0), 0);
};

/**
 * Calculates the platform fee for a given subtotal.
 * @param {number} subtotal - The subtotal amount of the booking.
 * @returns {number} The calculated platform fee.
 */
const calculatePlatformFee = (subtotal) => {
  return parseFloat((subtotal * PLATFORM_FEE_PERCENTAGE).toFixed(2));
};

/**
 * Calculates the total booking amount including fees.
 * @param {number} subtotal - The subtotal amount of the booking.
 * @param {number} [platformFee] - Optional platform fee. If not provided, it will be calculated.
 * @returns {number} The total amount including fees.
 */
const calculateBookingTotal = (subtotal, platformFee) => {
  const fee = platformFee !== undefined ? platformFee : calculatePlatformFee(subtotal);
  return parseFloat((subtotal + fee).toFixed(2));
};

/**
 * Calculates provider payout amount after deducting platform fee.
 * @param {number} componentPrice - The price of the component/service provided.
 * @returns {{ payoutAmount: number, feeDeducted: number }}
 */
const calculateProviderPayout = (componentPrice) => {
    const price = parseFloat(componentPrice) || 0;
    const feeDeducted = parseFloat((price * PLATFORM_FEE_PERCENTAGE).toFixed(2));
    const payoutAmount = parseFloat((price - feeDeducted).toFixed(2));
    return { payoutAmount, feeDeducted };
};


// ====================================
// 3. Format Booking Data for Emails
// ====================================

/**
 * Formats booking data into a simple HTML string for email.
 * @param {Object} booking - The booking object.
 * @param {Object} traveler - The traveler user object.
 * @param {Array<Object>} components - Array of booking components.
 * @returns {string} HTML string for the email body.
 */
const formatBookingConfirmationEmailHTML = (booking, traveler, components) => {
  const subtotal = calculateSubtotal(components);
  const platformFee = calculatePlatformFee(subtotal);
  const total = calculateBookingTotal(subtotal, platformFee);

  let componentsHTML = '<ul>';
  components.forEach(comp => {
    componentsHTML += `<li>
      <strong>${comp.title || 'Component'}</strong> (${comp.component_type || 'N/A'})<br/>
      Date: ${comp.start_date ? moment(comp.start_date).format('LL') : 'N/A'}
      ${comp.start_time ? ` at ${moment(comp.start_time, 'HH:mm:ss').format('LT')}` : ''}<br/>
      Price: ${comp.currency || 'USD'} ${parseFloat(comp.price).toFixed(2)}
    </li>`;
  });
  componentsHTML += '</ul>';

  return `
    <html>
      <head><style>body { font-family: Arial, sans-serif; line-height: 1.6; } h1 { color: #333; } .details { margin-bottom: 20px; } .footer { margin-top: 30px; font-size: 0.9em; color: #777; }</style></head>
      <body>
        <h1>Booking Confirmation - ${booking.booking_reference}</h1>
        <p>Dear ${traveler.first_name || 'Traveler'},</p>
        <p>Thank you for booking with AdventureConnect! Your trip details are as follows:</p>
        
        <div class="details">
          <h2>${booking.trip_title || 'Your Adventure'}</h2>
          <p><strong>Booking Reference:</strong> ${booking.booking_reference}</p>
          <p><strong>Booking Date:</strong> ${moment(booking.booking_date).format('LLLL')}</p>
          <p><strong>Status:</strong> ${booking.status}</p>
          <p><strong>Number of Travelers:</strong> ${booking.number_of_travelers}</p>
          <p><strong>Start Date:</strong> ${moment(booking.start_date).format('LL')}</p>
          ${booking.end_date ? `<p><strong>End Date:</strong> ${moment(booking.end_date).format('LL')}</p>` : ''}
        </div>

        <h3>Trip Components:</h3>
        ${componentsHTML}

        <h3>Payment Summary:</h3>
        <p>Subtotal: ${booking.currency || 'USD'} ${subtotal.toFixed(2)}</p>
        <p>Platform Fee: ${booking.currency || 'USD'} ${platformFee.toFixed(2)}</p>
        <p><strong>Total Amount: ${booking.currency || 'USD'} ${total.toFixed(2)}</strong></p>

        ${booking.special_requests ? `<p><strong>Special Requests:</strong> ${booking.special_requests}</p>` : ''}
        
        <p>We look forward to your adventure!</p>
        <div class="footer">
          <p>Best regards,</p>
          <p>The AdventureConnect Team</p>
        </div>
      </body>
    </html>
  `;
};

/**
 * Formats booking data for provider notification email.
 * @param {Object} booking - The booking object.
 * @param {Object} providerProfile - The provider's profile.
 * @param {Object} bookingComponent - The specific component booked with this provider.
 * @param {Object} traveler - The traveler user object.
 * @returns {string} HTML string for the email body.
 */
const formatProviderNotificationEmailHTML = (booking, providerProfile, bookingComponent, traveler) => {
    const { payoutAmount, feeDeducted } = calculateProviderPayout(bookingComponent.price);
    return `
      <html>
        <head><style>body { font-family: Arial, sans-serif; line-height: 1.6; } h1 { color: #333; } .details { margin-bottom: 20px; }</style></head>
        <body>
          <h1>New Booking Notification!</h1>
          <p>Hello ${providerProfile.business_name || providerProfile.first_name || 'Provider'},</p>
          <p>You have received a new booking for your service:</p>
          
          <div class="details">
            <p><strong>Service/Component:</strong> ${bookingComponent.title || 'N/A'}</p>
            <p><strong>Booking Reference:</strong> ${booking.booking_reference}</p>
            <p><strong>Traveler:</strong> ${traveler.first_name} ${traveler.last_name} (${traveler.email})</p>
            <p><strong>Date:</strong> ${moment(bookingComponent.start_date || booking.start_date).format('LL')} ${bookingComponent.start_time ? `at ${moment(bookingComponent.start_time, 'HH:mm:ss').format('LT')}` : ''}</p>
            <p><strong>Number of Travelers:</strong> ${booking.number_of_travelers}</p>
            <p><strong>Component Price:</strong> ${bookingComponent.currency || 'USD'} ${parseFloat(bookingComponent.price).toFixed(2)}</p>
            <p><strong>Platform Fee Deducted:</strong> ${bookingComponent.currency || 'USD'} ${feeDeducted.toFixed(2)}</p>
            <p><strong>Your Payout:</strong> ${bookingComponent.currency || 'USD'} ${payoutAmount.toFixed(2)}</p>
          </div>
  
          <p>Please log in to your AdventureConnect dashboard to view full details and manage this booking.</p>
          
          <p>Regards,</p>
          <p>The AdventureConnect Team</p>
        </body>
      </html>
    `;
  };

// ====================================
// 4. Booking Status Validation
// ====================================

const BOOKING_STATUSES = {
  DRAFT: 'draft', // For custom trips before booking
  PLANNED: 'planned', // For custom trips components before booking
  PENDING: 'pending', // Initial status after booking attempt, before payment/confirmation
  CONFIRMED: 'confirmed', // Payment successful, provider confirmed (if needed)
  COMPLETED: 'completed', // Trip/service has finished
  CANCELLED: 'cancelled', // Booking cancelled by traveler or provider
  REFUNDED: 'refunded', // Booking cancelled and payment refunded
  PENDING_PROVIDER_CONFIRMATION: 'pending_provider_confirmation' // If a provider needs to manually confirm
};

const ALLOWED_STATUS_TRANSITIONS = {
  [BOOKING_STATUSES.DRAFT]: [BOOKING_STATUSES.PLANNED, BOOKING_STATUSES.PENDING, BOOKING_STATUSES.CANCELLED],
  [BOOKING_STATUSES.PLANNED]: [BOOKING_STATUSES.PENDING, BOOKING_STATUSES.CANCELLED],
  [BOOKING_STATUSES.PENDING]: [BOOKING_STATUSES.CONFIRMED, BOOKING_STATUSES.PENDING_PROVIDER_CONFIRMATION, BOOKING_STATUSES.CANCELLED],
  [BOOKING_STATUSES.PENDING_PROVIDER_CONFIRMATION]: [BOOKING_STATUSES.CONFIRMED, BOOKING_STATUSES.CANCELLED],
  [BOOKING_STATUSES.CONFIRMED]: [BOOKING_STATUSES.COMPLETED, BOOKING_STATUSES.CANCELLED],
  [BOOKING_STATUSES.COMPLETED]: [BOOKING_STATUSES.REFUNDED], // Assuming refund only after completion for specific cases
  [BOOKING_STATUSES.CANCELLED]: [BOOKING_STATUSES.REFUNDED], // If eligible for refund
  [BOOKING_STATUSES.REFUNDED]: [] // Terminal state
};

/**
 * Validates if a booking status transition is allowed.
 * @param {string} currentStatus - The current status of the booking.
 * @param {string} nextStatus - The desired next status.
 * @returns {boolean} True if the transition is allowed, false otherwise.
 */
const isValidStatusTransition = (currentStatus, nextStatus) => {
  if (!ALLOWED_STATUS_TRANSITIONS[currentStatus]) {
    return false; // Current status is not recognized
  }
  return ALLOWED_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
};

// ====================================
// 5. Date/Time Utilities for Booking
// ====================================

/**
 * Formats a date string.
 * @param {string|Date} date - The date to format.
 * @param {string} [format='YYYY-MM-DD'] - The desired format string (moment.js format).
 * @returns {string} Formatted date string.
 */
const formatDate = (date, format = 'YYYY-MM-DD') => {
  return moment(date).format(format);
};

/**
 * Formats a time string.
 * @param {string|Date} time - The time to format (can be part of a datetime string or just HH:mm:ss).
 * @param {string} [format='HH:mm'] - The desired format string.
 * @returns {string} Formatted time string.
 */
const formatTime = (time, format = 'HH:mm') => {
  // Try to parse assuming it might be just a time string or a full datetime
  return moment(time, ['HH:mm:ss', 'HH:mm', moment.ISO_8601]).format(format);
};

/**
 * Calculates the duration between two dates.
 * @param {string|Date} startDate - The start date.
 * @param {string|Date} endDate - The end date.
 * @param {string} [unit='days'] - The unit for duration (e.g., 'days', 'hours', 'minutes').
 * @returns {number} The duration.
 */
const calculateDuration = (startDate, endDate, unit = 'days') => {
  const start = moment(startDate);
  const end = moment(endDate);
  return end.diff(start, unit);
};

/**
 * Checks if a date is in the past.
 * @param {string|Date} date - The date to check.
 * @returns {boolean} True if the date is in the past, false otherwise.
 */
const isDateInPast = (date) => {
  return moment(date).isBefore(moment(), 'day'); // Compare by day, ignoring time
};

/**
 * Adds a duration to a date.
 * @param {string|Date} date - The initial date.
 * @param {number} amount - The amount of duration to add.
 * @param {string} unit - The unit of duration (e.g., 'days', 'hours').
 * @returns {Date} The new date object.
 */
const addDurationToDate = (date, amount, unit) => {
  return moment(date).add(amount, unit).toDate();
};

// ====================================
// 6. Currency Conversion Helpers (Placeholders)
// ====================================

/**
 * Formats an amount into a currency string. (Placeholder - uses Intl.NumberFormat)
 * @param {number} amount - The amount.
 * @param {string} [currency='USD'] - The currency code.
 * @param {string} [locale='en-US'] - The locale for formatting.
 * @returns {string} Formatted currency string.
 */
const formatCurrency = (amount, currency = 'USD', locale = 'en-US') => {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: currency }).format(amount);
  } catch (error) {
    // Fallback for invalid currency codes or environments without full Intl support
    return `${currency} ${parseFloat(amount).toFixed(2)}`;
  }
};

/**
 * Converts an amount from one currency to another. (Placeholder)
 * NOTE: This is a placeholder. Real implementation requires an exchange rate API.
 * @param {number} amount - The amount to convert.
 * @param {string} fromCurrency - The source currency code.
 * @param {string} toCurrency - The target currency code.
 * @param {Object} [rates] - Optional exchange rates object (e.g., { USD: 1, EUR: 0.92 }).
 * @returns {Promise<number|null>} Converted amount or null if conversion fails.
 */
const convertCurrency = async (amount, fromCurrency, toCurrency, rates) => {
  if (fromCurrency === toCurrency) {
    return parseFloat(amount.toFixed(2));
  }
  // Placeholder: In a real app, fetch rates from an API (e.g., Open Exchange Rates, Fixer.io)
  // For demonstration, if rates are provided:
  if (rates && rates[fromCurrency] && rates[toCurrency]) {
    const amountInBase = amount / rates[fromCurrency]; // Convert to base (e.g., USD)
    return parseFloat((amountInBase * rates[toCurrency]).toFixed(2));
  }
  console.warn(`Currency conversion for ${fromCurrency} to ${toCurrency} not implemented or rates unavailable.`);
  return null; // Indicate conversion failure
};

module.exports = {
  generateBookingReference,
  isValidBookingReferenceFormat,
  calculateSubtotal,
  calculatePlatformFee,
  calculateBookingTotal,
  calculateProviderPayout,
  formatBookingConfirmationEmailHTML,
  formatProviderNotificationEmailHTML,
  BOOKING_STATUSES,
  isValidStatusTransition,
  formatDate,
  formatTime,
  calculateDuration,
  isDateInPast,
  addDurationToDate,
  formatCurrency,
  convertCurrency,
};
