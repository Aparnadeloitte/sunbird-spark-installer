<#import "template.ftl" as layout>
<@layout.registrationLayout displayInfo=true; section>
    <#if section = "header">
        <#-- Handled inside the form pane -->
    <#elseif section = "form">
        <div class="spark-form-pane">
            <div class="sunbird-logo-wrapper">
                <img src="${url.resourcesPath}/img/sunbird-logo.png" alt="Sunbird" class="sunbird-logo-img" onerror="this.src='https://raw.githubusercontent.com/sunbird-ed/sunbird-ed-portal/master/src/assets/images/sunbird_logo.png'">
            </div>
            
            <h1 class="page-title">Set New Password</h1>
            <p class="page-subtitle">Create a strong password to secure your account.</p>

            <#if message?has_content>
                <div class="alert alert-${message.type}">
                    <span class="kc-feedback-text">${message.summary}</span>
                </div>
            </#if>

            <form id="kc-passwd-update-form" class="kc-form" action="${url.loginAction}" method="post">
                <input type="text" id="username" name="username" value="${username}" style="display:none;"/>
                <input type="password" id="password" name="password" autocomplete="current-password" style="display:none;"/>

                <div class="kc-form-group">
                    <label for="password-new" class="kc-label">Create New Password*</label>
                    <div class="input-wrapper">
                        <input type="password" id="password-new" name="password-new" class="kc-input" autofocus autocomplete="new-password" placeholder="Enter New Password" required onkeyup="validatePassword()"/>
                        <span class="password-toggle" onclick="togglePassword('password-new', 'eye-icon-new')">
                            <svg id="eye-icon-new" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </span>
                    </div>
                </div>

                <div class="kc-form-group">
                    <label for="password-confirm" class="kc-label">Confirm Password*</label>
                    <div class="input-wrapper">
                        <input type="password" id="password-confirm" name="password-confirm" class="kc-input" autocomplete="new-password" placeholder="Confirm New Password" required onkeyup="matchPassword()"/>
                        <span class="password-toggle" onclick="togglePassword('password-confirm', 'eye-icon-confirm')">
                            <svg id="eye-icon-confirm" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </span>
                    </div>
                </div>

                <div class="kc-form-buttons">
                    <button class="kc-button" type="submit">Reset Password</button>
                </div>
            </form>
        </div>

        <script>
            function togglePassword(id, iconId) {
                const passwordInput = document.getElementById(id);
                const eyeIcon = document.getElementById(iconId);
                
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor"/>';
                } else {
                    passwordInput.type = 'password';
                    eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
                }
            }
        </script>
        <style>
            .hide { display: none !important; }
        </style>
</@layout.registrationLayout>
