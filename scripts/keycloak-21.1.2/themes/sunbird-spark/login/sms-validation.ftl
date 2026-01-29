<#import "template.ftl" as layout>
<@layout.registrationLayout; section>
    <#if section = "header">
        <#-- Handled inside the form pane -->
    <#elseif section = "form">
        <div class="spark-form-pane">
            <div class="sunbird-logo-wrapper">
                <img src="${url.resourcesPath}/img/sunbird-logo.png" alt="Sunbird" class="sunbird-logo-img" onerror="this.src='https://raw.githubusercontent.com/sunbird-ed/sunbird-ed-portal/master/src/assets/images/sunbird_logo.png'">
            </div>
            
            <h1 class="page-title">${msg("emailForgotTitle")}</h1>
            <p class="page-subtitle">${msg("enterCode")}</p>

            <#if message?has_content>
                <div class="alert alert-${message.type}">
                    <span class="kc-feedback-text">${message.summary}</span>
                </div>
            </#if>

            <form id="kc-totp-login-form" class="kc-form" action="${url.loginAction}" method="post">
                <div class="kc-form-group">
                    <label for="totp" class="kc-label">Enter OTP*</label>
                    <div class="input-wrapper">
                        <input id="totp" name="smsCode" type="text" class="kc-input" autofocus placeholder="Enter 6-digit OTP" autocomplete="off" required/>
                    </div>
                </div>

                <div class="kc-form-buttons">
                    <button class="kc-button" type="submit">Verify & Continue</button>
                </div>
            </form>
            
            <div class="resend-otp">
                <span>Didn't receive the code? </span>
                <a href="#" onclick="resendOtp(); return false;">Resend OTP</a>
            </div>
        </div>
    <#elseif section = "info" >
        <div class="registration-link">
            <#if client?? && client.baseUrl?has_content>
                <a id="backToApplication" href="${client.baseUrl}">${msg("backToApplication")}</a>
            </#if>
        </div>
    </#if>
</@layout.registrationLayout>
