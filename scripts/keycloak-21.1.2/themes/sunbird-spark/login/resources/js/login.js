// Helper functions from Sunbird theme
function getQueryStringValue(key) {
    return decodeURIComponent(window.location.search.replace(new RegExp("^(?:.*[&\\?]" + encodeURIComponent(key).replace(/[\.\+\*]/g, "\\$&") + "(?:\\=([^&]*))?)?.*$", "i"), "$1"));
}

window.onload = function () {
    var version = getValueFromSession('version');
    var isForgetPasswordAllow = getValueFromSession('version');

    addVersionToURL(version);

    var error_message = (new URLSearchParams(window.location.search)).get('error_message');
    var success_message = (new URLSearchParams(window.location.search)).get('success_message');

    if (error_message) {
        var error_msg = document.getElementById('error-msg');
        if (error_msg) {
            error_msg.className = error_msg.className.replace("hide", "");
            error_msg.innerHTML = error_message;
        }
    } else if (success_message) {
        var success_msg = document.getElementById("success-msg");
        if (success_msg) {
            success_msg.className = success_msg.className.replace("hide", "");
            success_msg.innerHTML = success_message;
        }
    }

    if (version >= 4) {
        var forgotElement = document.getElementById("fgtPortalFlow");
        if (forgotElement) {
            forgotElement.className = forgotElement.className.replace("hide", "");
        }
    } else {
        var forgotElement = document.getElementById("fgtKeycloakFlow");
        if (forgotElement) {
            forgotElement.className = forgotElement.className.replace("hide", "");
            forgotElement.href = forgotElement.href + '&version=' + version;
        }
    }
    if (!version && isForgetPasswordAllow >= 4) {
        hideElement("fgtKeycloakFlow");
        var forgotElement = document.getElementById("fgtPortalFlow");
        if (forgotElement) {
            forgotElement.className = forgotElement.className.replace("hide", "");
        }
    }

};

var validatePassword = function () {
    var textInput = document.getElementById("password-new").value;
    var text2Input = document.getElementById("password-confirm").value;

    var hasLength = textInput.length >= 8;
    var hasLower = /[a-z]/.test(textInput);
    var hasUpper = /[A-Z]/.test(textInput);
    var hasNumber = /[0-9]/.test(textInput);
    var hasSpecial = /[\W_]/.test(textInput);
    var noSpaces = /^\S*$/.test(textInput);

    var error_msg = document.getElementById('passwd-error-msg');

    if (!error_msg) return;

    var isValid = hasLength && hasLower && hasUpper && hasNumber && hasSpecial && noSpaces;

    if (isValid) {
        error_msg.classList.add("hide");
        error_msg.style.display = 'none';

        if (text2Input.length > 0) {
            window.matchPassword();
        }
    } else {
        error_msg.classList.remove("hide");
        error_msg.style.display = 'block';
    }
    window.updateButtonState();
};

var matchPassword = function () {
    var textInput = document.getElementById("password-new").value;
    var text2Input = document.getElementById("password-confirm").value;
    var match_error_msg = document.getElementById('passwd-match-error-msg');

    if (!match_error_msg) return;

    if (textInput === text2Input) {
        match_error_msg.classList.add("hide");
        match_error_msg.style.display = 'none';
    } else {
        match_error_msg.classList.remove("hide");
        match_error_msg.style.display = 'block';
    }
    window.updateButtonState();
};

var updateButtonState = function () {
    var submitButton = document.querySelector("#kc-reset-password-form button[type='submit']");
    if (!submitButton) return;

    var error_msg = document.getElementById('passwd-error-msg');
    var match_error_msg = document.getElementById('passwd-match-error-msg');

    var isComplexValid = error_msg && (error_msg.classList.contains('hide') || error_msg.style.display === 'none');
    var isMatchValid = match_error_msg && (match_error_msg.classList.contains('hide') || match_error_msg.style.display === 'none');

    var pass1 = document.getElementById("password-new").value;
    var pass2 = document.getElementById("password-confirm").value;
    var isNotEmpty = pass1.length > 0 && pass2.length > 0;

    if (isComplexValid && isMatchValid && isNotEmpty) {
        submitButton.disabled = false;
    } else {
        submitButton.disabled = true;
    }
}

// Handler for form submission
var handleResetSubmit = function (event) {
    validatePassword();
    matchPassword();

    var error_msg = document.getElementById('passwd-error-msg');
    var match_error_msg = document.getElementById('passwd-match-error-msg');

    var isComplex = error_msg && (error_msg.classList.contains('hide') || error_msg.style.display === 'none');
    var isMatch = match_error_msg && (match_error_msg.classList.contains('hide') || match_error_msg.style.display === 'none');

    if (isComplex && isMatch) {
        // Switch UI sections instead of redirecting
        const resetSection = document.getElementById('reset-password-section');
        const otpSection = document.getElementById('otp-section');

        if (resetSection && otpSection) {
            resetSection.classList.add('hide');
            otpSection.classList.remove('hide');

            // Initialize OTP timer if it exists
            if (window.startOtpTimer) {
                window.startOtpTimer();
            }

            // Focus first OTP input
            const firstInput = otpSection.querySelector('.otp-digit');
            if (firstInput) firstInput.focus();
        }

        if (event) event.preventDefault();
        return false;
    }

    // Prevent submission if invalid
    if (event) event.preventDefault();
    return false;
};

// OTP UI Helpers
var initOtpInputs = function () {
    const inputs = document.querySelectorAll('.otp-digit');
    const hiddenInput = document.getElementById('otp');

    inputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            if (e.target.value.length === 1) {
                if (index < inputs.length - 1) {
                    inputs[index + 1].focus();
                }
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace') {
                if (e.target.value === '' && index > 0) {
                    inputs[index - 1].focus();
                }
            }
        });

        // Allow only numbers
        input.addEventListener('keypress', (e) => {
            if (!/[0-9]/.test(e.key)) {
                e.preventDefault();
            }
        });
    });
};

var prepareOtpSubmission = function () {
    const inputs = document.querySelectorAll('.otp-digit');
    const hiddenInput = document.getElementById('otp');
    let otpValue = '';
    inputs.forEach(input => {
        otpValue += input.value;
    });
    if (hiddenInput) hiddenInput.value = otpValue;
};

// Timer Logic
var otpTime = 3 * 60 + 58; // 3:58
var startOtpTimer = function () {
    const timersElement = document.getElementById('countdown-timer');
    if (!timersElement) return;

    function updateTimer() {
        const minutes = Math.floor(otpTime / 60);
        let seconds = otpTime % 60;
        seconds = seconds < 10 ? '0' + seconds : seconds;
        timersElement.innerText = "0" + minutes + ":" + seconds;
        if (otpTime > 0) {
            otpTime--;
        }
    }
    updateTimer();
    setInterval(updateTimer, 1000);
}

var resendOtp = function () {
    let toast = document.getElementById('toast-notification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.className = 'toast-notification';

        const title = document.createElement('div');
        title.className = 'toast-title';
        title.innerText = 'OTP Resent';

        const msg = document.createElement('div');
        msg.className = 'toast-message';
        msg.innerHTML = 'A new verification code has been sent to your registered contact.';

        toast.appendChild(title);
        toast.appendChild(msg);
        document.body.appendChild(toast);
    }

    toast.style.display = 'block';
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
};
var storeValueForMigration = function () {
    // storing values in sessionStorage for future references
    sessionStorage.setItem('goBackUrl', getValueFromSession('goBackUrl'));
    // sessionStorage.setItem('identifierValue', getValueFromSession('identifierValue'));
    // sessionStorage.setItem('identifierType', getValueFromSession('identifierType'));
    sessionStorage.setItem('userId', getValueFromSession('userId'));
    sessionStorage.setItem('tncAccepted', getValueFromSession('tncAccepted'));
    sessionStorage.setItem('tncVersion', getValueFromSession('tncVersion'));
};

// Other Sunbird Utilities (Ported & Cleaned & Updated based on User request)

var getValueFromSession = function (valueId) {
    var value = (new URLSearchParams(window.location.search)).get(valueId);
    if (value) {
        sessionStorage.setItem(valueId, value);
        sessionStorage.setItem('renderingType', 'queryParams');
        return value
    } else {
        value = sessionStorage.getItem(valueId);
        if (value) {
            sessionStorage.setItem('renderingType', 'sessionStorage');
        }
        return value
    }
};

var getValue = function (valueId) {
    var value = (new URLSearchParams(window.location.search)).get(valueId);
    if (value) {
        localStorage.setItem('renderingType', 'queryParams');
        return value
    } else {
        value = localStorage.getItem(valueId);
        if (value) {
            localStorage.setItem('renderingType', 'localStorage');
        }
        return value
    }
};

var unHideElement = function (elementId) {
    var elementToUnHide = document.getElementById(elementId);
    if (elementToUnHide) {
        elementToUnHide.className = elementToUnHide.className.replace("hide", "");
    }
};

var setElementValue = function (elementId, elementValue) {
    var element = document.getElementById(elementId);
    if (element) {
        element.value = elementValue;
    }
};

var storeLocation = function () {
    sessionStorage.setItem('url', window.location.href);
}

var addVersionToURL = function (version) {
    if (version >= 1) {
        var selfSingUp = document.getElementById("selfSingUp");
        if (selfSingUp) {
            selfSingUp.className = selfSingUp.className.replace(/\bhide\b/g, "");
        }
        var stateButton = document.getElementById("stateButton");
        if ((version >= 2) && stateButton) {
            stateButton.className = stateButton.className.replace(/\bhide\b/g, "");
        }
    }
}

var makeDivUnclickable = function () {
    var containerElement = document.getElementById('kc-form');
    var overlayEle = document.getElementById('kc-form-wrapper');
    if (overlayEle) overlayEle.style.display = 'block';
    if (containerElement) containerElement.setAttribute('class', 'unClickable');
};

var inputBoxFocusIn = function (currentElement) {
    if (currentElement.id !== 'totp') {
        var placeholderElement = document.querySelector("label[id='" + currentElement.id + "LabelPlaceholder']");
        var labelElement = document.querySelector("label[id='" + currentElement.id + "Label']");
        if (placeholderElement) placeholderElement.className = placeholderElement.className.replace("hide", "");
        if (labelElement) addClass(labelElement, "hide");
    }
};

var inputBoxFocusOut = function (currentElement) {
    if (currentElement.id !== 'totp') {
        var placeholderElement = document.querySelector("label[id='" + currentElement.id + "LabelPlaceholder']");
        var labelElement = document.querySelector("label[id='" + currentElement.id + "Label']");
        if (labelElement) labelElement.className = labelElement.className.replace("hide", "");
        if (placeholderElement) addClass(placeholderElement, "hide");
    }
};

function hideElement(elementId) {
    var elementToHide = document.getElementById(elementId);
    if (elementToHide) {
        addClass(elementToHide, "hide");
    }
}

function addClass(element, classname) {
    var arr;
    arr = element.className.split(" ");
    if (arr.indexOf(classname) == -1) {
        element.className += " " + classname;
    }
}

var redirectToLib = () => {
    window.location.href = window.location.protocol + '//' + window.location.host + '/resource';
};

var viewPassword = function (previewButton) {
    var newPassword = document.getElementById("password-new");
    if (newPassword.type === "password") {
        newPassword.type = "text";
        addClass(previewButton, "slash");
    } else {
        newPassword.type = "password";
        previewButton.className = previewButton.className.replace("slash", "");
    }
}

var urlMap = {
    google: '/google/auth',
    state: '/sign-in/sso/select-org',
    self: '/signup'
}

var navigate = function (type) {
    var version = getValueFromSession('version');
    if (version == '1' || version == '2') {
        if (type == 'google' || type == 'self') {
            redirect(urlMap[type]);
        } else if (type == 'state') {
            handleSsoEvent()
        }
    } else if (version >= '3') {
        if (type == 'google') {
            handleGoogleAuthEvent()
        }
        // else if(type == 'state' || type == 'self') { redirectToPortal(urlMap[type]) } 
        // Logic commented out as per requirement
    }
}

var initialize = () => {
    getValueFromSession('redirect_uri');
    if (!sessionStorage.getItem('session_url')) {
        sessionStorage.setItem('session_url', window.location.href);
    }
};

initialize();

var forgetPassword = (redirectUrlPath) => {
    const curUrlObj = window.location;
    var redirect_uri = getValueFromSession('redirect_uri');
    var client_id = (new URLSearchParams(curUrlObj.search)).get('client_id');
    const sessionUrl = sessionStorage.getItem('session_url');
    if (sessionUrl) {
        const sessionUrlObj = new URL(sessionUrl);
        const updatedQuery = sessionUrlObj.search + '&error_callback=' + sessionUrlObj.href.split('?')[0];
        if (redirect_uri) {
            const redirect_uriLocation = new URL(redirect_uri);
            if (client_id === 'android') {
                window.location.href = sessionUrlObj.protocol + '//' + sessionUrlObj.host + redirectUrlPath + updatedQuery;
            }
            else {
                window.location.href = redirect_uriLocation.protocol + '//' + redirect_uriLocation.host +
                    redirectUrlPath + updatedQuery;
            }
        } else {
            redirectToLib();
        }
    } else {
        redirectToLib();
    }
}

var backToApplication = () => {
    var redirect_uri = getValueFromSession('redirect_uri');
    if (redirect_uri) {
        var updatedQuery = redirect_uri.split('?')[0];
        window.location.href = updatedQuery;
    }
}

var redirect = (redirectUrlPath) => {
    const curUrlObj = window.location;
    var redirect_uri = getValueFromSession('redirect_uri');
    var client_id = (new URLSearchParams(curUrlObj.search)).get('client_id');
    const sessionUrl = sessionStorage.getItem('session_url');
    if (sessionUrl) {
        const sessionUrlObj = new URL(sessionUrl);
        const updatedQuery = sessionUrlObj.search + '&error_callback=' + sessionUrlObj.href.split('?')[0];
        if (redirect_uri) {
            const redirect_uriLocation = new URL(redirect_uri);
            if (client_id === 'android') {
                window.location.href = sessionUrlObj.protocol + '//' + sessionUrlObj.host + redirectUrlPath + updatedQuery;
            } else {
                window.location.href = redirect_uriLocation.protocol + '//' + redirect_uriLocation.host +
                    redirectUrlPath + updatedQuery;
            }
        } else {
            redirectToLib();
        }
    } else {
        redirectToLib();
    }
};

var handleSsoEvent = () => {
    const ssoPath = '/sign-in/sso/select-org';
    const curUrlObj = window.location;
    let redirect_uri = getValueFromSession('redirect_uri');
    let client_id = (new URLSearchParams(curUrlObj.search)).get('client_id');
    const sessionUrl = sessionStorage.getItem('session_url');
    if (sessionUrl) {
        const sessionUrlObj = new URL(sessionUrl);
        if (redirect_uri) {
            const redirect_uriLocation = new URL(redirect_uri);
            if (client_id === 'android') {
                const ssoUrl = sessionUrlObj.protocol + '//' + sessionUrlObj.host + ssoPath;
                window.location.href = redirect_uri + '?ssoUrl=' + ssoUrl;
            } else {
                window.location.href = redirect_uriLocation.protocol + '//' + redirect_uriLocation.host + ssoPath;
            }
        } else {
            redirectToLib();
        }
    } else {
        redirectToLib();
    }
};

var handleGoogleAuthEvent = () => {
    const googleAuthUrl = '/google/auth';
    const curUrlObj = window.location;
    let redirect_uri = getValueFromSession('redirect_uri');
    let client_id = (new URLSearchParams(curUrlObj.search)).get('client_id');
    const updatedQuery = curUrlObj.search + '&error_callback=' + curUrlObj.href.split('?')[0];
    const sessionUrl = sessionStorage.getItem('session_url');
    if (sessionUrl) {
        const sessionUrlObj = new URL(sessionUrl);
        const updatedQuery = sessionUrlObj.search + '&error_callback=' + sessionUrlObj.href.split('?')[0];
        if (redirect_uri) {
            const redirect_uriLocation = new URL(redirect_uri);
            if (client_id === 'android') {
                let host = sessionUrlObj.host;
                if (host.indexOf("merge.") !== -1) {
                    host = host.slice(host.indexOf("merge.") + 6, host.length);
                }
                const googleRedirectUrl = sessionUrlObj.protocol + '//' + host + googleAuthUrl;
                window.location.href = redirect_uri + '?googleRedirectUrl=' + googleRedirectUrl + updatedQuery;
            } else {
                window.location.href = redirect_uriLocation.protocol + '//' + redirect_uriLocation.host + googleAuthUrl + updatedQuery;
            }
        } else {
            redirectToLib();
        }
    } else {
        redirectToLib();
    }
};

var redirectToPortal = (redirectUrlPath) => {
    const curUrlObj = window.location;
    var redirect_uri = getValueFromSession('redirect_uri');
    var client_id = (new URLSearchParams(curUrlObj.search)).get('client_id');
    const sessionUrl = sessionStorage.getItem('session_url');
    if (sessionUrl) {
        const sessionUrlObj = new URL(sessionUrl);
        const updatedQuery = sessionUrlObj.search + '&error_callback=' + sessionUrlObj.href.split('?')[0];
        if (redirect_uri) {
            const redirect_uriLocation = new URL(redirect_uri);
            if (client_id === 'android') {
                window.location.href = sessionUrlObj.protocol + '//' + sessionUrlObj.host + redirectUrlPath + updatedQuery;
            } else {
                window.location.href = redirect_uriLocation.protocol + '//' + redirect_uriLocation.host +
                    redirectUrlPath + updatedQuery;
            }
        } else {
            redirectToLib();
        }
    } else {
        redirectToLib();
    }
};
